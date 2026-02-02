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
