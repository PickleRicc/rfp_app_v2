/**
 * Markdown-to-DOCX Parser
 *
 * Converts Claude's markdown output into professionally styled docx Paragraph/Table
 * objects using the full PROPOSAL_STYLES palette. This replaces the naive
 * markdownToContentStructure() that was flattening everything into plain BodyText11pt.
 *
 * Handles:
 *   - Headings (H1-H4)             → HeadingLevel with hierarchical numbering
 *   - Bold / Italic / Bold+Italic  → Styled TextRun segments
 *   - Bullet lists (-, *, nested)   → Bullet1/2/3 styles
 *   - Numbered lists (1. 2. 3.)     → Numbered list numbering
 *   - Blockquotes (>)               → CalloutBox style
 *   - Markdown tables (| col |)     → Word Table with TableHeading/TableText styles
 *   - Win theme markers             → Blue-bordered callout table
 *   - [PLACEHOLDER: ...] markers    → Highlighted italic TextRun
 *   - Horizontal rules (---)        → Section spacing / visual break
 *   - Regular paragraphs            → BodyText11pt with inline formatting
 */

import {
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ShadingType,
  AlignmentType,
} from 'docx';
import { getHeadingNumbering, shouldOmitNumbering } from './numbering';
import { type ProposalColorPalette, DEFAULT_PALETTE } from './colors';

// ===== TYPES =====

/** A parsed content element — either a Paragraph or a Table */
type DocxElement = Paragraph | Table;

/** Parsed section with title and styled content elements */
export interface ParsedSection {
  title: string;
  content: DocxElement[];
}

/** Result of parsing a full markdown document */
export interface ParsedMarkdownDocument {
  sections: ParsedSection[];
}

// ===== INLINE FORMATTING =====

/**
 * Parse inline markdown formatting into an array of TextRun objects.
 * Handles: **bold**, *italic*, ***bold+italic***, and [PLACEHOLDER: ...] markers.
 *
 * The regex splits text on bold/italic markers while preserving the marked segments.
 */
function parseInlineFormatting(text: string, baseSizeHalfPts: number = 22): TextRun[] {
  const runs: TextRun[] = [];

  // First, handle [PLACEHOLDER: ...] markers by splitting around them
  const placeholderRegex = /(\[PLACEHOLDER:[^\]]*\])/g;
  const placeholderParts = text.split(placeholderRegex);

  for (const part of placeholderParts) {
    if (!part) continue;

    // Check if this part is a placeholder
    if (part.startsWith('[PLACEHOLDER:')) {
      runs.push(
        new TextRun({
          text: part,
          size: baseSizeHalfPts,
          font: 'Arial',
          italics: true,
          color: 'b45309', // amber-700 — stands out without being garish
          highlight: 'yellow',
        })
      );
      continue;
    }

    // Process bold/italic markdown within this non-placeholder segment
    // Pattern: ***bold+italic***, **bold**, *italic*
    // We process in order: bold+italic first, then bold, then italic
    const formattingRegex = /(\*\*\*.*?\*\*\*|\*\*.*?\*\*|\*[^*]+?\*)/g;
    const segments = part.split(formattingRegex);

    for (const segment of segments) {
      if (!segment) continue;

      if (segment.startsWith('***') && segment.endsWith('***')) {
        // Bold + Italic
        runs.push(
          new TextRun({
            text: segment.slice(3, -3),
            size: baseSizeHalfPts,
            font: 'Arial',
            bold: true,
            italics: true,
          })
        );
      } else if (segment.startsWith('**') && segment.endsWith('**')) {
        // Bold
        runs.push(
          new TextRun({
            text: segment.slice(2, -2),
            size: baseSizeHalfPts,
            font: 'Arial',
            bold: true,
          })
        );
      } else if (segment.startsWith('*') && segment.endsWith('*') && segment.length > 2) {
        // Italic
        runs.push(
          new TextRun({
            text: segment.slice(1, -1),
            size: baseSizeHalfPts,
            font: 'Arial',
            italics: true,
          })
        );
      } else {
        // Plain text
        runs.push(
          new TextRun({
            text: segment,
            size: baseSizeHalfPts,
            font: 'Arial',
          })
        );
      }
    }
  }

  return runs;
}

// ===== WIN THEME CALLOUT TABLE =====

/**
 * Create a professional win theme callout table matching v1's createThemeCalloutBox style.
 * Blue border, light blue background, theme title + body text.
 */
function createWinThemeCallout(title: string, body: string, palette: ProposalColorPalette): Table {
  const cellContent: Paragraph[] = [];

  // Theme heading
  cellContent.push(
    new Paragraph({
      children: [
        new TextRun({
          text: title,
          bold: true,
          size: 24, // 12pt
          color: palette.primary,
          font: 'Arial',
        }),
      ],
      spacing: { after: 120 },
    })
  );

  // Theme body text
  if (body.trim()) {
    cellContent.push(
      new Paragraph({
        children: parseInlineFormatting(body.trim()),
        spacing: { after: 60 },
      })
    );
  }

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 15, color: palette.primary },
      bottom: { style: BorderStyle.SINGLE, size: 15, color: palette.primary },
      left: { style: BorderStyle.SINGLE, size: 15, color: palette.primary },
      right: { style: BorderStyle.SINGLE, size: 15, color: palette.primary },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: cellContent,
            shading: {
              fill: palette.primaryLight.toLowerCase(),
              type: ShadingType.CLEAR,
            },
            margins: {
              top: 200,
              bottom: 200,
              left: 200,
              right: 200,
            },
          }),
        ],
      }),
    ],
  });
}

// ===== MARKDOWN TABLE PARSER =====

/**
 * Parse a markdown table (array of pipe-delimited lines) into a styled Word Table.
 * First row becomes the header (white text on blue background).
 */
function parseMarkdownTable(lines: string[], palette: ProposalColorPalette): Table {
  // Parse rows — skip separator rows (|---|---|)
  const dataRows: string[][] = [];
  for (const line of lines) {
    const cells = line
      .split('|')
      .map(c => c.trim())
      .filter(c => c !== '');

    // Skip separator rows
    if (cells.every(c => /^[-: ]+$/.test(c))) continue;

    dataRows.push(cells);
  }

  if (dataRows.length === 0) {
    return new Table({ rows: [new TableRow({ children: [new TableCell({ children: [new Paragraph({ text: '' })] })] })] });
  }

  // Determine column count from the widest row
  const colCount = Math.max(...dataRows.map(r => r.length));

  // Build Word table rows
  const tableRows: TableRow[] = dataRows.map((rowCells, rowIndex) => {
    const isHeader = rowIndex === 0;

    // Pad row to full column count
    while (rowCells.length < colCount) {
      rowCells.push('');
    }

    return new TableRow({
      tableHeader: isHeader,
      children: rowCells.map(cellText =>
        new TableCell({
          children: [
            new Paragraph({
              children: parseInlineFormatting(
                cellText,
                20 // 10pt for table text
              ),
              alignment: isHeader ? AlignmentType.CENTER : AlignmentType.LEFT,
            }),
          ],
          shading: isHeader
            ? { fill: palette.tableHeaderBg, type: ShadingType.CLEAR }
            : undefined,
        })
      ),
    });
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: '94a3b8' },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: '94a3b8' },
      left: { style: BorderStyle.SINGLE, size: 4, color: '94a3b8' },
      right: { style: BorderStyle.SINGLE, size: 4, color: '94a3b8' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: '94a3b8' },
      insideVertical: { style: BorderStyle.SINGLE, size: 4, color: '94a3b8' },
    },
    rows: tableRows,
  });
}

// ===== BLOCK-LEVEL PARSING =====

/**
 * Determine the bullet nesting level from leading whitespace.
 * 0 spaces = level 0, 2-3 spaces = level 1, 4+ spaces = level 2.
 */
function getBulletLevel(line: string): number {
  const leadingSpaces = line.match(/^(\s*)/)?.[1]?.length || 0;
  if (leadingSpaces >= 4) return 2;
  if (leadingSpaces >= 2) return 1;
  return 0;
}

/**
 * Parse a full markdown string into an array of styled DocxElement objects.
 * This is the core block-level parser.
 */
function parseMarkdownBlocks(markdown: string, palette: ProposalColorPalette): DocxElement[] {
  const elements: DocxElement[] = [];
  const lines = markdown.split('\n');

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trimEnd();

    // ── Empty line → skip (paragraph spacing handles gaps) ──
    if (trimmed.trim() === '') {
      i++;
      continue;
    }

    // ── Win Theme callout block ──
    // Format: === WIN THEME: {title} ===
    //         {body lines}
    //         ======================== (or === END WIN THEME ===)
    if (trimmed.match(/^={3,}\s*WIN THEME:\s*(.+?)\s*={3,}$/i)) {
      const themeTitle = trimmed.match(/WIN THEME:\s*(.+?)\s*={3,}$/i)?.[1] || 'Win Theme';
      const bodyLines: string[] = [];
      i++;
      while (i < lines.length) {
        const nextLine = lines[i].trimEnd();
        if (nextLine.match(/^={3,}/) || nextLine.match(/===\s*END\s*WIN\s*THEME\s*===/i)) {
          i++; // skip closing marker
          break;
        }
        bodyLines.push(nextLine);
        i++;
      }
      elements.push(createWinThemeCallout(themeTitle, bodyLines.join('\n'), palette));
      // Spacing after callout
      elements.push(new Paragraph({ text: '', spacing: { after: 240 } }));
      continue;
    }

    // ── Horizontal rule (--- or ***) → visual spacer ──
    if (trimmed.match(/^(-{3,}|\*{3,}|_{3,})$/)) {
      elements.push(
        new Paragraph({
          text: '',
          spacing: { before: 240, after: 240 },
          border: {
            bottom: {
              color: 'cbd5e1', // slate-300
              space: 1,
              style: BorderStyle.SINGLE,
              size: 6,
            },
          },
        })
      );
      i++;
      continue;
    }

    // ── Headings ──
    const h4Match = trimmed.match(/^####\s+(.+)$/);
    if (h4Match) {
      const headingText = h4Match[1];
      const useNumbering = !shouldOmitNumbering(headingText);
      elements.push(
        new Paragraph({
          children: parseInlineFormatting(headingText, 22),
          heading: HeadingLevel.HEADING_4,
          numbering: useNumbering ? getHeadingNumbering(4) : undefined,
        })
      );
      i++;
      continue;
    }

    const h3Match = trimmed.match(/^###\s+(.+)$/);
    if (h3Match) {
      const headingText = h3Match[1];
      const useNumbering = !shouldOmitNumbering(headingText);
      elements.push(
        new Paragraph({
          children: parseInlineFormatting(headingText, 24),
          heading: HeadingLevel.HEADING_3,
          numbering: useNumbering ? getHeadingNumbering(3) : undefined,
        })
      );
      i++;
      continue;
    }

    const h2Match = trimmed.match(/^##\s+(.+)$/);
    if (h2Match) {
      const headingText = h2Match[1];
      const useNumbering = !shouldOmitNumbering(headingText);
      elements.push(
        new Paragraph({
          children: parseInlineFormatting(headingText, 28),
          heading: HeadingLevel.HEADING_2,
          numbering: useNumbering ? getHeadingNumbering(2) : undefined,
        })
      );
      i++;
      continue;
    }

    const h1Match = trimmed.match(/^#\s+(.+)$/);
    if (h1Match) {
      const headingText = h1Match[1];
      const useNumbering = !shouldOmitNumbering(headingText);
      elements.push(
        new Paragraph({
          children: parseInlineFormatting(headingText, 32),
          heading: HeadingLevel.HEADING_1,
          numbering: useNumbering ? getHeadingNumbering(1) : undefined,
        })
      );
      i++;
      continue;
    }

    // ── Blockquote (>) → CalloutBox style ──
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trimEnd().startsWith('>')) {
        quoteLines.push(lines[i].trimEnd().replace(/^>\s?/, ''));
        i++;
      }
      const quoteText = quoteLines.join(' ').trim();
      elements.push(
        new Paragraph({
          children: parseInlineFormatting(quoteText, 20),
          style: 'CalloutBox',
        })
      );
      continue;
    }

    // ── Markdown table (| col | col |) ──
    if (trimmed.startsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trimEnd().startsWith('|')) {
        tableLines.push(lines[i].trimEnd());
        i++;
      }
      if (tableLines.length > 0) {
        elements.push(parseMarkdownTable(tableLines, palette));
        // Spacing after table
        elements.push(new Paragraph({ text: '', spacing: { after: 240 } }));
      }
      continue;
    }

    // ── Numbered list (1. 2. 3.) ──
    const numberedMatch = trimmed.match(/^\s*(\d+)\.\s+(.+)$/);
    if (numberedMatch) {
      // Determine nesting level from indentation
      const indent = getBulletLevel(line);
      elements.push(
        new Paragraph({
          children: parseInlineFormatting(numberedMatch[2]),
          numbering: { reference: 'numbered-list', level: indent },
          spacing: { after: 60 },
        })
      );
      i++;
      continue;
    }

    // ── Bullet list (- or *) ──
    const bulletMatch = trimmed.match(/^\s*[-*]\s+(.+)$/);
    if (bulletMatch) {
      const level = getBulletLevel(line);
      elements.push(
        new Paragraph({
          children: parseInlineFormatting(bulletMatch[1]),
          bullet: { level },
          spacing: { after: 60 },
          style: level === 0 ? 'Bullet1' : level === 1 ? 'Bullet2' : 'Bullet3',
        })
      );
      i++;
      continue;
    }

    // ── Regular paragraph ──
    // Accumulate consecutive non-blank, non-special lines into one paragraph
    const paraLines: string[] = [];
    while (i < lines.length) {
      const pLine = lines[i].trimEnd();
      const pTrimmed = pLine.trim();

      // Stop on blank lines, headings, bullets, blockquotes, tables, HRs, win themes
      if (
        pTrimmed === '' ||
        pTrimmed.match(/^#{1,4}\s/) ||
        pTrimmed.match(/^\s*[-*]\s+/) ||
        pTrimmed.match(/^\s*\d+\.\s+/) ||
        pTrimmed.startsWith('>') ||
        pTrimmed.startsWith('|') ||
        pTrimmed.match(/^(-{3,}|\*{3,}|_{3,})$/) ||
        pTrimmed.match(/^={3,}\s*WIN THEME/i)
      ) {
        break;
      }

      paraLines.push(pTrimmed);
      i++;
    }

    if (paraLines.length > 0) {
      const fullText = paraLines.join(' ');
      elements.push(
        new Paragraph({
          children: parseInlineFormatting(fullText),
          style: 'BodyText11pt',
          spacing: { after: 200 },
        })
      );
    }
  }

  return elements;
}

// ===== PUBLIC API =====

/**
 * Parse Claude's markdown output into structured sections with styled DOCX elements.
 *
 * Splits on H1 headings to create top-level sections (matching the interface
 * expected by generateProposalVolume's generateSections function), then parses
 * all block-level content within each section into proper Paragraph/Table objects.
 *
 * @param markdownContent - Raw markdown string from Claude's response
 * @returns ParsedMarkdownDocument with sections containing styled DocxElement arrays
 */
export function parseMarkdownToDocx(markdownContent: string, palette?: ProposalColorPalette): ParsedMarkdownDocument {
  const p = palette || DEFAULT_PALETTE;
  const lines = markdownContent.split('\n');
  const sections: ParsedSection[] = [];

  let currentTitle = 'Introduction';
  let currentLines: string[] = [];

  for (const line of lines) {
    const h1Match = line.match(/^# (.+)$/);

    if (h1Match) {
      // Flush previous section
      if (currentLines.length > 0) {
        const content = currentLines.join('\n').trim();
        if (content) {
          sections.push({
            title: currentTitle,
            content: parseMarkdownBlocks(content, p),
          });
        }
      }
      currentTitle = h1Match[1].trim();
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }

  // Flush final section
  if (currentLines.length > 0) {
    const content = currentLines.join('\n').trim();
    if (content) {
      sections.push({
        title: currentTitle,
        content: parseMarkdownBlocks(content, p),
      });
    }
  }

  // If no H1 headings were found, try splitting on H2 instead
  if (sections.length === 0) {
    let currentH2Title = 'Main Content';
    let currentH2Lines: string[] = [];

    for (const line of lines) {
      const h2Match = line.match(/^## (.+)$/);
      if (h2Match) {
        if (currentH2Lines.length > 0) {
          const content = currentH2Lines.join('\n').trim();
          if (content) {
            sections.push({
              title: currentH2Title,
              content: parseMarkdownBlocks(content, p),
            });
          }
        }
        currentH2Title = h2Match[1].trim();
        currentH2Lines = [];
      } else {
        currentH2Lines.push(line);
      }
    }

    if (currentH2Lines.length > 0) {
      const content = currentH2Lines.join('\n').trim();
      if (content) {
        sections.push({
          title: currentH2Title,
          content: parseMarkdownBlocks(content, p),
        });
      }
    }
  }

  // Last resort: treat entire content as one section
  if (sections.length === 0) {
    sections.push({
      title: 'Main Content',
      content: parseMarkdownBlocks(markdownContent.trim(), p),
    });
  }

  return { sections };
}
