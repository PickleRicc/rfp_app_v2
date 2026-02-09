/**
 * Outline View Generator (Framework Part 9.2 OUTLINE_VIEW)
 *
 * Extracts document structure for quick review.
 * Supports 4 heading levels with page estimates and exhibit tracking.
 */

export interface OutlineItem {
  level: number; // 1-4 for heading levels
  title: string;
  pageEstimate?: number;
  children?: OutlineItem[];
  sectionType?: 'volume' | 'section' | 'subsection' | 'exhibit';
}

export interface OutlineResult {
  volumeTitle: string;
  items: OutlineItem[];
  totalPages: number;
  exhibitCount: number;
}

export interface SectionInput {
  title: string;
  level: number;
  content?: unknown[];
  hasExhibit?: boolean;
}

/**
 * Extract outline from document content
 * Parses heading levels to create hierarchical structure
 *
 * @param volumeTitle Title of the volume being outlined
 * @param sections Array of section definitions with levels
 * @param pageEstimates Optional map of section title to page estimate
 * @returns OutlineResult with hierarchical items and summary stats
 */
export function generateOutline(
  volumeTitle: string,
  sections: SectionInput[],
  pageEstimates?: Map<string, number>
): OutlineResult {
  const items: OutlineItem[] = [];
  let currentL1: OutlineItem | null = null;
  let currentL2: OutlineItem | null = null;
  let currentL3: OutlineItem | null = null;
  let exhibitCount = 0;

  for (const section of sections) {
    const item: OutlineItem = {
      level: section.level,
      title: section.title,
      pageEstimate: pageEstimates?.get(section.title),
      sectionType: getSectionType(section.level, section.hasExhibit),
    };

    if (section.hasExhibit) {
      exhibitCount++;
    }

    // Build hierarchy based on heading level
    switch (section.level) {
      case 1:
        items.push(item);
        currentL1 = item;
        currentL2 = null;
        currentL3 = null;
        break;
      case 2:
        if (currentL1) {
          if (!currentL1.children) currentL1.children = [];
          currentL1.children.push(item);
          currentL2 = item;
          currentL3 = null;
        } else {
          items.push(item);
        }
        break;
      case 3:
        if (currentL2) {
          if (!currentL2.children) currentL2.children = [];
          currentL2.children.push(item);
          currentL3 = item;
        } else if (currentL1) {
          if (!currentL1.children) currentL1.children = [];
          currentL1.children.push(item);
        } else {
          items.push(item);
        }
        break;
      case 4:
        if (currentL3) {
          if (!currentL3.children) currentL3.children = [];
          currentL3.children.push(item);
        } else if (currentL2) {
          if (!currentL2.children) currentL2.children = [];
          currentL2.children.push(item);
        } else if (currentL1) {
          if (!currentL1.children) currentL1.children = [];
          currentL1.children.push(item);
        } else {
          items.push(item);
        }
        break;
    }
  }

  // Calculate total pages from all items
  const totalPages = calculateTotalPages(items);

  return {
    volumeTitle,
    items,
    totalPages,
    exhibitCount,
  };
}

/**
 * Determine section type based on level and exhibit presence
 */
function getSectionType(
  level: number,
  hasExhibit?: boolean
): 'volume' | 'section' | 'subsection' | 'exhibit' {
  if (hasExhibit) return 'exhibit';
  if (level === 1) return 'volume';
  if (level === 2) return 'section';
  return 'subsection';
}

/**
 * Recursively calculate total pages from outline items
 */
function calculateTotalPages(items: OutlineItem[]): number {
  let total = 0;
  for (const item of items) {
    if (item.pageEstimate) {
      total += item.pageEstimate;
    }
    if (item.children) {
      total += calculateTotalPages(item.children);
    }
  }
  return Math.ceil(total);
}

/**
 * Format outline as text for display or export
 *
 * @param outline OutlineResult to format
 * @returns Multi-line string representation of outline
 */
export function formatOutlineAsText(outline: OutlineResult): string {
  const lines: string[] = [];

  lines.push(`OUTLINE: ${outline.volumeTitle}`);
  lines.push('='.repeat(60));
  lines.push('');

  function formatItem(item: OutlineItem, indent: number = 0) {
    const prefix = '  '.repeat(indent);
    const levelMarker = getLevelMarker(item.level);
    const pageInfo = item.pageEstimate ? ` (p. ${item.pageEstimate})` : '';
    const exhibitMarker = item.sectionType === 'exhibit' ? ' [EXHIBIT]' : '';

    lines.push(`${prefix}${levelMarker}${item.title}${pageInfo}${exhibitMarker}`);

    if (item.children) {
      for (const child of item.children) {
        formatItem(child, indent + 1);
      }
    }
  }

  for (const item of outline.items) {
    formatItem(item);
  }

  lines.push('');
  lines.push('-'.repeat(60));
  lines.push(`Total Pages: ${outline.totalPages}`);
  lines.push(`Exhibits: ${outline.exhibitCount}`);

  return lines.join('\n');
}

/**
 * Get visual marker for heading level in text output
 */
function getLevelMarker(level: number): string {
  switch (level) {
    case 1:
      return '';
    case 2:
      return '  ';
    case 3:
      return '    - ';
    case 4:
      return '      * ';
    default:
      return '        ';
  }
}

/**
 * Get flat list of all sections with their page estimates
 * Useful for generating table of contents or summary reports
 */
export function flattenOutline(outline: OutlineResult): Array<{
  title: string;
  level: number;
  pageEstimate?: number;
  sectionType?: string;
}> {
  const result: Array<{
    title: string;
    level: number;
    pageEstimate?: number;
    sectionType?: string;
  }> = [];

  function flatten(items: OutlineItem[]) {
    for (const item of items) {
      result.push({
        title: item.title,
        level: item.level,
        pageEstimate: item.pageEstimate,
        sectionType: item.sectionType,
      });
      if (item.children) {
        flatten(item.children);
      }
    }
  }

  flatten(outline.items);
  return result;
}
