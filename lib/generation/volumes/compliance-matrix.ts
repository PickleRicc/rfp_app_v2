/**
 * Compliance Matrix Generator
 * Creates a comprehensive matrix showing how each requirement is addressed
 * Critical for proposal evaluation
 */

import { Paragraph, Table, TableRow, TableCell, WidthType, TextRun, HeadingLevel, BorderStyle, AlignmentType, VerticalAlign } from 'docx';
import { calculateSectionPageNumbers, getSectionPageNumber } from '../planning/page-estimator';

export interface RequirementMapping {
  requirementNumber: string;
  requirementText: string;
  sourceSection: string;
  addressedIn: string[]; // Section titles that address this requirement
  volume: string;
  estimatedPage?: number;
  status: 'Addressed' | 'Partially Addressed' | 'Not Addressed';
}

/**
 * Generate compliance matrix from section mappings
 */
export function generateComplianceMatrix(
  requirements: any[],
  sectionMappings: any[],
  volumeType: string,
  sections?: Array<{ title: string; content: any }> // Optional sections for page estimation
): { paragraphs: Paragraph[]; table: Table } {
  const paragraphs: Paragraph[] = [];

  // Title
  paragraphs.push(
    new Paragraph({
      text: 'REQUIREMENTS COMPLIANCE MATRIX',
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 240 },
    })
  );

  // Introduction
  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: 'This matrix demonstrates full compliance with all solicitation requirements. Each requirement is mapped to the specific proposal section(s) that address it, ensuring complete traceability for evaluators.',
          size: 22,
        }),
      ],
      spacing: { after: 480 },
    })
  );

  // Calculate page numbers if sections provided
  const pageMap = sections ? calculateSectionPageNumbers(sections) : null;

  // Build mapping data
  const mappings: RequirementMapping[] = [];

  for (const req of requirements) {
    // Find which sections address this requirement
    const addressingSections = sectionMappings
      .filter((m) => m.requirements.includes(req.id))
      .map((m) => m.sectionName);

    // Get page number for first addressing section
    let estimatedPage: number | undefined = undefined;
    if (pageMap && addressingSections.length > 0) {
      const firstSection = addressingSections[0];
      const pageNumber = getSectionPageNumber(firstSection, pageMap);
      if (pageNumber !== null) {
        estimatedPage = pageNumber;
      }
    }

    mappings.push({
      requirementNumber: req.requirement_number || req.id,
      requirementText: req.requirement_text || '',
      sourceSection: req.source_section || '',
      addressedIn: addressingSections,
      volume: volumeType,
      estimatedPage,
      status: addressingSections.length > 0 ? 'Addressed' : 'Not Addressed',
    });
  }

  // Create table
  const table = createComplianceTable(mappings);

  // Summary stats
  const addressed = mappings.filter((m) => m.status === 'Addressed').length;
  const total = mappings.length;
  const percentage = total > 0 ? ((addressed / total) * 100).toFixed(1) : '0';

  paragraphs.push(
    new Paragraph({
      text: '',
      spacing: { before: 480 },
    })
  );

  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: 'COMPLIANCE SUMMARY',
          bold: true,
          size: 24,
        }),
      ],
      spacing: { after: 180 },
    })
  );

  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Total Requirements: ${total}`,
          size: 22,
        }),
      ],
      spacing: { after: 60 },
    })
  );

  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Requirements Addressed: ${addressed}`,
          size: 22,
        }),
      ],
      spacing: { after: 60 },
    })
  );

  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Compliance Rate: ${percentage}%`,
          bold: true,
          size: 22,
          color: addressed === total ? '00AA00' : 'FF6600',
        }),
      ],
      spacing: { after: 60 },
    })
  );

  return { paragraphs, table };
}

/**
 * Format "Addressed In" cell content with page numbers
 */
function formatAddressedIn(sections: string[], estimatedPage?: number): string {
  if (sections.length === 0) {
    return 'TBD';
  }

  // Format first section with page number if available
  const firstSection = sections[0];
  let result = estimatedPage
    ? `${firstSection} (pg ${estimatedPage})`
    : firstSection;

  // Add remaining sections without page numbers
  if (sections.length > 1) {
    const remainingSections = sections.slice(1).join('; ');
    result += `; ${remainingSections}`;
  }

  return result;
}

/**
 * Create the compliance matrix table
 */
function createComplianceTable(mappings: RequirementMapping[]): Table {
  const rows: TableRow[] = [];

  // Header row
  rows.push(
    new TableRow({
      children: [
        createHeaderCell('Req #', 10),
        createHeaderCell('Source', 12),
        createHeaderCell('Requirement Summary', 40),
        createHeaderCell('Addressed In', 25),
        createHeaderCell('Status', 13),
      ],
      tableHeader: true,
    })
  );

  // Data rows
  for (const mapping of mappings) {
    rows.push(
      new TableRow({
        children: [
          createDataCell(mapping.requirementNumber, 10),
          createDataCell(mapping.sourceSection, 12),
          createDataCell(
            mapping.requirementText.length > 200
              ? mapping.requirementText.substring(0, 197) + '...'
              : mapping.requirementText,
            40
          ),
          createDataCell(
            formatAddressedIn(mapping.addressedIn, mapping.estimatedPage),
            25
          ),
          createStatusCell(mapping.status, 13),
        ],
      })
    );
  }

  // Add note row for page numbers
  rows.push(
    new TableRow({
      children: [
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Note: Page numbers are estimates. Update field codes in Word for final page numbers.',
                  size: 18,
                  italics: true,
                  color: '666666',
                }),
              ],
            }),
          ],
          columnSpan: 5,
          margins: {
            top: 100,
            bottom: 100,
            left: 100,
            right: 100,
          },
        }),
      ],
    })
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
      left: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
      right: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
    },
  });
}

/**
 * Create header cell
 */
function createHeaderCell(text: string, widthPercent: number): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text,
            bold: true,
            size: 20,
            color: 'FFFFFF',
          }),
        ],
        alignment: AlignmentType.CENTER,
      }),
    ],
    shading: {
      fill: '2563eb',
    },
    width: { size: widthPercent, type: WidthType.PERCENTAGE },
    verticalAlign: VerticalAlign.CENTER,
    margins: {
      top: 100,
      bottom: 100,
      left: 100,
      right: 100,
    },
  });
}

/**
 * Create data cell
 */
function createDataCell(text: string, widthPercent: number): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text,
            size: 20,
          }),
        ],
      }),
    ],
    width: { size: widthPercent, type: WidthType.PERCENTAGE },
    margins: {
      top: 80,
      bottom: 80,
      left: 80,
      right: 80,
    },
  });
}

/**
 * Create status cell with color coding
 */
function createStatusCell(status: string, widthPercent: number): TableCell {
  const color = status === 'Addressed' ? '00AA00' : status === 'Partially Addressed' ? 'FF6600' : 'CC0000';
  const fill = status === 'Addressed' ? 'E8F5E9' : status === 'Partially Addressed' ? 'FFF3E0' : 'FFEBEE';

  return new TableCell({
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text: status,
            bold: true,
            size: 20,
            color,
          }),
        ],
        alignment: AlignmentType.CENTER,
      }),
    ],
    shading: {
      fill,
    },
    width: { size: widthPercent, type: WidthType.PERCENTAGE },
    verticalAlign: VerticalAlign.CENTER,
    margins: {
      top: 80,
      bottom: 80,
      left: 80,
      right: 80,
    },
  });
}
