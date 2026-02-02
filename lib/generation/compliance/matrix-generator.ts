import ExcelJS from 'exceljs';
import path from 'path';

/**
 * Compliance Matrix Generator (Framework Part 2.3)
 * Generates Excel spreadsheet showing requirement-to-section mapping
 */

export interface ComplianceEntry {
  requirement_number: string;
  source_section: string;
  requirement_summary: string;
  proposal_section: string;
  volume: string;
  page_number: string;
  compliance_status: 'Compliant' | 'Partial' | 'Exception' | 'Not Addressed';
}

export interface SectionMapping {
  sectionName: string;
  sectionType: 'technical' | 'management' | 'past_performance' | 'price';
  requirements: string[];
  priority: 'primary' | 'secondary';
  estimatedComplexity?: 'low' | 'medium' | 'high';
}

/**
 * Generate compliance matrix Excel file
 */
export async function generateComplianceMatrix(
  requirements: any[],
  sectionMappings: SectionMapping[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Compliance Matrix');

  // Set up columns (Part 2.3)
  sheet.columns = [
    { header: 'Requirement #', key: 'req_num', width: 15 },
    { header: 'Source', key: 'source', width: 20 },
    { header: 'Requirement Summary', key: 'summary', width: 60 },
    { header: 'Proposal Section', key: 'section', width: 30 },
    { header: 'Volume', key: 'volume', width: 15 },
    { header: 'Page #', key: 'page', width: 10 },
    { header: 'Status', key: 'status', width: 15 },
  ];

  // Style header row
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF2563EB' },
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 20;

  // Build a lookup map from requirement ID to section mappings
  const reqToSectionMap = new Map<string, SectionMapping[]>();
  for (const mapping of sectionMappings) {
    for (const reqId of mapping.requirements) {
      if (!reqToSectionMap.has(reqId)) {
        reqToSectionMap.set(reqId, []);
      }
      reqToSectionMap.get(reqId)!.push(mapping);
    }
  }

  // Add requirements
  for (let i = 0; i < requirements.length; i++) {
    const req = requirements[i];
    const mappings = reqToSectionMap.get(req.id) || [];
    
    // Get primary mapping (first one)
    const primaryMapping = mappings.length > 0 ? mappings[0] : null;
    
    // Format section names (combine if multiple)
    const sectionNames = mappings.length > 0 
      ? mappings.map(m => m.sectionName).join('; ')
      : 'TBD';
    
    // Format volume name
    const volumeName = primaryMapping 
      ? primaryMapping.sectionType.charAt(0).toUpperCase() + primaryMapping.sectionType.slice(1).replace('_', ' ')
      : 'TBD';

    const row = sheet.addRow({
      req_num: req.requirement_number || `REQ-${i + 1}`,
      source: req.source_section || 'Unknown',
      summary: req.requirement_text?.substring(0, 500) || 'N/A',
      section: sectionNames,
      volume: volumeName,
      page: 'TBD', // Page numbers can only be determined after Word renders the document
      status: mappings.length > 0 ? 'Compliant' : 'Not Addressed',
    });

    // Color code status cell
    const statusCell = row.getCell(7);
    if (mappings.length > 0) {
      statusCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF10B981' }, // Green
      };
      statusCell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    } else {
      statusCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFEF4444' }, // Red
      };
      statusCell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    }

    // Alternate row colors
    if (i % 2 === 0) {
      for (let j = 1; j <= 6; j++) {
        row.getCell(j).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF9FAFB' },
        };
      }
    }

    // Text wrapping for summary
    row.getCell(3).alignment = { wrapText: true, vertical: 'top' };
    row.height = 40;
  }

  // Add borders to all cells
  sheet.eachRow((row, rowNumber) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };
    });
  });

  // Freeze header row
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  // Add summary sheet
  await addSummarySheet(workbook, requirements, sectionMappings);

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// Removed: findRequirementMapping() - now using real section mappings from mapRequirementsToSections()

/**
 * Add summary sheet with statistics
 */
async function addSummarySheet(
  workbook: ExcelJS.Workbook,
  requirements: any[],
  sectionMappings: SectionMapping[]
): Promise<void> {
  const summarySheet = workbook.addWorksheet('Summary');

  // Title
  summarySheet.mergeCells('A1:B1');
  const titleCell = summarySheet.getCell('A1');
  titleCell.value = 'Compliance Matrix Summary';
  titleCell.font = { bold: true, size: 16, color: { argb: 'FF2563EB' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  summarySheet.getRow(1).height = 30;

  // Build requirement coverage map
  const coveredReqIds = new Set<string>();
  for (const mapping of sectionMappings) {
    for (const reqId of mapping.requirements) {
      coveredReqIds.add(reqId);
    }
  }

  // Statistics
  const compliantCount = requirements.filter((r) => coveredReqIds.has(r.id)).length;
  const totalCount = requirements.length;
  const compliancePercent = totalCount > 0 ? Math.round((compliantCount / totalCount) * 100) : 0;

  const stats = [
    ['Total Requirements', totalCount],
    ['Addressed Requirements', compliantCount],
    ['Not Addressed', totalCount - compliantCount],
    ['Compliance Percentage', `${compliancePercent}%`],
  ];

  let rowNum = 3;
  for (const [label, value] of stats) {
    summarySheet.getCell(`A${rowNum}`).value = label;
    summarySheet.getCell(`A${rowNum}`).font = { bold: true };
    summarySheet.getCell(`B${rowNum}`).value = value;
    summarySheet.getCell(`B${rowNum}`).font = { size: 12 };
    
    if (label === 'Compliance Percentage') {
      summarySheet.getCell(`B${rowNum}`).font = {
        bold: true,
        size: 14,
        color: { argb: compliancePercent >= 100 ? 'FF10B981' : 'FFEF4444' },
      };
    }

    rowNum++;
  }

  // Volume breakdown
  summarySheet.getCell(`A${rowNum + 1}`).value = 'Breakdown by Volume';
  summarySheet.getCell(`A${rowNum + 1}`).font = { bold: true, size: 12 };
  rowNum += 2;

  // Count mappings by volume type
  const volumeCounts: Record<string, number> = {};
  for (const mapping of sectionMappings) {
    volumeCounts[mapping.sectionType] = (volumeCounts[mapping.sectionType] || 0) + mapping.requirements.length;
  }

  const volumeTypes = ['technical', 'management', 'past_performance', 'price'];
  for (const volType of volumeTypes) {
    if (volumeCounts[volType] && volumeCounts[volType] > 0) {
      summarySheet.getCell(`A${rowNum}`).value = volType.charAt(0).toUpperCase() + volType.slice(1).replace('_', ' ');
      summarySheet.getCell(`B${rowNum}`).value = volumeCounts[volType];
      rowNum++;
    }
  }

  // Column widths
  summarySheet.getColumn(1).width = 30;
  summarySheet.getColumn(2).width = 20;
}

/**
 * Save compliance matrix to file
 */
export async function saveComplianceMatrixToFile(
  requirements: any[],
  sectionMappings: SectionMapping[],
  outputPath: string
): Promise<string> {
  const buffer = await generateComplianceMatrix(requirements, sectionMappings);
  
  const fs = await import('fs/promises');
  await fs.writeFile(outputPath, buffer);
  
  return outputPath;
}

/**
 * Calculate compliance coverage percentage
 */
export function calculateComplianceCoverage(
  requirements: any[],
  sectionMappings: SectionMapping[]
): number {
  // Build set of covered requirement IDs
  const coveredReqIds = new Set<string>();
  for (const mapping of sectionMappings) {
    for (const reqId of mapping.requirements) {
      coveredReqIds.add(reqId);
    }
  }

  const compliantCount = requirements.filter((r) => coveredReqIds.has(r.id)).length;
  const totalCount = requirements.length;
  
  return totalCount > 0 ? Math.round((compliantCount / totalCount) * 100) : 0;
}
