import { IStylesOptions, AlignmentType, BorderStyle } from 'docx';
import { type ProposalColorPalette, DEFAULT_PALETTE } from './colors';

/**
 * Build professional proposal document styles following the Proposal Response Generation Framework
 * Part 3: Writing Style System.
 *
 * Accepts an optional color palette to brand all styles with company colors.
 * Falls back to DEFAULT_PALETTE (blue) when no palette is provided.
 */
export function buildProposalStyles(palette: ProposalColorPalette = DEFAULT_PALETTE): IStylesOptions {
  return {
  paragraphStyles: [
    // Heading hierarchy (Part 3.1)
    {
      id: 'Heading1',
      name: 'Heading 1',
      basedOn: 'Normal',
      next: 'Normal',
      run: {
        size: 32, // 16pt
        bold: true,
        color: palette.primary, // Brand primary
      },
      paragraph: {
        spacing: { before: 480, after: 120 },
        keepNext: true,
        keepLines: true,
      },
    },
    {
      id: 'Heading2',
      name: 'Heading 2',
      basedOn: 'Normal',
      next: 'Normal',
      run: {
        size: 28, // 14pt
        bold: true,
        color: palette.primaryDark, // Brand dark
      },
      paragraph: {
        spacing: { before: 360, after: 120 },
        keepNext: true,
        keepLines: true,
      },
    },
    {
      id: 'Heading3',
      name: 'Heading 3',
      basedOn: 'Normal',
      next: 'Normal',
      run: {
        size: 24, // 12pt
        bold: true,
        color: '1e293b', // Dark gray
      },
      paragraph: {
        spacing: { before: 240, after: 120 },
        keepNext: true,
        keepLines: true,
      },
    },
    {
      id: 'Heading4',
      name: 'Heading 4',
      basedOn: 'Normal',
      next: 'Normal',
      run: {
        size: 22, // 11pt
        bold: true,
        color: '334155', // Gray
      },
      paragraph: {
        spacing: { before: 120, after: 60 },
        keepNext: true,
      },
    },
    // Body text styles (Part 3.2)
    {
      id: 'BodyText10pt',
      name: 'Body Text 10pt',
      basedOn: 'Normal',
      run: {
        size: 20, // 10pt = 20 half-points
        font: 'Arial',
      },
      paragraph: {
        spacing: { line: 276 }, // Single spacing
        alignment: AlignmentType.JUSTIFIED,
      },
    },
    {
      id: 'BodyText11pt',
      name: 'Body Text 11pt',
      basedOn: 'Normal',
      run: {
        size: 22, // 11pt = 22 half-points
        font: 'Arial',
      },
      paragraph: {
        spacing: { line: 276 },
        alignment: AlignmentType.JUSTIFIED,
      },
    },
    {
      id: 'BodyText12pt',
      name: 'Body Text 12pt',
      basedOn: 'Normal',
      run: {
        size: 24, // 12pt
        font: 'Arial',
      },
      paragraph: {
        spacing: { line: 276 },
        alignment: AlignmentType.JUSTIFIED,
      },
    },
    // Requirement box style (Part 2.1)
    {
      id: 'RFPBox',
      name: 'RFP Box',
      basedOn: 'Normal',
      run: {
        size: 20,
        font: 'Arial',
      },
      paragraph: {
        border: {
          top: {
            color: palette.primary,
            space: 1,
            style: BorderStyle.SINGLE,
            size: 6,
          },
          bottom: {
            color: palette.primary,
            space: 1,
            style: BorderStyle.SINGLE,
            size: 6,
          },
          left: {
            color: palette.primary,
            space: 1,
            style: BorderStyle.SINGLE,
            size: 6,
          },
          right: {
            color: palette.primary,
            space: 1,
            style: BorderStyle.SINGLE,
            size: 6,
          },
        },
        shading: {
          fill: palette.primaryLight, // Brand light background
        },
        spacing: { before: 120, after: 120 },
      },
    },
    {
      id: 'RFPBold',
      name: 'RFP Bold',
      basedOn: 'Normal',
      run: {
        size: 20,
        bold: true,
        font: 'Arial',
        color: palette.primary,
      },
      paragraph: {
        spacing: { before: 120, after: 60 },
      },
    },
    // Call-out box style (Part 4.2)
    {
      id: 'CalloutBox',
      name: 'Call-out Box',
      basedOn: 'Normal',
      run: {
        size: 20,
        font: 'Arial',
      },
      paragraph: {
        border: {
          left: {
            color: palette.primary,
            space: 1,
            style: BorderStyle.SINGLE,
            size: 12,
          },
        },
        shading: {
          fill: palette.primaryLight,
        },
        spacing: { before: 240, after: 240 },
        indent: { left: 240 },
      },
    },
    {
      id: 'CalloutBoxHeading',
      name: 'Call-out Box Heading',
      basedOn: 'Normal',
      run: {
        size: 22,
        bold: true,
        font: 'Arial',
        color: palette.primary,
      },
      paragraph: {
        spacing: { before: 60, after: 60 },
      },
    },
    // List styles (Part 3.3)
    {
      id: 'Bullet1',
      name: 'Bullet 1',
      basedOn: 'Normal',
      run: {
        size: 22,
        font: 'Arial',
      },
      paragraph: {
        spacing: { line: 276 },
        indent: { left: 360 },
      },
    },
    {
      id: 'Bullet2',
      name: 'Bullet 2',
      basedOn: 'Normal',
      run: {
        size: 22,
        font: 'Arial',
      },
      paragraph: {
        spacing: { line: 276 },
        indent: { left: 720 },
      },
    },
    {
      id: 'Bullet3',
      name: 'Bullet 3',
      basedOn: 'Normal',
      run: {
        size: 22,
        font: 'Arial',
      },
      paragraph: {
        spacing: { line: 276 },
        indent: { left: 1080 }, // Third level indent
      },
    },
    // Table bullet styles (Part 3.3)
    {
      id: 'TableBullet1_10pt',
      name: 'Table Bullet 1 10pt',
      basedOn: 'Normal',
      run: {
        size: 20, // 10pt
        font: 'Arial',
      },
      paragraph: {
        spacing: { line: 276 },
        indent: { left: 360 },
      },
    },
    {
      id: 'TableBullet1_11pt',
      name: 'Table Bullet 1 11pt',
      basedOn: 'Normal',
      run: {
        size: 22, // 11pt
        font: 'Arial',
      },
      paragraph: {
        spacing: { line: 276 },
        indent: { left: 360 },
      },
    },
    {
      id: 'TableBullet2_10pt',
      name: 'Table Bullet 2 10pt',
      basedOn: 'Normal',
      run: {
        size: 20, // 10pt
        font: 'Arial',
      },
      paragraph: {
        spacing: { line: 276 },
        indent: { left: 720 }, // Second level indent
      },
    },
    // Heading variants (Part 3.1)
    {
      id: 'Heading1SamePage',
      name: 'Heading 1 Same Page',
      basedOn: 'Normal',
      next: 'Normal',
      run: {
        size: 32, // 16pt
        bold: true,
        color: palette.primary, // Brand primary
        font: 'Arial',
      },
      paragraph: {
        spacing: { before: 480, after: 120 },
        // No keepNext/keepLines to allow same page behavior
      },
    },
    {
      id: 'Heading1Unnumbered',
      name: 'Heading 1 Unnumbered',
      basedOn: 'Normal',
      next: 'Normal',
      run: {
        size: 32, // 16pt
        bold: true,
        color: palette.primary, // Brand primary
        font: 'Arial',
      },
      paragraph: {
        spacing: { before: 480, after: 120 },
        keepNext: true,
        keepLines: true,
      },
    },
    {
      id: 'Heading2NewPage',
      name: 'Heading 2 New Page',
      basedOn: 'Normal',
      next: 'Normal',
      run: {
        size: 28, // 14pt
        bold: true,
        color: palette.primaryDark, // Brand dark
        font: 'Arial',
      },
      paragraph: {
        spacing: { before: 360, after: 120 },
        keepNext: true,
        keepLines: true,
        // Note: pageBreakBefore must be applied when creating Paragraph, not in style definition
      },
    },
    // Emphasis styles (Part 3.2)
    {
      id: 'IntenseQuote',
      name: 'Intense Quote',
      basedOn: 'Normal',
      run: {
        size: 22, // 11pt
        italics: true,
        font: 'Arial',
      },
      paragraph: {
        border: {
          left: {
            color: palette.primary,
            space: 1,
            style: BorderStyle.SINGLE,
            size: 6,
          },
        },
        shading: {
          fill: palette.primaryLight, // Light blue background
        },
        spacing: { before: 120, after: 120 },
        indent: { left: 360 },
      },
    },
    // Table text styles (Part 3.4)
    {
      id: 'TableHeading10pt',
      name: 'Table Heading 10pt',
      basedOn: 'Normal',
      run: {
        size: 20, // 10pt
        bold: true,
        font: 'Arial',
        color: 'FFFFFF', // White text
      },
      paragraph: {
        alignment: AlignmentType.CENTER,
      },
    },
    {
      id: 'TableHeading10ptLeft',
      name: 'Table Heading 10pt Left',
      basedOn: 'Normal',
      run: {
        size: 20, // 10pt
        bold: true,
        font: 'Arial',
        color: 'FFFFFF', // White text
      },
      paragraph: {
        alignment: AlignmentType.LEFT,
      },
    },
    {
      id: 'TableHeading10ptRight',
      name: 'Table Heading 10pt Right',
      basedOn: 'Normal',
      run: {
        size: 20, // 10pt
        bold: true,
        font: 'Arial',
        color: 'FFFFFF', // White text
      },
      paragraph: {
        alignment: AlignmentType.RIGHT,
      },
    },
    {
      id: 'TableHeading11pt',
      name: 'Table Heading 11pt',
      basedOn: 'Normal',
      run: {
        size: 22, // 11pt
        bold: true,
        font: 'Arial',
        color: 'FFFFFF', // White text
      },
      paragraph: {
        alignment: AlignmentType.CENTER,
      },
    },
    {
      id: 'TableHeading11ptLeft',
      name: 'Table Heading 11pt Left',
      basedOn: 'Normal',
      run: {
        size: 22, // 11pt
        bold: true,
        font: 'Arial',
        color: 'FFFFFF', // White text
      },
      paragraph: {
        alignment: AlignmentType.LEFT,
      },
    },
    {
      id: 'TableHeading11ptRight',
      name: 'Table Heading 11pt Right',
      basedOn: 'Normal',
      run: {
        size: 22, // 11pt
        bold: true,
        font: 'Arial',
        color: 'FFFFFF', // White text
      },
      paragraph: {
        alignment: AlignmentType.RIGHT,
      },
    },
    {
      id: 'TableText10pt',
      name: 'Table Text 10pt',
      basedOn: 'Normal',
      run: {
        size: 20, // 10pt
        font: 'Arial',
      },
      paragraph: {
        alignment: AlignmentType.LEFT,
      },
    },
    {
      id: 'TableText11pt',
      name: 'Table Text 11pt',
      basedOn: 'Normal',
      run: {
        size: 22, // 11pt
        font: 'Arial',
      },
      paragraph: {
        alignment: AlignmentType.LEFT,
      },
    },
    {
      id: 'TableTextBold10pt',
      name: 'Table Text Bold 10pt',
      basedOn: 'Normal',
      run: {
        size: 20, // 10pt
        bold: true,
        font: 'Arial',
      },
      paragraph: {
        alignment: AlignmentType.LEFT,
      },
    },
    {
      id: 'TableTextCenter10pt',
      name: 'Table Text Center 10pt',
      basedOn: 'Normal',
      run: {
        size: 20, // 10pt
        font: 'Arial',
      },
      paragraph: {
        alignment: AlignmentType.CENTER,
      },
    },
  ],
  characterStyles: [
    // Exhibit reference style (Part 4.1)
    {
      id: 'ExhibitReference',
      name: 'Exhibit Reference',
      basedOn: 'Normal',
      run: {
        bold: true,
        italics: true,
        color: palette.primary,
      },
    },
    {
      id: 'Bold',
      name: 'Bold',
      basedOn: 'Normal',
      run: {
        bold: true,
      },
    },
    {
      id: 'Emphasis',
      name: 'Emphasis',
      basedOn: 'Normal',
      run: {
        italics: true,
      },
    },
    // Emphasis character styles (Part 3.2)
    {
      id: 'BoldIntro',
      name: 'Bold Intro',
      basedOn: 'Normal',
      run: {
        bold: true,
        font: 'Arial',
      },
    },
    {
      id: 'IntenseReference',
      name: 'Intense Reference',
      basedOn: 'Normal',
      run: {
        italics: true,
        color: palette.primary,
        font: 'Arial',
      },
    },
  ],
  };
}

/** Backward-compatible default styles using the blue palette */
export const PROPOSAL_STYLES: IStylesOptions = buildProposalStyles();
