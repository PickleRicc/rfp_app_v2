import { Paragraph, TextRun, HeadingLevel } from 'docx';

/**
 * Generate Appendix C: Detailed Past Performance
 * Provides expanded details on past performance including full CPARS ratings,
 * detailed achievements, and comprehensive client feedback
 */
export function generateDetailedPastPerformanceAppendix(
  pastPerformance: any[]
): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  paragraphs.push(
    new Paragraph({
      text: 'Appendix C: Detailed Past Performance',
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 360 },
    })
  );

  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: 'This appendix provides detailed information on our past performance contracts, including comprehensive CPARS ratings, detailed achievements, and client feedback.',
          size: 22,
        }),
      ],
      spacing: { after: 480 },
    })
  );

  // Show top 5 contracts with full details
  const contracts = pastPerformance.slice(0, 5);

  for (let i = 0; i < contracts.length; i++) {
    const contract = contracts[i];

    // Contract header
    paragraphs.push(
      new Paragraph({
        text: `${i + 1}. ${contract.contract_nickname}`,
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 480, after: 240 },
      })
    );

    // Full CPARS Rating Details
    if (contract.cpars_rating) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'CPARS Performance Rating',
              bold: true,
              size: 24,
            }),
          ],
          spacing: { before: 240, after: 120 },
        })
      );

      const cpars = contract.cpars_rating;
      const ratingCategories = [
        { label: 'Overall Rating', value: cpars.overall },
        { label: 'Quality of Product/Service', value: cpars.quality },
        { label: 'Schedule/Timeliness', value: cpars.schedule },
        { label: 'Cost Control', value: cpars.cost_control },
        { label: 'Management/Business Relations', value: cpars.management },
        { label: 'Regulatory Compliance', value: cpars.regulatory_compliance },
      ];

      for (const category of ratingCategories) {
        if (category.value) {
          const color = getRatingColor(category.value);
          paragraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `${category.label}: `,
                  bold: true,
                  size: 22,
                }),
                new TextRun({
                  text: category.value,
                  size: 22,
                  color: color,
                  bold: true,
                }),
              ],
              bullet: { level: 0 },
              spacing: { after: 120 },
            })
          );
        }
      }

      if (cpars.date_of_rating) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `Date of Rating: ${cpars.date_of_rating}`,
                italics: true,
                size: 20,
              }),
            ],
            spacing: { before: 120, after: 240 },
          })
        );
      }
    }

    // Detailed Achievements
    if (contract.achievements && contract.achievements.length > 0) {
      const validAchievements = contract.achievements.filter((a: any) =>
        a && a.metric_type && a.statement && a.metric_value
      );

      if (validAchievements.length > 0) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: 'Detailed Performance Achievements',
                bold: true,
                size: 24,
              }),
            ],
            spacing: { before: 360, after: 180 },
          })
        );

        // Group achievements by metric type
        const achievementsByType: Record<string, any[]> = {};
        for (const achievement of validAchievements) {
          if (!achievementsByType[achievement.metric_type]) {
            achievementsByType[achievement.metric_type] = [];
          }
          achievementsByType[achievement.metric_type].push(achievement);
        }

        for (const [metricType, achievements] of Object.entries(achievementsByType)) {
          paragraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: metricType,
                  bold: true,
                  size: 22,
                  underline: {},
                }),
              ],
              spacing: { before: 180, after: 120 },
            })
          );

          for (const achievement of achievements) {
            paragraphs.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: achievement.statement,
                    size: 22,
                  }),
                  new TextRun({
                    text: ` (${achievement.metric_value})`,
                    size: 22,
                    bold: true,
                    color: '10b981',
                  }),
                ],
                bullet: { level: 1 },
                spacing: { after: 120 },
              })
            );
          }
        }
      }
    }

    // Customer Feedback
    if (contract.customer_feedback) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'Customer Feedback',
              bold: true,
              size: 24,
            }),
          ],
          spacing: { before: 360, after: 180 },
        })
      );

      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: contract.customer_feedback,
              size: 22,
              italics: true,
            }),
          ],
          spacing: { after: 240 },
        })
      );
    }

    // Scope and Scale Details
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'Contract Scope and Scale',
            bold: true,
            size: 24,
          }),
        ],
        spacing: { before: 360, after: 180 },
      })
    );

    const scopeDetails = [
      { label: 'Team Size', value: contract.team_size?.toString() },
      { label: 'Period of Performance', value: `${contract.start_date} to ${contract.end_date}` },
      { label: 'Contract Value', value: contract.contract_value ? `$${contract.contract_value.toLocaleString()}` : null },
      { label: 'Annual Value', value: contract.annual_value ? `$${contract.annual_value.toLocaleString()}` : null },
      { label: 'Place of Performance', value: contract.place_of_performance },
    ];

    for (const detail of scopeDetails) {
      if (detail.value) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `${detail.label}: `,
                bold: true,
                size: 22,
              }),
              new TextRun({
                text: detail.value,
                size: 22,
              }),
            ],
            bullet: { level: 0 },
            spacing: { after: 120 },
          })
        );
      }
    }

    // Tools and Technologies Used
    if (contract.tools_used && contract.tools_used.length > 0) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'Tools and Technologies Employed',
              bold: true,
              size: 24,
            }),
          ],
          spacing: { before: 360, after: 180 },
        })
      );

      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: contract.tools_used.join(', '),
              size: 22,
            }),
          ],
          spacing: { after: 240 },
        })
      );
    }

    // Client Contact Information (Full Details)
    if (contract.client_poc) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'Client Point of Contact (Reference)',
              bold: true,
              size: 24,
            }),
          ],
          spacing: { before: 360, after: 180 },
        })
      );

      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'Name: ',
              bold: true,
              size: 22,
            }),
            new TextRun({
              text: contract.client_poc.name,
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
              text: 'Title: ',
              bold: true,
              size: 22,
            }),
            new TextRun({
              text: contract.client_poc.title,
              size: 22,
            }),
          ],
          spacing: { after: 60 },
        })
      );

      if (contract.client_poc.phone) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: 'Phone: ',
                bold: true,
                size: 22,
              }),
              new TextRun({
                text: contract.client_poc.phone,
                size: 22,
              }),
            ],
            spacing: { after: 60 },
          })
        );
      }

      if (contract.client_poc.email) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: 'Email: ',
                bold: true,
                size: 22,
              }),
              new TextRun({
                text: contract.client_poc.email,
                size: 22,
              }),
            ],
            spacing: { after: 60 },
          })
        );
      }

      if (contract.client_poc.last_verified) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `Reference last verified: ${contract.client_poc.last_verified}`,
                italics: true,
                size: 20,
              }),
            ],
            spacing: { after: 240 },
          })
        );
      }
    }

    // Alternate contact if available
    if (contract.alternate_poc) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'Alternate Contact: ',
              bold: true,
              size: 22,
            }),
            new TextRun({
              text: `${contract.alternate_poc.name} (${contract.alternate_poc.title})`,
              size: 22,
            }),
          ],
          spacing: { after: 360 },
        })
      );
    }
  }

  return paragraphs;
}

/**
 * Get color for CPARS rating
 */
function getRatingColor(rating: string): string {
  const ratingLower = rating.toLowerCase();
  if (ratingLower.includes('exceptional')) return '10b981'; // Green
  if (ratingLower.includes('very good')) return '3b82f6'; // Blue
  if (ratingLower.includes('satisfactory')) return '6b7280'; // Gray
  if (ratingLower.includes('marginal')) return 'f59e0b'; // Orange
  if (ratingLower.includes('unsatisfactory')) return 'ef4444'; // Red
  return '000000'; // Black
}
