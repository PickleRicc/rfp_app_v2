import { IStylesOptions, AlignmentType, BorderStyle } from 'docx';

/**
 * Professional proposal document styles following the Proposal Response Generation Framework
 * Part 3: Writing Style System
 */
export const PROPOSAL_STYLES: IStylesOptions = {
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
        color: '2563eb', // Blue
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
        color: '1e40af', // Darker blue
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
            color: '2563eb',
            space: 1,
            style: BorderStyle.SINGLE,
            size: 6,
          },
          bottom: {
            color: '2563eb',
            space: 1,
            style: BorderStyle.SINGLE,
            size: 6,
          },
          left: {
            color: '2563eb',
            space: 1,
            style: BorderStyle.SINGLE,
            size: 6,
          },
          right: {
            color: '2563eb',
            space: 1,
            style: BorderStyle.SINGLE,
            size: 6,
          },
        },
        shading: {
          fill: 'EFF6FF', // Light blue background
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
        color: '2563eb',
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
            color: '2563eb',
            space: 1,
            style: BorderStyle.SINGLE,
            size: 12,
          },
        },
        shading: {
          fill: 'F0F9FF',
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
        color: '2563eb',
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
    // Heading variants (Part 3.1)
    {
      id: 'Heading1SamePage',
      name: 'Heading 1 Same Page',
      basedOn: 'Normal',
      next: 'Normal',
      run: {
        size: 32, // 16pt
        bold: true,
        color: '2563eb', // Blue
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
        color: '2563eb', // Blue
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
        color: '1e40af', // Darker blue
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
            color: '2563eb',
            space: 1,
            style: BorderStyle.SINGLE,
            size: 6,
          },
        },
        shading: {
          fill: 'F0F9FF', // Light blue background
        },
        spacing: { before: 120, after: 120 },
        indent: { left: 360 },
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
        color: '2563eb',
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
        color: '2563eb',
        font: 'Arial',
      },
    },
  ],
};
