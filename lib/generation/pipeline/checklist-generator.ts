/**
 * Quality Checklist Generator (Framework Part 10.1)
 *
 * Generates pre-submission quality checklist as Excel file.
 * Categories: COMPLIANCE, CONTENT, FORMATTING, FINAL_CHECKS
 */

import ExcelJS from 'exceljs';

export interface ChecklistItem {
  description: string;
  automatable: boolean;
  checkMethod?: string;
  status?: 'pass' | 'fail' | 'n/a' | 'needs_review';
  notes?: string;
}

export interface ChecklistCategory {
  name: string;
  items: ChecklistItem[];
}

export interface ChecklistResult {
  success: boolean;
  buffer?: Buffer;
  filePath?: string;
  error?: string;
  autoCheckedCount: number;
  manualReviewCount: number;
}

/**
 * Framework Part 10.1 checklist categories - LOCKED per CONTEXT.md
 * Four categories: COMPLIANCE, CONTENT, FORMATTING, FINAL_CHECKS
 */
export const FRAMEWORK_CHECKLIST: ChecklistCategory[] = [
  {
    name: 'COMPLIANCE',
    items: [
      {
        description: 'All Section L requirements addressed',
        automatable: true,
        checkMethod: 'Compare section headings to RFQ Section L outline',
      },
      {
        description: 'Page limits respected per volume',
        automatable: true,
        checkMethod: 'Count pages, compare to RFQ limits',
      },
      {
        description: 'Required formats followed (font, margins, spacing)',
        automatable: true,
        checkMethod: 'Check paragraph styles match specs',
      },
      {
        description: 'Cover letter includes all required elements',
        automatable: true,
        checkMethod: 'Verify cover letter sections present',
      },
      {
        description: 'Compliance matrix matches all requirements',
        automatable: true,
        checkMethod: 'Cross-reference matrix to requirement IDs',
      },
    ],
  },
  {
    name: 'CONTENT',
    items: [
      {
        description: 'Every requirement explicitly addressed',
        automatable: true,
        checkMethod: 'Check for requirement boxes/cross-refs',
      },
      {
        description: 'Win themes present in executive summary and key sections',
        automatable: true,
        checkMethod: 'Search for win theme callout boxes',
      },
      {
        description: 'Past performance examples relevant to proposed approach',
        automatable: false,
        checkMethod: 'Manual review by SME',
      },
      {
        description: 'Staffing plan matches labor categories in RFQ',
        automatable: true,
        checkMethod: 'Compare labor cats to RFQ Section B',
      },
      {
        description: 'No unsubstantiated claims or vague language',
        automatable: false,
        checkMethod: 'Manual review by proposal manager',
      },
    ],
  },
  {
    name: 'FORMATTING',
    items: [
      {
        description: 'Table of contents matches document sections',
        automatable: true,
        checkMethod: 'Update TOC, verify no differences',
      },
      {
        description: 'All exhibits numbered sequentially and referenced',
        automatable: true,
        checkMethod: 'Run exhibit validation function',
      },
      {
        description: 'Headers and footers on all pages',
        automatable: true,
        checkMethod: 'Check header/footer properties on all sections',
      },
      {
        description: 'No orphan headings (heading at bottom of page)',
        automatable: false,
        checkMethod: 'Visual review of page breaks',
      },
      {
        description: 'All tables and figures have captions',
        automatable: true,
        checkMethod: 'Search for Table/Figure patterns',
      },
    ],
  },
  {
    name: 'FINAL_CHECKS',
    items: [
      {
        description: 'No spelling or grammar errors',
        automatable: false,
        checkMethod: 'Run spell check, manual review',
      },
      {
        description: 'Acronyms defined on first use',
        automatable: true,
        checkMethod: 'Run acronym checker',
      },
      {
        description: 'No track changes or comments visible',
        automatable: true,
        checkMethod: 'Check document properties',
      },
      {
        description: 'PDF versions match DOCX versions exactly',
        automatable: true,
        checkMethod: 'Visual comparison or hash check',
      },
      {
        description: 'File names follow submission instructions',
        automatable: true,
        checkMethod: 'Compare filenames to RFQ requirements',
      },
    ],
  },
];

/**
 * Generate submission checklist Excel file
 * Per research: simple list validation with hardcoded options to avoid ExcelJS bugs
 *
 * @param categories Checklist categories (defaults to FRAMEWORK_CHECKLIST)
 * @param autoCheckResults Optional map of pre-checked items with results
 * @returns ChecklistResult with Excel buffer or error
 */
export async function generateChecklist(
  categories: ChecklistCategory[] = FRAMEWORK_CHECKLIST,
  autoCheckResults?: Map<string, { status: 'pass' | 'fail' | 'n/a'; notes?: string }>
): Promise<ChecklistResult> {
  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'RFP Proposal Generator';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Submission Checklist');

    // Set column widths
    sheet.columns = [
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Item', key: 'item', width: 55 },
      { header: 'Check Method', key: 'checkMethod', width: 45 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Notes', key: 'notes', width: 40 },
    ];

    // Style header row
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F4E79' }, // Dark blue
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    let autoCheckedCount = 0;
    let manualReviewCount = 0;

    // Add data rows
    for (const category of categories) {
      for (const item of category.items) {
        // Check for auto-check results
        const autoResult = autoCheckResults?.get(item.description);
        let status = '';
        let notes = '';

        if (autoResult) {
          status = autoResult.status.toUpperCase();
          notes = autoResult.notes || '';
          autoCheckedCount++;
        } else if (!item.automatable) {
          status = 'NEEDS REVIEW';
          notes = 'Manual review required';
          manualReviewCount++;
        }

        const row = sheet.addRow({
          category: category.name,
          item: item.description,
          checkMethod: item.checkMethod || '',
          status: status,
          notes: notes,
        });

        // Color-code status BEFORE adding validation (research pitfall #3)
        const statusCell = row.getCell('status');
        if (status === 'PASS') {
          statusCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFD9EAD3' }, // Light green
          };
        } else if (status === 'FAIL') {
          statusCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF4CCCC' }, // Light red
          };
        } else if (status === 'NEEDS REVIEW') {
          statusCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFF2CC' }, // Light yellow
          };
        }
      }

      // Add empty row between categories for readability
      sheet.addRow({});
    }

    // Add data validation for Status column AFTER all formatting (research pitfall #3)
    // Use simple list validation to avoid ExcelJS bugs
    const lastDataRow = sheet.rowCount;
    for (let rowNum = 2; rowNum <= lastDataRow; rowNum++) {
      const row = sheet.getRow(rowNum);
      const categoryCell = row.getCell('category');
      // Only add validation to rows with data (not empty separator rows)
      if (categoryCell.value) {
        const statusCell = row.getCell('status');
        statusCell.dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: ['"PASS,FAIL,N/A,NEEDS REVIEW"'],
        };
      }
    }

    // Add borders to all data cells
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        // Skip header
        row.eachCell({ includeEmpty: true }, (cell) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' },
          };
        });
      }
    });

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

    return {
      success: true,
      buffer: Buffer.from(buffer),
      autoCheckedCount,
      manualReviewCount,
    };
  } catch (error) {
    return {
      success: false,
      error: `Checklist generation failed: ${error instanceof Error ? error.message : String(error)}`,
      autoCheckedCount: 0,
      manualReviewCount: 0,
    };
  }
}
