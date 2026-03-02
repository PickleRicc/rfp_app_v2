/**
 * Page Allocation System (Framework Part 8.2)
 * Estimates page count and tracks against limits
 */

import { Paragraph } from 'docx';

export interface PageEstimate {
  words: number;
  paragraphs: number;
  headings: number;
  tables: number;
  estimatedPages: number;
}

export const PAGE_CONSTANTS = {
  WORDS_PER_PAGE_10PT: 500,
  WORDS_PER_PAGE_11PT: 450,
  WORDS_PER_PAGE_12PT: 400,

  // Adjustment factors
  HEADING_PAGE_FRACTION: 0.08, // H1 takes ~8% of page with spacing
  TABLE_PAGE_ESTIMATE: 0.3, // Average table takes 30% of page
  CALLOUT_BOX_PAGE_ESTIMATE: 0.25, // Callout box takes 25% of page

  // Page number calculation constants
  CHARS_PER_PAGE: 3000, // Approximate characters per page with margins
  LINES_PER_PAGE: 45,   // Approximate lines per page
  PARAGRAPHS_PER_PAGE: 3, // Approximate paragraphs per page
  COVER_PAGES: 1,       // Cover page
  TOC_PAGES: 2,         // TOC + Table of Exhibits
  COVER_LETTER_PAGES: 0, // Cover letter removed — no longer generated
};

/**
 * Estimate page count for content
 */
export function estimatePages(
  content: any[], // Can be Paragraphs, Tables, or mixed
  fontSize: 10 | 11 | 12 = 11
): PageEstimate {
  let words = 0;
  let paragraphs = 0;
  let headings = 0;
  let tables = 0;

  for (const item of content) {
    if (item.constructor.name === 'Table') {
      tables++;
      // Tables are harder to estimate, use fixed fraction
    } else if (item.constructor.name === 'Paragraph') {
      paragraphs++;

      // Check if it's a heading
      if (item.heading) {
        headings++;
      } else {
        // Try to extract text from paragraph
        const text = extractTextFromParagraph(item);
        const wordCount = text.split(/\s+/).filter((w: string) => w.length > 0).length;
        words += wordCount;
      }
    }
  }

  const wordsPerPage =
    fontSize === 10
      ? PAGE_CONSTANTS.WORDS_PER_PAGE_10PT
      : fontSize === 12
      ? PAGE_CONSTANTS.WORDS_PER_PAGE_12PT
      : PAGE_CONSTANTS.WORDS_PER_PAGE_11PT;

  const textPages = words / wordsPerPage;
  const headingPages = headings * PAGE_CONSTANTS.HEADING_PAGE_FRACTION;
  const tablePages = tables * PAGE_CONSTANTS.TABLE_PAGE_ESTIMATE;

  const totalPages = textPages + headingPages + tablePages;

  return {
    words,
    paragraphs,
    headings,
    tables,
    estimatedPages: Math.ceil(totalPages),
  };
}

/**
 * Extract text from a Paragraph object (best effort)
 */
function extractTextFromParagraph(para: any): string {
  try {
    // Try direct text property
    if (para.text && typeof para.text === 'string') {
      return para.text;
    }

    // Try children array (TextRun objects)
    if (para.children && Array.isArray(para.children)) {
      return para.children
        .map((child: any) => {
          if (typeof child === 'string') return child;
          if (child.text) return child.text;
          if (child.children && Array.isArray(child.children)) {
            return child.children.map((c: any) => c.text || '').join('');
          }
          return '';
        })
        .join(' ');
    }

    return '';
  } catch (error) {
    // If extraction fails, return empty string
    return '';
  }
}

/**
 * Check if content exceeds page limit
 */
export function checkPageLimit(
  estimate: PageEstimate,
  pageLimit?: number
): {
  exceeds: boolean;
  overagePages: number;
  overagePercent: number;
  recommendation: string;
} {
  if (!pageLimit) {
    return {
      exceeds: false,
      overagePages: 0,
      overagePercent: 0,
      recommendation: 'No page limit specified',
    };
  }

  const exceeds = estimate.estimatedPages > pageLimit;
  const overagePages = Math.max(0, estimate.estimatedPages - pageLimit);
  const overagePercent = (overagePages / pageLimit) * 100;

  let recommendation = '';
  if (exceeds) {
    if (overagePercent < 10) {
      recommendation = 'Minor overage - reduce spacing or condense some sections';
    } else if (overagePercent < 25) {
      recommendation = 'Moderate overage - condense content and remove optional sections';
    } else {
      recommendation = 'Major overage - significant content reduction required';
    }
  } else {
    const remaining = pageLimit - estimate.estimatedPages;
    if (remaining > pageLimit * 0.2) {
      recommendation = `${remaining} pages remaining - consider expanding key sections`;
    } else {
      recommendation = 'Good fit within page limit';
    }
  }

  return {
    exceeds,
    overagePages,
    overagePercent,
    recommendation,
  };
}

/**
 * Generate page allocation summary
 */
export function generatePageAllocationSummary(
  volumeType: string,
  sections: any[],
  pageLimit?: number
): string {
  const lines: string[] = [];

  lines.push(`PAGE ALLOCATION SUMMARY - ${volumeType.toUpperCase()}`);
  lines.push('='.repeat(60));
  lines.push('');

  let totalPages = 0;

  for (const section of sections) {
    if (section.content && Array.isArray(section.content)) {
      const estimate = estimatePages(section.content);
      totalPages += estimate.estimatedPages;

      lines.push(`${section.title}:`);
      lines.push(`  Estimated pages: ${estimate.estimatedPages}`);
      lines.push(`  Words: ${estimate.words}`);
      lines.push(`  Paragraphs: ${estimate.paragraphs}`);
      if (estimate.headings > 0) {
        lines.push(`  Headings: ${estimate.headings}`);
      }
      if (estimate.tables > 0) {
        lines.push(`  Tables: ${estimate.tables}`);
      }
      lines.push('');
    }
  }

  lines.push('-'.repeat(60));
  lines.push(`TOTAL ESTIMATED PAGES: ${totalPages}`);
  
  if (pageLimit) {
    lines.push(`PAGE LIMIT: ${pageLimit}`);
    const check = checkPageLimit({ estimatedPages: totalPages } as PageEstimate, pageLimit);
    lines.push(`STATUS: ${check.exceeds ? '⚠️  EXCEEDS LIMIT' : '✅ WITHIN LIMIT'}`);
    if (check.exceeds) {
      lines.push(`OVERAGE: ${check.overagePages} pages (${check.overagePercent.toFixed(1)}%)`);
    }
    lines.push(`RECOMMENDATION: ${check.recommendation}`);
  }

  lines.push('');

  return lines.join('\n');
}

/**
 * Estimate number of pages for a section based on content
 * Used for calculating page numbers in compliance matrix
 */
export function estimateSectionPages(
  sectionContent: string | Paragraph[],
  hasExhibits: boolean = false
): number {
  let pages = 0;

  if (typeof sectionContent === 'string') {
    // Estimate from character count
    pages = sectionContent.length / PAGE_CONSTANTS.CHARS_PER_PAGE;
  } else if (Array.isArray(sectionContent)) {
    // Estimate from paragraph count
    pages = sectionContent.length / PAGE_CONSTANTS.PARAGRAPHS_PER_PAGE;
  }

  // Add extra space for exhibits
  if (hasExhibits) {
    pages += 0.5;
  }

  // Round up to nearest 0.5
  return Math.ceil(pages * 2) / 2;
}

/**
 * Calculate page numbers for all sections based on cumulative content
 * Returns a map of section title to starting page number
 */
export function calculateSectionPageNumbers(
  sections: Array<{ title: string; content: any; hasExhibits?: boolean }>
): Map<string, number> {
  const pageMap = new Map<string, number>();

  // Starting page after front matter
  let currentPage =
    PAGE_CONSTANTS.COVER_PAGES +
    PAGE_CONSTANTS.TOC_PAGES +
    PAGE_CONSTANTS.COVER_LETTER_PAGES +
    1;

  for (const section of sections) {
    // Store the starting page for this section
    pageMap.set(section.title, currentPage);

    // Calculate pages for this section
    const sectionPages = estimateSectionPages(
      section.content,
      section.hasExhibits || false
    );

    // Move to next section's starting page
    currentPage += sectionPages;
  }

  return pageMap;
}

/**
 * Get page number for a section, with fuzzy matching
 * Returns null if no match found
 */
export function getSectionPageNumber(
  sectionTitle: string,
  pageMap: Map<string, number>
): number | null {
  // Direct match
  if (pageMap.has(sectionTitle)) {
    return pageMap.get(sectionTitle)!;
  }

  // Fuzzy match - normalize both strings and compare
  const normalizedTitle = sectionTitle.toLowerCase().trim();

  for (const [mapTitle, pageNumber] of pageMap.entries()) {
    const normalizedMapTitle = mapTitle.toLowerCase().trim();

    // Check if titles match (ignoring case and whitespace)
    if (normalizedMapTitle === normalizedTitle) {
      return pageNumber;
    }

    // Check if section title contains the map title or vice versa
    if (normalizedTitle.includes(normalizedMapTitle) ||
        normalizedMapTitle.includes(normalizedTitle)) {
      return pageNumber;
    }
  }

  return null;
}
