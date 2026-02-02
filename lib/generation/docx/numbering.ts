/**
 * Hierarchical Heading Numbering System
 * Framework Part 3.1: Heading Hierarchy
 * 
 * LEVEL_1: "1. Section Title"
 * LEVEL_2: "1.1. Subsection Title"
 * LEVEL_3: "1.1.1. Sub-subsection Title"
 * LEVEL_4: "1.1.1.1. Detail Title"
 */

import { 
  LevelFormat, 
  AlignmentType,
  convertInchesToTwip 
} from 'docx';

/**
 * Hierarchical numbering configuration for proposal headings
 */
export const HEADING_NUMBERING = {
  reference: 'heading-numbering',
  levels: [
    {
      level: 0, // H1 - "1."
      format: LevelFormat.DECIMAL,
      text: '%1.',
      alignment: AlignmentType.LEFT,
      style: {
        paragraph: {
          indent: { left: convertInchesToTwip(0), hanging: convertInchesToTwip(0.25) },
        },
      },
    },
    {
      level: 1, // H2 - "1.1."
      format: LevelFormat.DECIMAL,
      text: '%1.%2.',
      alignment: AlignmentType.LEFT,
      style: {
        paragraph: {
          indent: { left: convertInchesToTwip(0), hanging: convertInchesToTwip(0.4) },
        },
      },
    },
    {
      level: 2, // H3 - "1.1.1."
      format: LevelFormat.DECIMAL,
      text: '%1.%2.%3.',
      alignment: AlignmentType.LEFT,
      style: {
        paragraph: {
          indent: { left: convertInchesToTwip(0), hanging: convertInchesToTwip(0.5) },
        },
      },
    },
    {
      level: 3, // H4 - "1.1.1.1."
      format: LevelFormat.DECIMAL,
      text: '%1.%2.%3.%4.',
      alignment: AlignmentType.LEFT,
      style: {
        paragraph: {
          indent: { left: convertInchesToTwip(0), hanging: convertInchesToTwip(0.6) },
        },
      },
    },
  ],
};

/**
 * Get numbering configuration for a heading level
 * @param level - 1 for H1, 2 for H2, 3 for H3, 4 for H4
 * @returns Numbering configuration object
 */
export function getHeadingNumbering(level: number): { reference: string; level: number } {
  return {
    reference: 'heading-numbering',
    level: level - 1, // Convert H1-H4 (1-4) to 0-based index (0-3)
  };
}

/**
 * Check if a section should be unnumbered
 * Per framework, some sections like Cover Letter should not be numbered
 */
export function shouldOmitNumbering(sectionTitle: string): boolean {
  const unnumberedSections = [
    'cover letter',
    'table of contents',
    'executive summary', // Sometimes unnumbered
  ];
  
  return unnumberedSections.some(s => 
    sectionTitle.toLowerCase().includes(s)
  );
}
