import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';
import { inngest } from '@/lib/inngest/client';
import { requireStaffOrResponse } from '@/lib/auth';
import ExcelJS from 'exceljs';
import { PDFParse } from 'pdf-parse';

// Allowed MIME types and extensions for solicitation document uploads
const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.txt'];
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/plain',
];

function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  return lastDot !== -1 ? filename.slice(lastDot).toLowerCase() : '';
}

function isAllowedFile(file: File): boolean {
  const ext = getFileExtension(file.name);
  return ALLOWED_EXTENSIONS.includes(ext) || ALLOWED_MIME_TYPES.includes(file.type);
}

/**
 * Extract readable text from an Excel workbook (.xlsx / .xls).
 * Iterates every sheet → every row → every cell and emits a TSV-style
 * text representation that the AI classifier and extractor can understand.
 */
async function extractTextFromExcel(buffer: ArrayBuffer, filename: string): Promise<string> {
  try {
    const workbook = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(buffer as any);

    const lines: string[] = [];
    workbook.eachSheet((sheet) => {
      lines.push(`\n=== Sheet: ${sheet.name} ===\n`);
      sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        const cells: string[] = [];
        row.eachCell({ includeEmpty: true }, (cell) => {
          // Handle rich-text cells, formulas, and plain values
          const val = cell.text ?? cell.value?.toString() ?? '';
          cells.push(val);
        });
        if (cells.some((c) => c.trim() !== '')) {
          lines.push(`Row ${rowNumber}: ${cells.join('\t')}`);
        }
      });
    });

    const text = lines.join('\n');
    console.log(`[excel-extract] ${filename}: ${workbook.worksheets.length} sheets, ${text.length} chars`);
    return text;
  } catch (err) {
    console.error(`[excel-extract] Failed for ${filename}:`, err);
    return `[Excel extraction failed for ${filename}]`;
  }
}

async function extractTextFromFile(file: File): Promise<string> {
  const ext = getFileExtension(file.name);

  // --- Excel files (.xlsx, .xls) ---
  if (
    ext === '.xlsx' || ext === '.xls' ||
    file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    file.type === 'application/vnd.ms-excel'
  ) {
    const buffer = await file.arrayBuffer();
    return extractTextFromExcel(buffer, file.name);
  }

  // --- PDF files ---
  if (ext === '.pdf' || file.type === 'application/pdf') {
    if (process.env.PDF_SERVICE_URL) {
      try {
        const pdfFormData = new FormData();
        pdfFormData.append('file', file);
        const response = await fetch(`${process.env.PDF_SERVICE_URL}/extract-text`, {
          method: 'POST',
          body: pdfFormData,
        });
        if (response.ok) {
          const result = await response.json();
          console.log(`[pdf-extract] ${file.name}: ${result.pages} pages, ${result.character_count} chars`);
          return result.text;
        }
      } catch (err) {
        console.warn(`[pdf-extract] Service error for ${file.name}, falling back to pdf-parse:`, err instanceof Error ? err.message : err);
      }
    }
    try {
      const buf = Buffer.from(await file.arrayBuffer());
      const parser = new PDFParse({ data: buf });
      const result = await parser.getText();
      console.log(`[pdf-parse] ${file.name}: ${result.text.length} chars`);
      return result.text;
    } catch (parseErr) {
      console.error(`[pdf-parse] Failed for ${file.name}:`, parseErr instanceof Error ? parseErr.message : parseErr);
      return `[PDF text extraction failed. Filename: ${file.name}]`;
    }
  }

  // --- DOCX, TXT, and other text-based formats ---
  return await file.text();
}

/**
 * POST /api/solicitations/[id]/upload
 *
 * Bulk file upload for solicitation packages. Accepts multiple files in a single
 * request, extracts text from each, creates solicitation_document records, and
 * triggers AI classification via Inngest.
 *
 * Auth: requireStaffOrResponse() + X-Company-Id header
 * Body: multipart/form-data with "files" field (multiple) and optional "solicitation_number_detected"
 *
 * Returns: { success, documents: [{id, filename, status}...], errors: [{filename, error}...] }
 * Per-file failures are reported in errors[] but processing continues for valid files.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffOrResponse();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id: solicitationId } = await params;
    const companyId = request.headers.get('X-Company-Id');

    if (!companyId) {
      return NextResponse.json(
        { error: 'No company selected. Please select a company before uploading.' },
        { status: 400 }
      );
    }

    // === TIER 1 GATE CHECK ===
    const supabase = getServerClient();
    const { data: gateData, error: gateError } = await supabase
      .from('company_profiles')
      .select('tier1_complete')
      .eq('id', companyId)
      .single();

    if (gateError) {
      if (gateError.code === 'PGRST116') {
        return NextResponse.json(
          {
            error:
              'Company profile not found. Please create your company profile at /company/profile before uploading.',
            code: 'PROFILE_NOT_FOUND',
          },
          { status: 403 }
        );
      }
      console.error('Upload gate check error:', gateError);
      return NextResponse.json(
        { error: 'Failed to verify Tier 1 completion status' },
        { status: 500 }
      );
    }

    if (!gateData?.tier1_complete) {
      return NextResponse.json(
        {
          error:
            'Tier 1 Enterprise Intake must be completed before uploading solicitation documents. Please complete your company profile at /company/profile.',
          code: 'TIER1_INCOMPLETE',
        },
        { status: 403 }
      );
    }
    // === END TIER 1 GATE CHECK ===

    // Verify the solicitation exists and belongs to the requesting company
    const { data: solicitation, error: solError } = await supabase
      .from('solicitations')
      .select('id, status')
      .eq('id', solicitationId)
      .eq('company_id', companyId)
      .single();

    if (solError || !solicitation) {
      return NextResponse.json(
        { error: 'Solicitation not found or access denied' },
        { status: 404 }
      );
    }

    // Parse the multipart form data
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    const documents: { id: string; filename: string; status: string }[] = [];
    const errors: { filename: string; error: string }[] = [];

    let sortOrder = 0;

    for (const file of files) {
      // Validate file type
      if (!isAllowedFile(file)) {
        errors.push({
          filename: file.name,
          error: `File type not allowed. Accepted types: ${ALLOWED_EXTENSIONS.join(', ')}`,
        });
        continue;
      }

      try {
        sortOrder++;

        // Create the document record immediately with extracting status
        const { data: docRecord, error: insertError } = await supabase
          .from('solicitation_documents')
          .insert({
            solicitation_id: solicitationId,
            filename: file.name,
            file_path: `/uploads/solicitations/${solicitationId}/${file.name}`,
            file_size: file.size,
            mime_type: file.type || 'application/octet-stream',
            processing_status: 'extracting',
            sort_order: sortOrder,
          })
          .select('id, filename, processing_status')
          .single();

        if (insertError || !docRecord) {
          console.error(`Failed to create document record for ${file.name}:`, insertError);
          errors.push({
            filename: file.name,
            error: 'Failed to create document record',
          });
          continue;
        }

        // Extract text content from file
        const extractedText = await extractTextFromFile(file);

        // Update the record with extracted text
        await supabase
          .from('solicitation_documents')
          .update({ extracted_text: extractedText })
          .eq('id', docRecord.id);

        // Trigger Inngest classification event
        await inngest.send({
          name: 'solicitation.document.uploaded',
          data: {
            solicitationId,
            documentId: docRecord.id,
            extractedText,
          },
        });

        documents.push({
          id: docRecord.id,
          filename: docRecord.filename,
          status: docRecord.processing_status,
        });
      } catch (fileError) {
        console.error(`Error processing file ${file.name}:`, fileError);
        errors.push({
          filename: file.name,
          error: fileError instanceof Error ? fileError.message : 'Processing failed',
        });
      }
    }

    // Update solicitation document_count and move to classifying status
    if (documents.length > 0) {
      await supabase
        .from('solicitations')
        .update({
          document_count: documents.length,
          status: 'classifying',
          updated_at: new Date().toISOString(),
        })
        .eq('id', solicitationId);
    }

    return NextResponse.json({
      success: true,
      documents,
      errors,
    });
  } catch (error) {
    console.error('Solicitation upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
