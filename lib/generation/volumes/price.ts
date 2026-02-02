import { Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle } from 'docx';

/**
 * Generate Price Volume (Framework Part 1.2 - PRICE_VOLUME)
 * Typical sections:
 * - Pricing Summary
 * - Price Narrative / Basis of Estimate
 * - Labor Rate Tables
 * - ODC Breakdown
 */
export async function generatePriceVolume(
  requirements: any[],
  companyData: any
): Promise<any> {
  const sections: any[] = [];

  // Extract pricing data from personnel
  const pricingData = extractPricingData(companyData.personnel);

  // Pricing Summary
  const pricingSummary = generatePricingSummary(requirements, pricingData);
  sections.push({
    title: 'Pricing Summary',
    content: pricingSummary,
  });

  // Basis of Estimate
  const basisOfEstimate = await generateBasisOfEstimate(requirements, pricingData.hasPricing);
  sections.push({
    title: 'Basis of Estimate',
    content: basisOfEstimate,
  });

  // Labor Rates
  if (companyData.personnel && companyData.personnel.length > 0) {
    const laborRates = generateLaborRatesSection(pricingData);
    sections.push({
      title: 'Labor Categories and Rates',
      content: laborRates,
    });
  }

  return { sections };
}

/**
 * Extract pricing data from personnel records
 */
interface LaborRateData {
  laborCategory: string;
  billRate: number;
  costRate: number;
  personnelCount: number;
}

interface PricingData {
  hasPricing: boolean;
  laborRates: LaborRateData[];
  totalCategories: number;
}

function extractPricingData(personnel: any[]): PricingData {
  if (!personnel || personnel.length === 0) {
    return { hasPricing: false, laborRates: [], totalCategories: 0 };
  }

  const ratesMap = new Map<string, LaborRateData>();

  for (const person of personnel) {
    if (person.proposed_roles && Array.isArray(person.proposed_roles)) {
      for (const role of person.proposed_roles) {
        if (role.labor_category) {
          const existing = ratesMap.get(role.labor_category);
          
          if (existing) {
            existing.personnelCount++;
            // Average the rates if multiple people have the same category
            if (role.bill_rate) {
              existing.billRate = (existing.billRate + role.bill_rate) / 2;
            }
            if (role.cost_rate) {
              existing.costRate = (existing.costRate + role.cost_rate) / 2;
            }
          } else {
            ratesMap.set(role.labor_category, {
              laborCategory: role.labor_category,
              billRate: role.bill_rate || 0,
              costRate: role.cost_rate || 0,
              personnelCount: 1,
            });
          }
        }
      }
    }
  }

  const laborRates = Array.from(ratesMap.values());
  const hasPricing = laborRates.some(rate => rate.billRate > 0 || rate.costRate > 0);

  return {
    hasPricing,
    laborRates,
    totalCategories: laborRates.length,
  };
}

/**
 * Generate pricing summary section
 */
function generatePricingSummary(requirements: any[], pricingData: PricingData): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: 'This Price Volume provides our proposed pricing for all services described in the technical and management volumes. Our pricing reflects competitive rates while ensuring the highest quality of service delivery.',
          size: 22,
          font: 'Arial',
        }),
      ],
      spacing: { after: 240 },
    })
  );

  if (!pricingData.hasPricing) {
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'Note: ',
            bold: true,
            size: 22,
            font: 'Arial',
          }),
          new TextRun({
            text: 'Detailed pricing tables, labor rates, and cost breakdowns should be completed based on actual cost data and pricing strategy. This volume provides the structure and narrative framework.',
            italics: true,
            size: 22,
            font: 'Arial',
          }),
        ],
        style: 'BodyText11pt',
        spacing: { after: 360 },
      })
    );
  } else {
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Our proposal includes ${pricingData.totalCategories} labor categories with fully burdened hourly rates. All pricing is based on current market rates and our established cost structure.`,
            size: 22,
            font: 'Arial',
          }),
        ],
        spacing: { after: 360 },
      })
    );
  }

  return paragraphs;
}

/**
 * Generate basis of estimate narrative
 */
async function generateBasisOfEstimate(requirements: any[], hasPricing: boolean): Promise<Paragraph[]> {
  const paragraphs: Paragraph[] = [];

  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: hasPricing 
            ? 'Our pricing is based on a detailed analysis of the Statement of Work requirements, historical data from similar contracts, current market rates, and our proven delivery methodology. The labor rates provided reflect our established cost structure and include all direct and indirect costs.'
            : 'Our pricing is based on a detailed analysis of the Statement of Work requirements, historical data from similar contracts, current market rates, and our proven delivery methodology.',
          size: 22,
          font: 'Arial',
        }),
      ],
      spacing: { after: 240 },
    })
  );

  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: 'Key Pricing Assumptions:',
          bold: true,
          size: 22,
          font: 'Arial',
        }),
      ],
      spacing: { before: 180, after: 120 },
    })
  );

  const assumptions = hasPricing
    ? [
        'Labor rates include all direct labor, fringe benefits, overhead, and fee',
        'Rates are fully burdened and reflect current approved cost structure',
        'Pricing assumes standard business hours unless otherwise specified',
        'Travel costs are estimated based on historical averages and current GSA rates',
        'Material and equipment costs reflect current market prices',
        'All rates are firm-fixed for the base period of performance',
      ]
    : [
        'Labor rates are based on prevailing market rates for the geographic area',
        'Estimates include all direct and indirect costs',
        'Pricing assumes standard business hours unless otherwise specified',
        'Travel costs are estimated based on historical averages',
        'Material and equipment costs reflect current market prices',
      ];

  for (const assumption of assumptions) {
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: assumption,
            size: 22,
            font: 'Arial',
          }),
        ],
        bullet: { level: 0 },
        spacing: { after: 120 },
      })
    );
  }

  return paragraphs;
}

/**
 * Generate labor rates section with actual pricing table if available
 */
function generateLaborRatesSection(pricingData: PricingData): (Paragraph | Table)[] {
  const content: (Paragraph | Table)[] = [];

  content.push(
    new Paragraph({
      children: [
        new TextRun({
          text: 'The following labor categories will be utilized for this contract. Fully burdened hourly rates are provided for each category.',
          size: 22,
          font: 'Arial',
        }),
      ],
      spacing: { after: 240 },
    })
  );

  if (pricingData.hasPricing) {
    // Generate actual pricing table
    content.push(createLaborRateTable(pricingData.laborRates));
    
    content.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'Note: ',
            bold: true,
            size: 20,
            font: 'Arial',
          }),
          new TextRun({
            text: 'All rates shown are fully burdened and include direct labor, fringe benefits, overhead, general and administrative expenses, and fee. Rates are effective as of the proposal submission date.',
            italics: true,
            size: 20,
            font: 'Arial',
          }),
        ],
        spacing: { before: 240, after: 120 },
      })
    );
  } else {
    // No pricing data available - show placeholder
    content.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'Note: ',
            bold: true,
            size: 22,
            font: 'Arial',
          }),
          new TextRun({
            text: 'Actual labor rate tables with specific dollar amounts should be inserted here based on your pricing strategy and approved rate structure.',
            italics: true,
            size: 22,
            font: 'Arial',
          }),
        ],
        spacing: { after: 360 },
      })
    );

    // List categories without rates
    if (pricingData.laborRates.length > 0) {
      content.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'Labor Categories:',
              bold: true,
              size: 22,
              font: 'Arial',
            }),
          ],
          spacing: { before: 240, after: 120 },
        })
      );

      for (const rate of pricingData.laborRates) {
        content.push(
          new Paragraph({
            children: [
              new TextRun({
                text: rate.laborCategory,
                size: 22,
                font: 'Arial',
              }),
            ],
            bullet: { level: 0 },
            spacing: { after: 60 },
          })
        );
      }
    }
  }

  return content;
}

/**
 * Create a formatted labor rate table
 */
function createLaborRateTable(laborRates: LaborRateData[]): Table {
  const borderStyle = {
    style: BorderStyle.SINGLE,
    size: 1,
    color: '000000',
  };

  const cellBorders = {
    top: borderStyle,
    bottom: borderStyle,
    left: borderStyle,
    right: borderStyle,
  };

  // Header row
  const headerRow = new TableRow({
    children: [
      new TableCell({
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: 'Labor Category',
                bold: true,
                size: 20,
                font: 'Arial',
              }),
            ],
          }),
        ],
        width: { size: 50, type: WidthType.PERCENTAGE },
        borders: cellBorders,
        shading: { fill: 'D3D3D3' },
      }),
      new TableCell({
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: 'Fully Burdened Rate',
                bold: true,
                size: 20,
                font: 'Arial',
              }),
            ],
          }),
        ],
        width: { size: 25, type: WidthType.PERCENTAGE },
        borders: cellBorders,
        shading: { fill: 'D3D3D3' },
      }),
      new TableCell({
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: 'Cost Rate',
                bold: true,
                size: 20,
                font: 'Arial',
              }),
            ],
          }),
        ],
        width: { size: 25, type: WidthType.PERCENTAGE },
        borders: cellBorders,
        shading: { fill: 'D3D3D3' },
      }),
    ],
  });

  // Data rows
  const dataRows = laborRates
    .sort((a, b) => a.laborCategory.localeCompare(b.laborCategory))
    .map(
      (rate) =>
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: rate.laborCategory,
                      size: 20,
                      font: 'Arial',
                    }),
                  ],
                }),
              ],
              borders: cellBorders,
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: rate.billRate > 0 ? `$${rate.billRate.toFixed(2)}/hr` : 'TBD',
                      size: 20,
                      font: 'Arial',
                    }),
                  ],
                }),
              ],
              borders: cellBorders,
            }),
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: rate.costRate > 0 ? `$${rate.costRate.toFixed(2)}/hr` : 'TBD',
                      size: 20,
                      font: 'Arial',
                    }),
                  ],
                }),
              ],
              borders: cellBorders,
            }),
          ],
        })
    );

  return new Table({
    rows: [headerRow, ...dataRows],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}
