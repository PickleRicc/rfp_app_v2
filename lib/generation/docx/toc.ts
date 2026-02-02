/**
 * Dynamic Table of Contents Generation for DOCX Documents
 *
 * Generates auto-updating Table of Contents and Table of Exhibits using Word
 * field codes. When the user opens the document in Word and refreshes fields
 * (Ctrl+A, F9), the TOC will update with accurate page numbers.
 *
 * IMPORTANT: For the TOC to auto-update, the Document must be created with:
 * ```typescript
 * new Document({
 *   features: {
 *     updateFields: true, // Required for TOC auto-update
 *   },
 *   // ... other options
 * });
 * ```
 *
 * @module lib/generation/docx/toc
 */

import {
  Paragraph,
  TableOfContents,
  HeadingLevel,
  PageBreak,
  TextRun,
  AlignmentType,
  type FileChild,
} from 'docx';

/**
 * Type for TOC section elements - can be Paragraph or TableOfContents
 * Both extend FileChild and can be used in section.children
 */
export type TOCSectionChild = Paragraph | TableOfContents;

/**
 * Configuration options for Table of Contents generation
 */
export interface TOCOptions {
  /** Heading levels to include (default: '1-3' for H1-H3) */
  headingStyleRange?: string;
  /** Enable hyperlinks in TOC entries (default: true) */
  hyperlink?: boolean;
  /** Custom title for TOC (default: 'TABLE OF CONTENTS') */
  title?: string;
}

/**
 * Configuration options for Table of Exhibits generation
 */
export interface TableOfExhibitsOptions {
  /** Caption label to include (e.g., 'Figure', 'Table') */
  captionLabel?: string;
  /** Include numbering with caption label (default: true) */
  includeNumbers?: boolean;
  /** Custom title for Table of Exhibits (default: 'TABLE OF EXHIBITS') */
  title?: string;
}

/**
 * Default TOC options per user decisions
 */
const DEFAULT_TOC_OPTIONS: Required<TOCOptions> = {
  headingStyleRange: '1-3', // 3 levels per user decision
  hyperlink: true,
  title: 'TABLE OF CONTENTS',
};

/**
 * Default Table of Exhibits options
 */
const DEFAULT_EXHIBITS_OPTIONS: Required<TableOfExhibitsOptions> = {
  captionLabel: 'Figure',
  includeNumbers: true,
  title: 'TABLE OF EXHIBITS',
};

/**
 * Generate a Table of Contents that auto-updates when user refreshes fields in Word
 *
 * The TOC uses Word field codes (TOC instruction) which means:
 * - Page numbers are calculated by Word, not hardcoded
 * - User can update by selecting all (Ctrl+A) and pressing F9
 * - Links are clickable if hyperlink option is enabled
 *
 * @param options - Configuration options for TOC generation
 * @returns Array of FileChild elements (Paragraph and TableOfContents) for section.children
 *
 * @example
 * ```typescript
 * const tocParagraphs = generateTableOfContents();
 * // Include in document sections.children
 * ```
 *
 * @remarks
 * The parent Document MUST have `features: { updateFields: true }` for the TOC
 * to prompt Word to update field codes on open.
 */
export function generateTableOfContents(options?: TOCOptions): TOCSectionChild[] {
  const opts = { ...DEFAULT_TOC_OPTIONS, ...options };
  const elements: TOCSectionChild[] = [];

  // TOC Title
  elements.push(
    new Paragraph({
      children: [
        new TextRun({
          text: opts.title,
          bold: true,
          size: 28, // 14pt
          font: 'Arial',
        }),
      ],
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    })
  );

  // Instruction for users about updating TOC
  elements.push(
    new Paragraph({
      children: [
        new TextRun({
          text: '[Right-click this table and select "Update Field" to refresh page numbers]',
          italics: true,
          size: 18, // 9pt
          color: '666666',
          font: 'Arial',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
    })
  );

  // Dynamic Table of Contents using Word field codes
  elements.push(
    new TableOfContents('Table of Contents', {
      hyperlink: opts.hyperlink,
      headingStyleRange: opts.headingStyleRange,
      stylesWithLevels: [
        { styleName: 'Heading1', level: 1 },
        { styleName: 'Heading2', level: 2 },
        { styleName: 'Heading3', level: 3 },
      ],
    })
  );

  return elements;
}

/**
 * Generate a Table of Exhibits (List of Figures/Tables)
 *
 * Creates an auto-updating list of all figures, tables, or other captioned
 * elements in the document. Uses Word's SEQ field codes for numbering.
 *
 * @param options - Configuration options for Table of Exhibits
 * @returns Array of FileChild elements (Paragraph and TableOfContents) for section.children
 *
 * @example
 * ```typescript
 * // Generate list of figures
 * const figuresList = generateTableOfExhibits({ captionLabel: 'Figure' });
 *
 * // Generate list of tables
 * const tablesList = generateTableOfExhibits({ captionLabel: 'Table' });
 * ```
 *
 * @remarks
 * For exhibits to appear, document elements must use proper caption styles
 * with SEQ fields (e.g., "Figure 1: Description" or "Table 1: Data Summary")
 */
export function generateTableOfExhibits(
  options?: TableOfExhibitsOptions
): TOCSectionChild[] {
  const opts = { ...DEFAULT_EXHIBITS_OPTIONS, ...options };
  const elements: TOCSectionChild[] = [];

  // Exhibits Title (H2 per user decision - placed within TOC section)
  elements.push(
    new Paragraph({
      children: [
        new TextRun({
          text: opts.title,
          bold: true,
          size: 24, // 12pt
          font: 'Arial',
        }),
      ],
      heading: HeadingLevel.HEADING_2,
      alignment: AlignmentType.CENTER,
      spacing: { before: 400, after: 240 },
    })
  );

  // Instruction for users
  elements.push(
    new Paragraph({
      children: [
        new TextRun({
          text: '[Update fields to populate figures and tables]',
          italics: true,
          size: 18, // 9pt
          color: '666666',
          font: 'Arial',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
    })
  );

  // Table of Contents for Figures using caption label
  elements.push(
    new TableOfContents('List of Exhibits', {
      captionLabelIncludingNumbers: opts.captionLabel,
      hyperlink: true,
    })
  );

  return elements;
}

/**
 * Generate combined TOC section with Table of Contents and Table of Exhibits
 *
 * Creates a complete TOC section including:
 * 1. Table of Contents (headings H1-H3)
 * 2. Page break
 * 3. Table of Exhibits (figures and tables)
 * 4. Page break (ready for main content)
 *
 * @returns Array of FileChild elements for the complete TOC section
 *
 * @example
 * ```typescript
 * const doc = new Document({
 *   features: { updateFields: true }, // REQUIRED for TOC
 *   sections: [{
 *     children: [
 *       ...generateCoverPage(),
 *       new Paragraph({ children: [new PageBreak()] }),
 *       ...generateTOCSection(), // <-- This function
 *       ...generateContentSections(),
 *     ]
 *   }]
 * });
 * ```
 *
 * @remarks
 * This function is the recommended way to add TOC and exhibits list to a document.
 * Individual generateTableOfContents and generateTableOfExhibits functions are
 * available for custom layouts.
 */
export function generateTOCSection(): TOCSectionChild[] {
  const elements: TOCSectionChild[] = [];

  // Table of Contents
  elements.push(...generateTableOfContents());

  // Page break after TOC
  elements.push(new Paragraph({ children: [new PageBreak()] }));

  // Table of Exhibits (Figures)
  elements.push(...generateTableOfExhibits({ captionLabel: 'Figure' }));

  // Optionally add Table list if needed in future
  // elements.push(...generateTableOfExhibits({
  //   captionLabel: 'Table',
  //   title: 'LIST OF TABLES'
  // }));

  // Page break ready for content
  elements.push(new Paragraph({ children: [new PageBreak()] }));

  return elements;
}

/**
 * Generate a minimal TOC section (just Table of Contents, no exhibits)
 *
 * Useful for shorter documents that don't have figures or tables.
 *
 * @param options - Configuration options for TOC generation
 * @returns Array of FileChild elements with TOC and page break
 */
export function generateMinimalTOCSection(options?: TOCOptions): TOCSectionChild[] {
  const elements: TOCSectionChild[] = [];

  elements.push(...generateTableOfContents(options));
  elements.push(new Paragraph({ children: [new PageBreak()] }));

  return elements;
}
