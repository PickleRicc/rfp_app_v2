/**
 * Generate simple PDF resumes from markdown and upload to Supabase storage.
 * Updates data_call_files records with correct file_path and file_size.
 *
 * Usage:
 *   env $(cat .env | xargs) npx tsx scripts/upload-resumes.ts
 */

import { createClient } from '@supabase/supabase-js';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SOL_ID = 'ba6a317c-6524-4df5-bb2b-1ee132d02567';
const COMPANY_ID = '82545dfa-9a53-45da-8da9-134b2ea2ec37';
const DCR_ID = '43c6ce87-81ed-4dee-b3a8-deb0dd48282e';
const RESUME_DIR = path.join(__dirname, 'resumes');

const PERSONNEL = [
  { index: 0, file: 'Michael_Anderson_Resume.md', name: 'Michael Anderson' },
  { index: 1, file: 'Dr_Priya_Patel_Resume.md', name: 'Dr. Priya Patel' },
  { index: 2, file: 'James_Rodriguez_Resume.md', name: 'James Rodriguez' },
  { index: 3, file: 'Karen_Mitchell_Resume.md', name: 'Karen Mitchell' },
  { index: 4, file: 'David_Thompson_Resume.md', name: 'David Thompson' },
  { index: 5, file: 'Lisa_Park_Resume.md', name: 'Lisa Park' },
  { index: 6, file: 'Robert_Kim_Resume.md', name: 'Robert Kim' },
];

async function markdownToPdf(markdownText: string, personName: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 612; // Letter
  const pageHeight = 792;
  const margin = 54; // 0.75 inch
  const lineHeight = 13;
  const maxWidth = pageWidth - margin * 2;

  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const lines = markdownText.split('\n');

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    // Need new page?
    if (y < margin + 20) {
      page = doc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }

    // H1: name header
    if (line.startsWith('# ') && !line.startsWith('## ')) {
      const text = line.replace(/^# /, '');
      page.drawText(text, { x: margin, y, size: 16, font: fontBold, color: rgb(0.1, 0.1, 0.3) });
      y -= 22;
      continue;
    }

    // H2: section header
    if (line.startsWith('## ')) {
      y -= 8; // extra spacing before section
      const text = line.replace(/^## /, '');
      // Draw underline
      page.drawLine({ start: { x: margin, y: y - 2 }, end: { x: pageWidth - margin, y: y - 2 }, thickness: 0.5, color: rgb(0.3, 0.3, 0.5) });
      page.drawText(text, { x: margin, y: y + 2, size: 11, font: fontBold, color: rgb(0.15, 0.15, 0.4) });
      y -= 18;
      continue;
    }

    // H3: job title
    if (line.startsWith('### ')) {
      y -= 4;
      const text = line.replace(/^### /, '');
      page.drawText(text, { x: margin, y, size: 10, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
      y -= 15;
      continue;
    }

    // Horizontal rule
    if (line.match(/^-{3,}$/)) {
      page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
      y -= 8;
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      y -= 6;
      continue;
    }

    // Bold line (e.g., **Title**)
    const boldMatch = line.match(/^\*\*(.+)\*\*$/);

    // Bullet point
    const isBullet = line.startsWith('- ');
    const bulletText = isBullet ? line.slice(2) : line;
    const cleanText = bulletText.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1');

    const currentFont = boldMatch ? fontBold : font;
    const displayText = boldMatch ? boldMatch[1] : (isBullet ? '• ' + cleanText : cleanText);
    const fontSize = 9;

    // Word wrap
    const words = displayText.split(' ');
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? currentLine + ' ' + word : word;
      const testWidth = currentFont.widthOfTextAtSize(testLine, fontSize);

      if (testWidth > maxWidth && currentLine) {
        if (y < margin + 20) {
          page = doc.addPage([pageWidth, pageHeight]);
          y = pageHeight - margin;
        }
        page.drawText(currentLine, { x: isBullet ? margin + 12 : margin, y, size: fontSize, font: currentFont, color: rgb(0.15, 0.15, 0.15) });
        y -= lineHeight;
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      if (y < margin + 20) {
        page = doc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }
      page.drawText(currentLine, { x: isBullet ? margin + 12 : margin, y, size: fontSize, font: currentFont, color: rgb(0.15, 0.15, 0.15) });
      y -= lineHeight;
    }
  }

  return doc.save();
}

async function main() {
  console.log('Generating and uploading resumes...\n');

  for (const person of PERSONNEL) {
    const mdPath = path.join(RESUME_DIR, person.file);

    if (!fs.existsSync(mdPath)) {
      console.error(`Missing: ${mdPath}`);
      continue;
    }

    const markdown = fs.readFileSync(mdPath, 'utf-8');
    const pdfBytes = await markdownToPdf(markdown, person.name);
    const pdfFilename = person.name.replace(/\s+/g, '_').replace(/\./g, '') + '_Resume.pdf';
    const storagePath = `${COMPANY_ID}/${SOL_ID}/key_personnel/personnel_${person.index}_resume/${pdfFilename}`;

    // Upload to Supabase storage
    const { error: uploadError } = await supabase.storage
      .from('data-call-files')
      .upload(storagePath, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      console.error(`Upload failed for ${person.name}:`, uploadError.message);
      continue;
    }

    // Update the data_call_files record
    const fieldKey = `personnel_${person.index}_resume`;
    const { error: updateError } = await supabase
      .from('data_call_files')
      .update({
        file_path: storagePath,
        filename: pdfFilename,
        file_size: pdfBytes.length,
        mime_type: 'application/pdf',
        extracted_text: markdown, // Store the full resume text for AI generation
      })
      .eq('data_call_response_id', DCR_ID)
      .eq('field_key', fieldKey);

    if (updateError) {
      console.error(`DB update failed for ${person.name}:`, updateError.message);
      continue;
    }

    console.log(`✅ ${person.name} — ${pdfFilename} (${(pdfBytes.length / 1024).toFixed(1)} KB) → ${storagePath}`);
  }

  console.log('\nDone. Refresh the Data Call tab.');
}

main().catch(err => { console.error(err); process.exit(1); });
