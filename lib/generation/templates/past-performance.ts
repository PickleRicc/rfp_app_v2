import { Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle } from 'docx';
import { getHeadingNumbering } from '../docx/numbering';

/**
 * Generate Past Performance section (Framework Part 5.5)
 * For each contract (top 3-5):
 * - Header table with contract details
 * - Relevance matrix
 * - Overview
 * - Description of effort
 * - Relevance to PWS
 * - Achievements with metrics
 */
export async function generatePastPerformance(
  pastPerformance: any[]
): Promise<Paragraph[]> {
  const paragraphs: Paragraph[] = [];

  // NOTE: H1 heading is created by document generator from section.title
  // Templates should only create H2+ subsection headings and content paragraphs

  // Overview
  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `The following past performance references demonstrate our proven capability to successfully deliver projects of similar scope, scale, and complexity. Each contract showcases our technical expertise, management excellence, and commitment to customer satisfaction.`,
          size: 22,
          font: 'Arial',
        }),
      ],
      spacing: { after: 480 },
    })
  );

  // Top 5 contracts
  const contracts = pastPerformance.slice(0, 5);

  for (let i = 0; i < contracts.length; i++) {
    const contract = contracts[i];

    // Contract heading with hierarchical numbering
    paragraphs.push(
      new Paragraph({
        text: contract.contract_nickname,
        heading: HeadingLevel.HEADING_2,
        numbering: getHeadingNumbering(2),
        spacing: { before: 480, after: 240 },
        pageBreakBefore: i > 0 && i % 2 === 0, // Page break every 2 contracts
      })
    );

    // Contract details table
    paragraphs.push(...generateContractTable(contract));

    // Overview
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'Contract Overview',
            bold: true,
            size: 22,
            font: 'Arial',
          }),
        ],
        spacing: { before: 240, after: 120 },
      })
    );
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: contract.overview || 'Comprehensive support services',
            size: 22,
            font: 'Arial',
          }),
        ],
        spacing: { after: 240 },
      })
    );

    // Description of effort
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'Description of Effort',
            bold: true,
            size: 22,
            font: 'Arial',
          }),
        ],
        spacing: { before: 240, after: 120 },
      })
    );
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: contract.description_of_effort || 'Detailed project description',
            size: 22,
            font: 'Arial',
          }),
        ],
        spacing: { after: 240 },
      })
    );

    // Task areas
    if (contract.task_areas && contract.task_areas.length > 0) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'Task Areas:',
              bold: true,
              size: 22,
              font: 'Arial',
            }),
          ],
          spacing: { before: 180, after: 60 },
        })
      );

      for (const taskArea of contract.task_areas) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: taskArea,
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

    // Performance highlights/achievements
    console.log(`📊 Contract ${contract.contract_nickname} achievements:`, contract.achievements);
    
    if (contract.achievements && contract.achievements.length > 0) {
      // Filter valid achievements with more lenient checks
      const validAchievements = contract.achievements.filter((a: any) => {
        // Check if achievement has any meaningful data
        const hasData = a && (a.statement || a.metric_value);
        console.log(`  Achievement check:`, { hasData, statement: a?.statement, metric_value: a?.metric_value });
        return hasData;
      });

      console.log(`  Valid achievements found: ${validAchievements.length}`);
      
      if (validAchievements.length > 0) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: 'Performance Achievements',
                bold: true,
                size: 22,
                font: 'Arial',
              }),
            ],
            spacing: { before: 240, after: 120 },
          })
        );

        for (const achievement of validAchievements) {
          // More flexible display - handle cases where fields might be missing
          const metricLabel = achievement.metric_type ? `${achievement.metric_type}: ` : '';
          const statement = achievement.statement || 'Achievement';
          const value = achievement.metric_value ? ` (${achievement.metric_value})` : '';
          
          console.log(`  Displaying achievement: ${metricLabel}${statement}${value}`);
          
          paragraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: metricLabel,
                  bold: true,
                  size: 22,
                  font: 'Arial',
                }),
                new TextRun({
                  text: `${statement}${value}`,
                  size: 22,
                  font: 'Arial',
                }),
              ],
              bullet: { level: 0 },
              style: 'BodyText11pt',
              spacing: { after: 120 },
            })
          );
        }
      } else {
        console.log(`  ⚠️ No valid achievements to display for this contract`);
      }
    }

    // CPARS rating if available
    if (contract.cpars_rating && contract.cpars_rating.overall) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'CPARS Rating: ',
              bold: true,
              size: 22,
              font: 'Arial',
            }),
            new TextRun({
              text: contract.cpars_rating.overall,
              size: 22,
              font: 'Arial',
              color: contract.cpars_rating.overall === 'Exceptional' || contract.cpars_rating.overall === 'Very Good' ? '10b981' : '000000',
            }),
          ],
          style: 'BodyText11pt',
          spacing: { before: 180, after: 120 },
        })
      );
    }

    // Client POC
    if (contract.client_poc) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'Client Point of Contact',
              bold: true,
              size: 22,
              font: 'Arial',
            }),
          ],
          spacing: { before: 240, after: 60 },
        })
      );
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${contract.client_poc.name}, ${contract.client_poc.title}`,
              size: 22,
              font: 'Arial',
            }),
          ],
        })
      );
      if (contract.client_poc.phone) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `Phone: ${contract.client_poc.phone}`,
                size: 22,
                font: 'Arial',
              }),
            ],
          })
        );
      }
      if (contract.client_poc.email) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `Email: ${contract.client_poc.email}`,
                size: 22,
                font: 'Arial',
              }),
            ],
            spacing: { after: 360 },
          })
        );
      }
    }
  }

  return paragraphs;
}

/**
 * Generate contract details table
 * Uses TableText10pt style for consistent professional formatting (Framework Part 3.4)
 */
function generateContractTable(contract: any): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  const details = [
    { label: 'Contract Name', value: contract.contract_name },
    { label: 'Contract Number', value: contract.contract_number },
    { label: 'Client Agency', value: contract.client_agency },
    { label: 'Contract Type', value: contract.contract_type },
    { label: 'Period of Performance', value: `${contract.start_date} to ${contract.end_date}` },
    { label: 'Contract Value', value: `$${contract.contract_value?.toLocaleString()}` },
    { label: 'Role', value: contract.role },
    { label: 'Team Size', value: contract.team_size?.toString() },
  ];

  for (const detail of details) {
    if (detail.value) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${detail.label}: `,
              bold: true,
              size: 20,
            }),
            new TextRun({
              text: detail.value,
              size: 20,
            }),
          ],
          style: 'TableText10pt', // Use defined table text style
          spacing: { after: 60 },
        })
      );
    }
  }

  paragraphs.push(
    new Paragraph({
      text: '',
      spacing: { after: 120 },
    })
  );

  return paragraphs;
}
