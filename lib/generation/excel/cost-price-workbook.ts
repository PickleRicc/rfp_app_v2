/**
 * Cost/Price Excel Workbook Generator
 *
 * Generates a 5-sheet Excel workbook for Cost/Price volume submissions:
 *   Sheet 1: Summary     — CLIN structure, period totals, grand total
 *   Sheet 2: Labor       — Labor categories, hourly rates, annual hours
 *   Sheet 3: ODCs        — Travel, materials, equipment, subcontractor costs
 *   Sheet 4: Indirect    — Overhead, G&A, fringe, fee (FAR 15.408 structure)
 *   Sheet 5: Sanitized   — Copy of Summary with dollar amounts masked
 *
 * Data sources:
 *   - dataCallResponse.site_staffing (FTE counts)
 *   - extraction admin_data (CLIN structure, period of performance)
 *   - Labor categories from personnel records
 */

import ExcelJS from 'exceljs';
import type { DataCallResponse } from '@/lib/supabase/tier2-types';
import type { ComplianceExtractionsByCategory } from '@/lib/supabase/compliance-types';
import type { BoeAssessment, BoeTableRow } from '@/lib/supabase/boe-types';

export interface CostPriceWorkbookData {
  companyName: string;
  solicitationNumber: string;
  agencyName: string;
  contractType: string;
  periodOfPerformance: string;
  siteStaffing: { site_name: string; proposed_fte_count: string | number }[];
  laborCategories: LaborCategory[];
  clinStructure: ClinItem[];
  /** Optional BOE assessment — when present, BOE-derived labor categories take precedence */
  boeAssessment?: BoeAssessment | null;
}

interface LaborCategory {
  title: string;
  quantity: number;
  hourlyRate: number;
  annualHours: number;
}

interface ClinItem {
  clinNumber: string;
  description: string;
  type: 'labor' | 'odc' | 'travel' | 'other';
}

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF1E3A5F' },
};

const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: 'FFFFFFFF' },
  size: 11,
};

const CURRENCY_FORMAT = '"$"#,##0.00';
const ACCOUNTING_FORMAT = '_("$"* #,##0.00_);_("$"* (#,##0.00);_("$"* "-"??_);_(@_)';

function styleHeaderRow(row: ExcelJS.Row) {
  row.eachCell(cell => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin' },
      bottom: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' },
    };
  });
  row.height = 22;
}

function styleCurrencyCell(cell: ExcelJS.Cell) {
  cell.numFmt = ACCOUNTING_FORMAT;
  cell.border = {
    top: { style: 'thin' },
    bottom: { style: 'thin' },
    left: { style: 'thin' },
    right: { style: 'thin' },
  };
}

function addThinBorders(cell: ExcelJS.Cell) {
  cell.border = {
    top: { style: 'thin' },
    bottom: { style: 'thin' },
    left: { style: 'thin' },
    right: { style: 'thin' },
  };
}

const BASE_YEAR_COUNT = 1;
const OPTION_YEAR_COUNT = 4;
const TOTAL_PERIODS = BASE_YEAR_COUNT + OPTION_YEAR_COUNT;

function buildSummarySheet(ws: ExcelJS.Worksheet, data: CostPriceWorkbookData) {
  ws.columns = [
    { header: '', width: 12 },
    { header: '', width: 40 },
    ...Array.from({ length: TOTAL_PERIODS }, (_, i) => ({
      header: '', width: 16,
    })),
    { header: '', width: 18 },
  ];

  const titleRow = ws.addRow([`Cost/Price Summary — ${data.companyName}`]);
  titleRow.font = { bold: true, size: 14 };
  ws.mergeCells(titleRow.number, 1, titleRow.number, 2 + TOTAL_PERIODS + 1);

  ws.addRow([`Solicitation: ${data.solicitationNumber}`]);
  ws.addRow([`Agency: ${data.agencyName}`]);
  ws.addRow([`Contract Type: ${data.contractType}`]);
  ws.addRow([`Period: ${data.periodOfPerformance}`]);
  ws.addRow([]);

  const headerLabels = [
    'CLIN', 'Description',
    'Base Year',
    ...Array.from({ length: OPTION_YEAR_COUNT }, (_, i) => `Option Year ${i + 1}`),
    'TOTAL',
  ];
  const headerRow = ws.addRow(headerLabels);
  styleHeaderRow(headerRow);

  const clinRows: number[] = [];
  const clins = data.clinStructure.length > 0 ? data.clinStructure : [
    { clinNumber: '0001', description: 'Base IT Operations Labor', type: 'labor' as const },
    { clinNumber: '0002', description: 'Other Direct Costs', type: 'odc' as const },
    { clinNumber: '0003', description: 'Travel', type: 'travel' as const },
  ];

  for (const clin of clins) {
    const rowValues = [clin.clinNumber, clin.description];
    for (let p = 0; p < TOTAL_PERIODS; p++) {
      rowValues.push('[ENTER AMOUNT]' as unknown as string);
    }
    const totalCol = String.fromCharCode(67 + TOTAL_PERIODS);
    const dataRow = ws.addRow(rowValues);
    clinRows.push(dataRow.number);

    for (let c = 3; c <= 2 + TOTAL_PERIODS; c++) {
      const cell = dataRow.getCell(c);
      cell.numFmt = ACCOUNTING_FORMAT;
      addThinBorders(cell);
    }

    const totalCell = dataRow.getCell(2 + TOTAL_PERIODS + 1);
    const startCol = String.fromCharCode(67);
    const endCol = String.fromCharCode(67 + TOTAL_PERIODS - 1);
    totalCell.value = { formula: `SUM(${startCol}${dataRow.number}:${endCol}${dataRow.number})` } as ExcelJS.CellFormulaValue;
    styleCurrencyCell(totalCell);
    addThinBorders(dataRow.getCell(1));
    addThinBorders(dataRow.getCell(2));
  }

  ws.addRow([]);
  const grandTotalRow = ws.addRow(['', 'GRAND TOTAL']);
  grandTotalRow.font = { bold: true };
  for (let c = 3; c <= 2 + TOTAL_PERIODS + 1; c++) {
    const colLetter = String.fromCharCode(64 + c);
    const formulaParts = clinRows.map(r => `${colLetter}${r}`);
    const cell = grandTotalRow.getCell(c);
    cell.value = { formula: formulaParts.join('+') } as ExcelJS.CellFormulaValue;
    styleCurrencyCell(cell);
    cell.font = { bold: true };
  }
}

function buildLaborSheet(ws: ExcelJS.Worksheet, data: CostPriceWorkbookData) {
  ws.columns = [
    { header: '', width: 30 },
    { header: '', width: 8 },
    { header: '', width: 14 },
    { header: '', width: 14 },
    ...Array.from({ length: TOTAL_PERIODS }, () => ({ header: '', width: 16 })),
    { header: '', width: 18 },
  ];

  const titleRow = ws.addRow(['Labor Category Detail']);
  titleRow.font = { bold: true, size: 13 };
  ws.addRow([]);

  const totalFTEs = data.siteStaffing.reduce((sum, s) => sum + Number(s.proposed_fte_count || 0), 0);
  ws.addRow([`Total FTEs: ${totalFTEs || '[ENTER]'}`]);
  ws.addRow([]);

  const headerLabels = [
    'Labor Category', 'FTEs', 'Hourly Rate', 'Annual Hours',
    'Base Year',
    ...Array.from({ length: OPTION_YEAR_COUNT }, (_, i) => `OY ${i + 1}`),
    'TOTAL',
  ];
  const headerRow = ws.addRow(headerLabels);
  styleHeaderRow(headerRow);

  const categories = data.laborCategories.length > 0 ? data.laborCategories : [
    { title: 'Program Manager', quantity: 1, hourlyRate: 0, annualHours: 2080 },
    { title: 'Lead Systems Engineer', quantity: 1, hourlyRate: 0, annualHours: 2080 },
    { title: 'Cybersecurity Lead', quantity: 1, hourlyRate: 0, annualHours: 2080 },
    { title: 'Service Desk Manager', quantity: 1, hourlyRate: 0, annualHours: 2080 },
    { title: 'Network Engineer', quantity: 3, hourlyRate: 0, annualHours: 2080 },
    { title: 'Systems Administrator', quantity: 3, hourlyRate: 0, annualHours: 2080 },
    { title: 'Cybersecurity Analyst', quantity: 2, hourlyRate: 0, annualHours: 2080 },
    { title: 'ServiceNow Developer', quantity: 1, hourlyRate: 0, annualHours: 2080 },
    { title: 'Service Desk Technician', quantity: 35, hourlyRate: 0, annualHours: 2080 },
    { title: 'AV/VTC Specialist', quantity: 1, hourlyRate: 0, annualHours: 2080 },
    { title: 'Asset Manager', quantity: 1, hourlyRate: 0, annualHours: 2080 },
  ];

  const laborRows: number[] = [];
  for (const cat of categories) {
    const row = ws.addRow([
      cat.title,
      cat.quantity,
      cat.hourlyRate || '',
      cat.annualHours,
    ]);
    laborRows.push(row.number);

    row.getCell(3).numFmt = CURRENCY_FORMAT;

    for (let p = 0; p < TOTAL_PERIODS; p++) {
      const col = 5 + p;
      const cell = row.getCell(col);
      const escalation = p === 0 ? 1 : `(1 + 0.03)^${p}`;
      cell.value = { formula: `B${row.number}*C${row.number}*D${row.number}*${escalation}` } as ExcelJS.CellFormulaValue;
      styleCurrencyCell(cell);
    }

    const totalCol = 5 + TOTAL_PERIODS;
    const startCol = String.fromCharCode(69);
    const endCol = String.fromCharCode(69 + TOTAL_PERIODS - 1);
    const totalCell = row.getCell(totalCol);
    totalCell.value = { formula: `SUM(${startCol}${row.number}:${endCol}${row.number})` } as ExcelJS.CellFormulaValue;
    styleCurrencyCell(totalCell);

    row.eachCell(c => addThinBorders(c));
  }

  ws.addRow([]);
  const totalRow = ws.addRow(['TOTAL DIRECT LABOR']);
  totalRow.font = { bold: true };
  for (let c = 5; c <= 5 + TOTAL_PERIODS; c++) {
    const colLetter = String.fromCharCode(64 + c);
    const cell = totalRow.getCell(c);
    cell.value = { formula: laborRows.map(r => `${colLetter}${r}`).join('+') } as ExcelJS.CellFormulaValue;
    styleCurrencyCell(cell);
    cell.font = { bold: true };
  }
}

function buildODCSheet(ws: ExcelJS.Worksheet) {
  ws.columns = [
    { header: '', width: 30 },
    { header: '', width: 40 },
    ...Array.from({ length: TOTAL_PERIODS }, () => ({ header: '', width: 16 })),
    { header: '', width: 18 },
  ];

  const titleRow = ws.addRow(['Other Direct Costs (ODCs)']);
  titleRow.font = { bold: true, size: 13 };
  ws.addRow([]);

  const headerLabels = [
    'Category', 'Description',
    'Base Year',
    ...Array.from({ length: OPTION_YEAR_COUNT }, (_, i) => `OY ${i + 1}`),
    'TOTAL',
  ];
  const headerRow = ws.addRow(headerLabels);
  styleHeaderRow(headerRow);

  const odcCategories = [
    ['Travel', 'Site visits, program reviews, conferences'],
    ['Materials & Supplies', 'Office supplies, consumables, spare parts'],
    ['Equipment', 'IT equipment, tools, test equipment'],
    ['Subcontractor — Acme Federal Solutions', 'Network engineering and classified support (20% workshare)'],
    ['Software Licenses', 'Monitoring tools, security tools, ITSM licenses'],
    ['Training', 'Staff certifications and professional development'],
  ];

  const odcRows: number[] = [];
  for (const [category, description] of odcCategories) {
    const row = ws.addRow([category, description]);
    odcRows.push(row.number);

    for (let c = 3; c <= 2 + TOTAL_PERIODS; c++) {
      const cell = row.getCell(c);
      cell.numFmt = ACCOUNTING_FORMAT;
      addThinBorders(cell);
    }

    const totalCol = 2 + TOTAL_PERIODS + 1;
    const startCol = String.fromCharCode(67);
    const endCol = String.fromCharCode(67 + TOTAL_PERIODS - 1);
    const totalCell = row.getCell(totalCol);
    totalCell.value = { formula: `SUM(${startCol}${row.number}:${endCol}${row.number})` } as ExcelJS.CellFormulaValue;
    styleCurrencyCell(totalCell);

    row.eachCell(c => addThinBorders(c));
  }

  ws.addRow([]);
  const totalRow = ws.addRow(['TOTAL ODCs']);
  totalRow.font = { bold: true };
  for (let c = 3; c <= 2 + TOTAL_PERIODS + 1; c++) {
    const colLetter = String.fromCharCode(64 + c);
    const cell = totalRow.getCell(c);
    cell.value = { formula: odcRows.map(r => `${colLetter}${r}`).join('+') } as ExcelJS.CellFormulaValue;
    styleCurrencyCell(cell);
    cell.font = { bold: true };
  }
}

function buildIndirectSheet(ws: ExcelJS.Worksheet) {
  ws.columns = [
    { header: '', width: 35 },
    { header: '', width: 15 },
    { header: '', width: 50 },
  ];

  const titleRow = ws.addRow(['Indirect Rate Schedule (FAR 15.408 Table 15-2)']);
  titleRow.font = { bold: true, size: 13 };
  ws.addRow([]);
  ws.addRow(['Per FAR 15.408, Table 15-2 — provide current, historical, and projected rates.']);
  ws.addRow([]);

  const headerRow = ws.addRow(['Rate Category', 'Rate (%)', 'Basis / Notes']);
  styleHeaderRow(headerRow);

  const rates = [
    ['Fringe Benefits', '', 'Applied to direct labor costs'],
    ['Overhead', '', 'Applied to direct labor + fringe'],
    ['General & Administrative (G&A)', '', 'Applied to total cost input'],
    ['Facilities Cost of Money (COM)', '', 'Per DFARS 231.205-10 / CAS 414'],
    ['Profit / Fee', '', 'CPFF fixed fee or profit rate'],
  ];

  for (const [category, rate, notes] of rates) {
    const row = ws.addRow([category, rate, notes]);
    row.getCell(2).numFmt = '0.00"%"';
    row.eachCell(c => addThinBorders(c));
  }

  ws.addRow([]);
  ws.addRow(['FORWARD PRICING RATE AGREEMENTS (FPRA):']);
  ws.addRow(['  If applicable, reference FPRA number and expiration date.']);
  ws.addRow([]);
  ws.addRow(['HISTORICAL RATES (3 years):']);

  const histHeaderRow = ws.addRow(['Rate Category', 'FY 2023', 'FY 2024', 'FY 2025']);
  styleHeaderRow(histHeaderRow);
  for (const [category] of rates) {
    const row = ws.addRow([category, '', '', '']);
    row.eachCell(c => addThinBorders(c));
  }
}

function buildSanitizedSheet(ws: ExcelJS.Worksheet, data: CostPriceWorkbookData) {
  ws.columns = [
    { header: '', width: 12 },
    { header: '', width: 40 },
    ...Array.from({ length: TOTAL_PERIODS }, () => ({ header: '', width: 16 })),
    { header: '', width: 18 },
  ];

  const titleRow = ws.addRow([`Cost/Price Summary (SANITIZED) — ${data.companyName}`]);
  titleRow.font = { bold: true, size: 14 };
  ws.addRow(['Dollar amounts redacted for source selection purposes.']);
  ws.addRow([]);

  const headerLabels = [
    'CLIN', 'Description',
    'Base Year',
    ...Array.from({ length: OPTION_YEAR_COUNT }, (_, i) => `Option Year ${i + 1}`),
    'TOTAL',
  ];
  const headerRow = ws.addRow(headerLabels);
  styleHeaderRow(headerRow);

  const clins = data.clinStructure.length > 0 ? data.clinStructure : [
    { clinNumber: '0001', description: 'Base IT Operations Labor', type: 'labor' as const },
    { clinNumber: '0002', description: 'Other Direct Costs', type: 'odc' as const },
    { clinNumber: '0003', description: 'Travel', type: 'travel' as const },
  ];

  for (const clin of clins) {
    const rowValues: (string)[] = [clin.clinNumber, clin.description];
    for (let p = 0; p <= TOTAL_PERIODS; p++) {
      rowValues.push('---');
    }
    const dataRow = ws.addRow(rowValues);
    dataRow.eachCell(c => addThinBorders(c));
  }

  ws.addRow([]);
  const grandRow = ws.addRow(['', 'GRAND TOTAL']);
  grandRow.font = { bold: true };
  for (let c = 3; c <= 2 + TOTAL_PERIODS + 1; c++) {
    grandRow.getCell(c).value = '---';
    addThinBorders(grandRow.getCell(c));
  }
}

/**
 * Derive labor categories from a BOE assessment.
 *
 * Aggregates FTE counts and annual hours across all task areas for each unique labor category.
 * BOE is the authoritative staffing model — prefer this over manually entered personnel records.
 *
 * Returns null when no usable BOE data is present (caller should fall back to extractLaborCategories).
 */
export function laborCategoriesFromBoe(
  boeAssessment: BoeAssessment | null | undefined
): LaborCategory[] | null {
  if (!boeAssessment || !boeAssessment.boe_table || boeAssessment.boe_table.length === 0) {
    return null;
  }

  // Aggregate FTE and hours by labor category across task areas
  const categoryMap = new Map<string, { quantity: number; totalHours: number; rowCount: number }>();

  for (const row of boeAssessment.boe_table as BoeTableRow[]) {
    const existing = categoryMap.get(row.labor_category);
    if (existing) {
      existing.quantity += row.fte_count;
      existing.totalHours += row.total_annual_hours;
      existing.rowCount += 1;
    } else {
      categoryMap.set(row.labor_category, {
        quantity: row.fte_count,
        totalHours: row.total_annual_hours,
        rowCount: 1,
      });
    }
  }

  return Array.from(categoryMap.entries()).map(([title, agg]) => ({
    title,
    quantity: agg.quantity,
    hourlyRate: 0, // Rate to be filled from P2W analysis or manual input
    annualHours: agg.quantity > 0 ? Math.round(agg.totalHours / agg.quantity) : 1920,
  }));
}

/**
 * Builds labor categories from personnel records and data call.
 */
export function extractLaborCategories(
  personnel: { proposed_roles?: { role_title: string; labor_category?: string; bill_rate?: number; is_key_personnel?: boolean }[] }[]
): LaborCategory[] {
  const categoryMap = new Map<string, LaborCategory>();

  for (const person of personnel) {
    const roles = person.proposed_roles || [];
    for (const role of roles) {
      const title = role.labor_category || role.role_title;
      const existing = categoryMap.get(title);
      if (existing) {
        existing.quantity += 1;
      } else {
        categoryMap.set(title, {
          title,
          quantity: 1,
          hourlyRate: role.bill_rate || 0,
          annualHours: 2080,
        });
      }
    }
  }

  return Array.from(categoryMap.values());
}

/**
 * Main entry point: generate a complete Cost/Price Excel workbook.
 */
export async function generateCostPriceWorkbook(
  data: CostPriceWorkbookData
): Promise<Buffer> {
  // Prefer BOE-derived labor categories over manual inputs — BOE is the authoritative staffing model
  const resolvedLaborCategories = laborCategoriesFromBoe(data.boeAssessment) ?? data.laborCategories;
  const workbookData: CostPriceWorkbookData = { ...data, laborCategories: resolvedLaborCategories };

  const wb = new ExcelJS.Workbook();
  wb.creator = workbookData.companyName;
  wb.created = new Date();

  const summaryWs = wb.addWorksheet('Summary');
  buildSummarySheet(summaryWs, workbookData);

  const laborWs = wb.addWorksheet('Labor');
  buildLaborSheet(laborWs, workbookData);

  const odcWs = wb.addWorksheet('ODCs');
  buildODCSheet(odcWs);

  const indirectWs = wb.addWorksheet('Indirect Rates');
  buildIndirectSheet(indirectWs);

  const sanitizedWs = wb.addWorksheet('Sanitized');
  buildSanitizedSheet(sanitizedWs, workbookData);

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
