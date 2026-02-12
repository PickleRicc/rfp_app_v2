/**
 * DOCX Page Counter
 * 
 * Extracts actual text from a DOCX buffer (ZIP of XML) and estimates
 * page count based on word count. This is far more accurate than
 * counting Paragraph objects because it measures real content.
 *
 * Standard metric: ~450 words per page for 11pt single-spaced with margins.
 */

import JSZip from 'jszip';

/** Result of counting pages from a DOCX buffer */
export interface DocxPageCount {
  /** Estimated total page count */
  totalPages: number;
  /** Total word count extracted from the document */
  wordCount: number;
  /** Total character count */
  charCount: number;
  /** Per-section breakdown (if sections could be identified) */
  sections: SectionPageCount[];
  /** Front matter pages (cover, TOC, etc.) estimated from structure */
  frontMatterPages: number;
  /** Content pages (from word count) */
  contentPages: number;
}

export interface SectionPageCount {
  title: string;
  wordCount: number;
  estimatedPages: number;
}

// Constants for page estimation
const WORDS_PER_PAGE = 450;   // 11pt, single-spaced, standard margins
const FRONT_MATTER_ESTIMATE = 4; // cover page + TOC (2 pages) + cover letter

/**
 * Count pages from a DOCX buffer by extracting actual text content.
 * 
 * How it works:
 * 1. DOCX files are ZIP archives containing XML
 * 2. The main content is in word/document.xml
 * 3. We extract all text nodes from the XML
 * 4. We count words and divide by words-per-page
 * 5. We add estimated front matter pages
 *
 * @param docxBuffer The DOCX file as a Buffer
 * @returns Page count estimation based on actual word content
 */
export async function countPagesFromDocx(docxBuffer: Buffer): Promise<DocxPageCount> {
  try {
    const zip = await JSZip.loadAsync(docxBuffer);

    // Extract the main document content
    const documentXml = await zip.file('word/document.xml')?.async('text');
    if (!documentXml) {
      console.warn('⚠️ Could not find word/document.xml in DOCX');
      return createFallbackEstimate(docxBuffer.length);
    }

    // Extract all text from the XML
    const { fullText, sections } = extractTextFromXml(documentXml);

    // Count words
    const words = fullText.split(/\s+/).filter(w => w.length > 0);
    const wordCount = words.length;
    const charCount = fullText.length;

    // Calculate content pages from word count
    const contentPages = Math.max(1, Math.ceil(wordCount / WORDS_PER_PAGE));

    // Estimate front matter pages
    // Check for cover page, TOC, etc. in the XML structure
    const frontMatterPages = estimateFrontMatter(documentXml);

    const totalPages = contentPages + frontMatterPages;

    // Per-section breakdown
    const sectionPageCounts: SectionPageCount[] = sections.map(section => {
      const sectionWords = section.text.split(/\s+/).filter(w => w.length > 0).length;
      return {
        title: section.title,
        wordCount: sectionWords,
        estimatedPages: Math.max(0.5, Math.round((sectionWords / WORDS_PER_PAGE) * 2) / 2), // round to nearest 0.5
      };
    });

    return {
      totalPages,
      wordCount,
      charCount,
      sections: sectionPageCounts,
      frontMatterPages,
      contentPages,
    };
  } catch (error) {
    console.error('❌ Error counting pages from DOCX:', error);
    return createFallbackEstimate(docxBuffer.length);
  }
}

/**
 * Extract text content from Word XML, split by sections (headings).
 * 
 * DOCX XML structure:
 * <w:body>
 *   <w:p>                          ← paragraph
 *     <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>  ← heading style
 *     <w:r>                        ← run
 *       <w:t>Some text</w:t>       ← text node
 *     </w:r>
 *   </w:p>
 * </w:body>
 */
function extractTextFromXml(xml: string): { fullText: string; sections: Array<{ title: string; text: string }> } {
  // Extract all text nodes: <w:t>...</w:t> and <w:t xml:space="preserve">...</w:t>
  const textRegex = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;

  // Extract paragraph boundaries and heading styles
  const paragraphRegex = /<w:p[ >][\s\S]*?<\/w:p>/g;
  const headingStyleRegex = /<w:pStyle\s+w:val="(Heading\d|Title|TOC\w*)"/i;
  const textInParaRegex = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;

  const sections: Array<{ title: string; text: string }> = [];
  let currentSection: { title: string; text: string } | null = null;
  const allTextParts: string[] = [];

  let paraMatch;
  while ((paraMatch = paragraphRegex.exec(xml)) !== null) {
    const paraXml = paraMatch[0];

    // Extract text from this paragraph
    const paraTextParts: string[] = [];
    let textMatch;
    textInParaRegex.lastIndex = 0;
    while ((textMatch = textInParaRegex.exec(paraXml)) !== null) {
      paraTextParts.push(textMatch[1]);
    }
    const paraText = paraTextParts.join('');

    if (!paraText.trim()) continue;

    // Check if this is a heading
    const headingMatch = headingStyleRegex.exec(paraXml);
    const isHeading = headingMatch !== null;
    const isToc = headingMatch && headingMatch[1].startsWith('TOC');

    // Skip TOC entries (they're just references, not real content)
    if (isToc) continue;

    if (isHeading && !isToc) {
      // Start a new section
      if (currentSection) {
        sections.push(currentSection);
      }
      currentSection = { title: paraText.trim(), text: '' };
    } else if (currentSection) {
      currentSection.text += paraText + ' ';
    }

    allTextParts.push(paraText);
  }

  // Push the last section
  if (currentSection) {
    sections.push(currentSection);
  }

  // If no sections were detected, fall back to full text extraction
  if (sections.length === 0) {
    let match;
    textRegex.lastIndex = 0;
    const fallbackParts: string[] = [];
    while ((match = textRegex.exec(xml)) !== null) {
      fallbackParts.push(match[1]);
    }
    return {
      fullText: fallbackParts.join(' '),
      sections: [{ title: 'Document', text: fallbackParts.join(' ') }],
    };
  }

  return {
    fullText: allTextParts.join(' '),
    sections,
  };
}

/**
 * Estimate front matter pages from the XML structure.
 * Looks for cover page, table of contents, and cover letter indicators.
 */
function estimateFrontMatter(xml: string): number {
  let pages = 0;

  // Check for page breaks before main content (cover page indicator)
  const hasPageBreaks = xml.includes('w:type="page"') || xml.includes('w:br w:type="page"');
  if (hasPageBreaks) {
    // Count page breaks in the first portion of the document (front matter area)
    const firstQuarter = xml.substring(0, Math.floor(xml.length / 4));
    const pageBreakCount = (firstQuarter.match(/w:type="page"/g) || []).length;
    pages += Math.min(pageBreakCount, 4); // Cap at 4 front matter pages
  }

  // If we detected page breaks, use that count; otherwise use the default estimate
  return pages > 0 ? pages : FRONT_MATTER_ESTIMATE;
}

/**
 * Fallback estimation when DOCX parsing fails.
 * Uses buffer size as a rough proxy.
 */
function createFallbackEstimate(bufferSize: number): DocxPageCount {
  // Rough estimate: ~3500 bytes per page in a compressed DOCX
  const estimatedPages = Math.max(1, Math.round(bufferSize / 3500));

  return {
    totalPages: estimatedPages,
    wordCount: 0,
    charCount: 0,
    sections: [],
    frontMatterPages: FRONT_MATTER_ESTIMATE,
    contentPages: Math.max(1, estimatedPages - FRONT_MATTER_ESTIMATE),
  };
}
