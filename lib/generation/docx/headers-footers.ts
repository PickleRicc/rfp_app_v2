/**
 * Header and Footer Generators for Proposal Documents
 *
 * Creates professional headers with company logo, volume title, and solicitation number.
 * Creates footers with proprietary notice and page numbers.
 * Provides empty variants for cover page (first page).
 *
 * @module lib/generation/docx/headers-footers
 */

import {
  Header,
  Footer,
  Paragraph,
  TextRun,
  ImageRun,
  PageNumber,
  TabStopType,
} from 'docx';

import { HEADER_LOGO_SIZE } from './images';

/**
 * Standard tab stop positions for header/footer alignment (in twips)
 * 1 inch = 1440 twips
 * - Left: 0 (default)
 * - Center: 4500 twips (~3.125 inches)
 * - Right: 9000 twips (~6.25 inches)
 */
const TAB_STOPS = {
  LEFT: 0,
  CENTER: 4500,
  RIGHT: 9000,
};

/**
 * Header/footer text styling constants
 */
const HEADER_FOOTER_FONT = 'Arial';
const HEADER_FOOTER_SIZE = 18; // 9pt (size is in half-points)
const PROPRIETARY_SIZE = 16; // 8pt for smaller proprietary notice
const PROPRIETARY_COLOR = '64748b'; // Subtle gray

/**
 * Proprietary notice text displayed in footer
 */
const PROPRIETARY_TEXT = 'PROPRIETARY - Use or disclosure subject to restrictions';

/**
 * Creates a professional proposal header with optional logo, volume title, and solicitation number.
 *
 * Layout: [Logo] [Volume Title] [Solicitation Number]
 * Uses tab stops for positioning:
 * - Logo (if provided): Left-aligned
 * - Volume title: Center position via tab
 * - Solicitation number: Right-aligned via tab
 *
 * @param logoBuffer - Buffer containing logo image data, or null to skip logo
 * @param volumeTitle - Title of the proposal volume (e.g., "Technical Volume")
 * @param solicitationNumber - Solicitation/RFP number (e.g., "FA8726-23-R-0001")
 * @returns Header object configured for proposal documents
 *
 * @example
 * ```typescript
 * import { createProposalHeader } from './headers-footers';
 * import { fetchLogoAsBuffer } from './images';
 *
 * const logoBuffer = await fetchLogoAsBuffer('https://example.com/logo.png');
 * const header = createProposalHeader(logoBuffer, 'Technical Volume', 'FA8726-23-R-0001');
 * ```
 */
export function createProposalHeader(
  logoBuffer: Buffer | null,
  volumeTitle: string,
  solicitationNumber: string
): Header {
  const children: (TextRun | ImageRun)[] = [];

  // Add logo if buffer is provided
  if (logoBuffer) {
    children.push(
      new ImageRun({
        data: logoBuffer,
        transformation: {
          width: HEADER_LOGO_SIZE.width,
          height: HEADER_LOGO_SIZE.height,
        },
        type: 'png',
      })
    );
  }

  // Tab to center position and add volume title
  children.push(
    new TextRun({
      text: '\t',
    }),
    new TextRun({
      text: volumeTitle,
      font: HEADER_FOOTER_FONT,
      size: HEADER_FOOTER_SIZE,
      bold: true,
    })
  );

  // Tab to right position and add solicitation number
  children.push(
    new TextRun({
      text: '\t',
    }),
    new TextRun({
      text: solicitationNumber,
      font: HEADER_FOOTER_FONT,
      size: HEADER_FOOTER_SIZE,
    })
  );

  return new Header({
    children: [
      new Paragraph({
        children,
        tabStops: [
          { type: TabStopType.CENTER, position: TAB_STOPS.CENTER },
          { type: TabStopType.RIGHT, position: TAB_STOPS.RIGHT },
        ],
        spacing: {
          after: 200, // Add space after header (200 twips ≈ 0.14 inch)
        },
        border: {
          bottom: {
            style: 'single' as const,
            size: 6, // thin line
            color: 'CCCCCC', // light gray
          },
        },
      }),
    ],
  });
}

/**
 * Creates a professional proposal footer with proprietary notice and page numbers.
 *
 * Layout: [Proprietary Notice] ... [Page X of Y]
 * - Left: Proprietary notice in small italic gray text
 * - Right: Page numbers using Word field codes for auto-updating
 *
 * @returns Footer object configured for proposal documents
 *
 * @example
 * ```typescript
 * import { createProposalFooter } from './headers-footers';
 *
 * const footer = createProposalFooter();
 * // Apply to document sections with { footers: { default: footer } }
 * ```
 */
export function createProposalFooter(): Footer {
  return new Footer({
    children: [
      new Paragraph({
        children: [
          // Proprietary notice - left aligned, small italic
          new TextRun({
            text: PROPRIETARY_TEXT,
            font: HEADER_FOOTER_FONT,
            italics: true,
            size: PROPRIETARY_SIZE,
            color: PROPRIETARY_COLOR,
          }),
          // Tab to right position
          new TextRun({
            text: '\t',
          }),
          // Page numbers - "Page X of Y"
          new TextRun({
            text: 'Page ',
            font: HEADER_FOOTER_FONT,
            size: HEADER_FOOTER_SIZE,
          }),
          new TextRun({
            children: [PageNumber.CURRENT],
            font: HEADER_FOOTER_FONT,
            size: HEADER_FOOTER_SIZE,
          }),
          new TextRun({
            text: ' of ',
            font: HEADER_FOOTER_FONT,
            size: HEADER_FOOTER_SIZE,
          }),
          new TextRun({
            children: [PageNumber.TOTAL_PAGES],
            font: HEADER_FOOTER_FONT,
            size: HEADER_FOOTER_SIZE,
          }),
        ],
        tabStops: [
          { type: TabStopType.RIGHT, position: TAB_STOPS.RIGHT },
        ],
      }),
    ],
  });
}

/**
 * Creates an empty header for cover page (first page).
 *
 * Cover pages should have no header content to maintain a clean appearance.
 * Use this with the first section's headers.first property.
 *
 * @returns Header with an empty paragraph
 *
 * @example
 * ```typescript
 * import { createEmptyHeader, createProposalHeader } from './headers-footers';
 *
 * // In document section config:
 * {
 *   headers: {
 *     first: createEmptyHeader(),  // Cover page - empty
 *     default: createProposalHeader(logo, title, solicitation),  // All other pages
 *   }
 * }
 * ```
 */
export function createEmptyHeader(): Header {
  return new Header({
    children: [new Paragraph({})],
  });
}

/**
 * Creates an empty footer for cover page (first page).
 *
 * Cover pages should have no footer content to maintain a clean appearance.
 * Use this with the first section's footers.first property.
 *
 * @returns Footer with an empty paragraph
 *
 * @example
 * ```typescript
 * import { createEmptyFooter, createProposalFooter } from './headers-footers';
 *
 * // In document section config:
 * {
 *   footers: {
 *     first: createEmptyFooter(),  // Cover page - empty
 *     default: createProposalFooter(),  // All other pages
 *   }
 * }
 * ```
 */
export function createEmptyFooter(): Footer {
  return new Footer({
    children: [new Paragraph({})],
  });
}
