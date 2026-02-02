import { Paragraph, TextRun, HeadingLevel } from 'docx';

/**
 * Generate resume section (Framework Part 5.6)
 * For each key person:
 * - Header (name, role, clearance)
 * - Summary (3-5 bullets)
 * - Education table
 * - Certifications
 * - Work history (most recent first)
 */
export function generateResumes(personnel: any[]): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  // Filter to key personnel only
  const keyPersonnel = personnel.filter((p) =>
    p.proposed_roles?.some((r: any) => r.is_key_personnel)
  );

  for (let i = 0; i < keyPersonnel.length; i++) {
    const person = keyPersonnel[i];
    const keyRole = person.proposed_roles?.find((r: any) => r.is_key_personnel);

    if (!keyRole) continue;

    // Page break before each resume (except first)
    paragraphs.push(
      new Paragraph({
        text: `Resume: ${person.full_name}`,
        heading: HeadingLevel.HEADING_2,
        pageBreakBefore: i > 0,
        spacing: { after: 240 },
      })
    );

    // Header section
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'Proposed Position: ',
            bold: true,
            size: 22,
          }),
          new TextRun({
            text: keyRole.role_title,
            size: 22,
          }),
        ],
        spacing: { after: 120 },
      })
    );

    if (person.clearance_level && person.clearance_level !== 'None') {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'Clearance: ',
              bold: true,
              size: 22,
            }),
            new TextRun({
              text: `${person.clearance_level}${person.clearance_status ? ` (${person.clearance_status})` : ''}`,
              size: 22,
            }),
          ],
          spacing: { after: 120 },
        })
      );
    }

    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'Email: ',
            bold: true,
            size: 22,
          }),
          new TextRun({
            text: person.email || 'Available upon request',
            size: 22,
          }),
        ],
        spacing: { after: 240 },
      })
    );

    // Summary of experience
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'Summary of Experience',
            bold: true,
            size: 24,
          }),
        ],
        spacing: { before: 240, after: 120 },
      })
    );

    const summaryPoints = generateSummaryPoints(person);
    for (const point of summaryPoints) {
      paragraphs.push(
        new Paragraph({
          text: point,
          bullet: { level: 0 },
          style: 'BodyText11pt',
          spacing: { after: 120 },
        })
      );
    }

    // Education
    if (person.education && person.education.length > 0) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'Education',
              bold: true,
              size: 24,
            }),
          ],
          spacing: { before: 360, after: 120 },
        })
      );

      for (const edu of person.education) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `${edu.degree_level}`,
                bold: true,
                size: 22,
              }),
              new TextRun({
                text: ` in ${edu.field_of_study}`,
                size: 22,
              }),
            ],
            spacing: { after: 60 },
          })
        );
        paragraphs.push(
          new Paragraph({
            text: `${edu.institution}, ${edu.graduation_year}`,
            style: 'BodyText11pt',
            spacing: { after: 180 },
          })
        );
      }
    }

    // Certifications
    if (person.certifications && person.certifications.length > 0) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'Certifications',
              bold: true,
              size: 24,
            }),
          ],
          spacing: { before: 360, after: 120 },
        })
      );

      for (const cert of person.certifications) {
        const certText = `${cert.name} - ${cert.issuing_body}${cert.expiration_date ? ` (Expires: ${cert.expiration_date})` : ''}`;
        paragraphs.push(
          new Paragraph({
            text: certText,
            bullet: { level: 0 },
            style: 'BodyText11pt',
            spacing: { after: 120 },
          })
        );
      }
    }

    // Relevant experience / work history
    if (person.work_history && person.work_history.length > 0) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'Relevant Experience',
              bold: true,
              size: 24,
            }),
          ],
          spacing: { before: 360, after: 120 },
        })
      );

      // Show most recent 5 positions
      const recentPositions = person.work_history.slice(0, 5);

      for (const position of recentPositions) {
        // Job title and dates
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: position.job_title,
                bold: true,
                size: 22,
              }),
              new TextRun({
                text: ` | ${position.start_date} - ${position.end_date}`,
                size: 22,
              }),
            ],
            spacing: { before: 240, after: 60 },
          })
        );

        // Employer
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: position.employer,
                italics: true,
                size: 22,
              }),
              position.client_agency
                ? new TextRun({
                    text: ` (Supporting ${position.client_agency})`,
                    italics: true,
                    size: 20,
                  })
                : new TextRun({ text: '' }),
            ],
            spacing: { after: 120 },
          })
        );

        // Description
        if (position.description) {
          paragraphs.push(
            new Paragraph({
              text: position.description,
              style: 'BodyText11pt',
              spacing: { after: 120 },
            })
          );
        }

        // Relevant skills
        if (position.relevant_skills && position.relevant_skills.length > 0) {
          paragraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Key Skills: ',
                  italics: true,
                  size: 20,
                }),
                new TextRun({
                  text: position.relevant_skills.join(', '),
                  size: 20,
                }),
              ],
              spacing: { after: 180 },
            })
          );
        }
      }
    }
  }

  return paragraphs;
}

/**
 * Generate summary points from personnel record
 */
function generateSummaryPoints(person: any): string[] {
  const points: string[] = [];

  // Experience summary
  if (person.total_experience_years) {
    let expPoint = `${person.total_experience_years}+ years of professional experience`;
    if (person.federal_experience_years) {
      expPoint += `, including ${person.federal_experience_years} years in federal contracting`;
    }
    points.push(expPoint);
  }

  // Clearance
  if (person.clearance_level && person.clearance_level !== 'None') {
    points.push(`Holds ${person.clearance_level} security clearance`);
  }

  // Education highlight
  if (person.education && person.education.length > 0) {
    const highestDegree = person.education[0];
    points.push(`${highestDegree.degree_level} in ${highestDegree.field_of_study} from ${highestDegree.institution}`);
  }

  // Key certifications
  if (person.certifications && person.certifications.length > 0) {
    const certList = person.certifications
      .slice(0, 3)
      .map((c: any) => c.name)
      .join(', ');
    points.push(`Certified in: ${certList}`);
  }

  // Recent experience highlight
  if (person.work_history && person.work_history.length > 0) {
    const recent = person.work_history[0];
    points.push(`Most recently served as ${recent.job_title} at ${recent.employer}`);
  }

  return points;
}
