import { Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, VerticalAlign } from 'docx';
import { anthropic, MODEL } from '@/lib/anthropic/client';
import { formatRequirementReference, enhanceRequirementsWithCrossRefs } from '../content/cross-references';
import { getComplianceInstructions } from '../content/compliance-language';
import { getGhostingContext } from '../content/win-themes';
import { getHeadingNumbering } from '../docx/numbering';

/**
 * Generate Management Approach section (Framework Part 5.3)
 * Includes:
 * - Management philosophy
 * - Org chart exhibit
 * - Key personnel
 * - Staffing approach
 * - Communication plan
 * - QC approach
 */
export async function generateManagementApproach(
  requirements: any[],
  companyData: any
): Promise<{ paragraphs: Paragraph[]; exhibits: any[] }> {
  console.log('🎯 generateManagementApproach called');
  console.log('📊 Input data:', {
    requirementsCount: requirements?.length || 0,
    hasCompanyData: !!companyData,
    hasProfile: !!companyData?.profile,
  });
  
  const paragraphs: Paragraph[] = [];
  const exhibits: any[] = [];

  // NOTE: H1 heading is created by document generator from section.title
  // Templates should only create H2+ subsection headings and content paragraphs

  // Management philosophy
  console.log('🔄 About to call generateManagementPhilosophy...');
  const philosophy = await generateManagementPhilosophy(requirements, companyData);
  console.log('✅ generateManagementPhilosophy returned length:', philosophy?.length || 0);
  
  paragraphs.push(
    new Paragraph({
      text: 'Management Philosophy',
      heading: HeadingLevel.HEADING_2,
      numbering: getHeadingNumbering(2),
      spacing: { before: 240, after: 120 },
    })
  );
  // Apply BoldIntro to first sentence (Framework Part 3.2)
  const philosophySentences = philosophy.split(/(?<=\.)\s+/);
  const firstPhilosophySentence = philosophySentences[0] || philosophy;
  const remainingPhilosophy = philosophySentences.slice(1).join(' ');

  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: firstPhilosophySentence + ' ',
          bold: true, // BoldIntro effect
          size: 22,
          font: 'Arial',
        }),
        ...(remainingPhilosophy ? [new TextRun({
          text: remainingPhilosophy,
          size: 22,
          font: 'Arial',
        })] : []),
      ],
      spacing: { after: 240 },
    })
  );

  // Benefits callout: Management Philosophy
  const philosophyBenefit = generateBenefitsCallout(
    'Key Benefit',
    'Our management approach ensures seamless coordination, rapid issue resolution, and consistent delivery of high-quality results that exceed customer expectations.'
  );
  paragraphs.push(...philosophyBenefit);

  // Organizational structure with org chart exhibit
  paragraphs.push(
    new Paragraph({
      text: 'Organizational Structure',
      heading: HeadingLevel.HEADING_2,
      numbering: getHeadingNumbering(2),
      spacing: { before: 360, after: 120 },
    })
  );

  const exhibitNum = exhibits.length + 1;
  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `${companyData.profile.company_name} will employ a proven organizational structure designed for efficient project delivery. `,
          size: 22,
        }),
        new TextRun({
          text: `Exhibit ${exhibitNum}`,
          bold: true,
          italics: true,
          size: 22,
        }),
        new TextRun({
          text: ' shows our proposed organizational chart with clear reporting relationships and lines of authority.',
          size: 22,
        }),
      ],
      style: 'BodyText11pt',
      spacing: { after: 240 },
    })
  );

  exhibits.push({
    type: 'org_chart',
    title: 'Proposed Organizational Chart',
    number: exhibitNum,
  });

  // Benefits callout: Organizational Structure - reference past performance
  const orgBenefit = generateBenefitsCallout(
    'Proven Results',
    `This organizational model has successfully delivered ${companyData.pastPerformance?.length || 'multiple'} federal contracts with consistent on-time, on-budget performance and high customer satisfaction ratings.`
  );
  paragraphs.push(...orgBenefit);

  // Key personnel section
  paragraphs.push(...generateKeyPersonnelSection(companyData.personnel));

  // Staffing approach with BoldIntro (Framework Part 3.2)
  const staffing = await generateStaffingApproach(requirements, companyData);
  paragraphs.push(
    new Paragraph({
      text: 'Staffing Approach',
      heading: HeadingLevel.HEADING_2,
      numbering: getHeadingNumbering(2),
      spacing: { before: 360, after: 120 },
    })
  );

  const staffingSentences = staffing.split(/(?<=\.)\s+/);
  const firstStaffingSentence = staffingSentences[0] || staffing;
  const remainingStaffing = staffingSentences.slice(1).join(' ');

  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: firstStaffingSentence + ' ',
          bold: true, // BoldIntro effect
          size: 22,
          font: 'Arial',
        }),
        ...(remainingStaffing ? [new TextRun({
          text: remainingStaffing,
          size: 22,
          font: 'Arial',
        })] : []),
      ],
      spacing: { after: 240 },
    })
  );

  // Communication plan
  const communication = await generateCommunicationPlan(requirements, companyData);
  paragraphs.push(
    new Paragraph({
      text: 'Communication Plan',
      heading: HeadingLevel.HEADING_2,
      numbering: getHeadingNumbering(2),
      spacing: { before: 360, after: 120 },
    })
  );
  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: communication,
          size: 22,
          font: 'Arial',
        }),
      ],
      spacing: { after: 240 },
    })
  );

  // Quality control
  const qc = await generateQCApproach(requirements, companyData);
  paragraphs.push(
    new Paragraph({
      text: 'Quality Control Plan',
      heading: HeadingLevel.HEADING_2,
      numbering: getHeadingNumbering(2),
      spacing: { before: 360, after: 120 },
    })
  );
  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: qc,
          size: 22,
          font: 'Arial',
        }),
      ],
      spacing: { after: 240 },
    })
  );

  // Benefits callout: Quality Control - risk mitigation
  const qcBenefit = generateBenefitsCallout(
    'Risk Mitigation',
    'Our rigorous quality control processes identify and resolve issues early, reducing risk of defects, schedule delays, and cost overruns.'
  );
  paragraphs.push(...qcBenefit);

  return { paragraphs, exhibits };
}

/**
 * Generate Benefits callout box (Framework Part 4.2)
 */
function generateBenefitsCallout(
  benefitType: 'Key Benefit' | 'Proven Results' | 'Innovation Spotlight' | 'Risk Mitigation',
  content: string
): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  // Heading paragraph with CalloutBoxHeading style
  paragraphs.push(
    new Paragraph({
      text: benefitType,
      style: 'CalloutBoxHeading',
    })
  );

  // Content paragraph(s) with CalloutBox style
  // Split content by newlines if present
  const contentLines = content.split('\n').filter((line) => line.trim().length > 0);

  for (const line of contentLines) {
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: line,
            size: 20,
            font: 'Arial',
          }),
        ],
        style: 'CalloutBox',
      })
    );
  }

  return paragraphs;
}

/**
 * Generate key personnel section with table
 */
function generateKeyPersonnelSection(personnel: any[]): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  paragraphs.push(
    new Paragraph({
      text: 'Key Personnel',
      heading: HeadingLevel.HEADING_2,
      numbering: getHeadingNumbering(2),
      spacing: { before: 360, after: 120 },
    })
  );

  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: 'Our team consists of highly qualified professionals with extensive relevant experience:',
          size: 22,
          font: 'Arial',
        }),
      ],
      spacing: { after: 240 },
    })
  );

  // Key personnel only
  const keyPersonnel = personnel.filter((p) =>
    p.proposed_roles?.some((r: any) => r.is_key_personnel)
  ).slice(0, 10);

  for (const person of keyPersonnel) {
    const role = person.proposed_roles?.find((r: any) => r.is_key_personnel);
    if (!role) continue;

    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `${person.full_name}, ${role.role_title}`,
            bold: true,
            size: 22,
          }),
        ],
        spacing: { before: 180, after: 60 },
      })
    );

    const summary = `${person.total_experience_years} years of experience${person.federal_experience_years ? `, including ${person.federal_experience_years} years in federal contracting` : ''}. ${person.clearance_level ? `Holds ${person.clearance_level} clearance.` : ''}`;

    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: summary,
            size: 22,
            font: 'Arial',
          }),
        ],
        spacing: { after: 120 },
      })
    );

    // Education
    if (person.education && person.education.length > 0) {
      const edu = person.education[0];
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Education: ', italics: true, size: 20, font: 'Arial' }),
            new TextRun({ text: `${edu.degree_level} in ${edu.field_of_study}, ${edu.institution}`, size: 20, font: 'Arial' }),
          ],
          spacing: { after: 120 },
        })
      );
    }

    // Relevant experience highlight
    if (person.work_history && person.work_history.length > 0) {
      const recentWork = person.work_history[0];
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Recent Experience: ', italics: true, size: 20, font: 'Arial' }),
            new TextRun({ text: `${recentWork.job_title} at ${recentWork.employer}. ${recentWork.description?.substring(0, 150) || ''}`, size: 20, font: 'Arial' }),
          ],
          spacing: { after: 180 },
        })
      );
    }
  }

  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: 'Full resumes for key personnel are provided in Appendix A.',
          size: 22,
          font: 'Arial',
        }),
      ],
      spacing: { before: 240, after: 360 },
    })
  );

  return paragraphs;
}

/**
 * Generate management philosophy
 */
async function generateManagementPhilosophy(requirements: any[], companyData: any): Promise<string> {
  try {
    console.log('🤖 Calling Anthropic API for management philosophy...');
    
    const complianceInstructions = getComplianceInstructions(companyData.profile.company_name);
    const ghostingContext = getGhostingContext(companyData.competitiveAdvantages || []);
    const managementReqs = requirements.filter((r) => r.category === 'management').slice(0, 5);
    
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: `${complianceInstructions}

${ghostingContext}

Write a management philosophy statement (2-3 paragraphs) for a proposal.

Company: ${companyData.profile.company_name}
Mission: ${companyData.profile.mission_statement || companyData.profile.elevator_pitch}

Requirements to address:
${managementReqs.map((r) => `- ${r.requirement_number || 'REQ'}: ${r.requirement_text.substring(0, 150)}`).join('\n')}

Include (following COMPLIANCE LANGUAGE RULES):
- Start with: "${companyData.profile.company_name} will [management approach]..."
- Overall management approach with specific actions
- Guiding principles tied to requirements
- Alignment to customer culture
- Focus on communication, accountability, and results
- Use compliance language patterns for any "shall" or "must" requirements

Write in professional business language. Return only the paragraphs, no headings.`,
        },
      ],
    });

    console.log('✅ Management philosophy generated');
    const content = response.content[0];
    return content.type === 'text' ? content.text : 'Our management approach emphasizes clear communication, accountability, and results-driven execution.';
  } catch (error) {
    console.error('❌ Error generating management philosophy:', error);
    throw error;
  }
}

/**
 * Generate staffing approach
 */
async function generateStaffingApproach(requirements: any[], companyData: any): Promise<string> {
  const complianceInstructions = getComplianceInstructions(companyData.profile.company_name);
  
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `${complianceInstructions}

Write a staffing approach paragraph for a proposal.

Company: ${companyData.profile.company_name}
Available personnel: ${companyData.personnel.length}
Key personnel: ${companyData.personnel.filter((p: any) => p.proposed_roles?.some((r: any) => r.is_key_personnel)).length}

Include (following COMPLIANCE LANGUAGE RULES):
- Start with "${companyData.profile.company_name} will staff..."
- Labor mix rationale with specific numbers/percentages
- Surge capacity approach
- Retention strategy with concrete mechanisms
- Quality of personnel with credentials

Write 1-2 paragraphs. Return only the paragraphs, no headings.`,
      },
    ],
  });

  const content = response.content[0];
  return content.type === 'text' ? content.text : 'Our staffing approach ensures the right mix of skills and experience for successful project delivery.';
}

/**
 * Generate communication plan
 */
async function generateCommunicationPlan(requirements: any[], companyData: any): Promise<string> {
  const complianceInstructions = getComplianceInstructions(companyData.profile.company_name);
  
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `${complianceInstructions}

Write a communication plan (1-2 paragraphs) for a government contract proposal.

Company: ${companyData.profile.company_name}

Include (following COMPLIANCE LANGUAGE RULES):
- Start with "${companyData.profile.company_name} will implement..."
- Meeting cadence (weekly, monthly) with specific days/times
- Reporting structure with named roles
- Escalation procedures with timeframes
- Stakeholder engagement approach with methods

Be specific about frequency and methods. Return only the paragraphs, no headings.`,
      },
    ],
  });

  const content = response.content[0];
  return content.type === 'text' ? content.text : 'Our communication plan ensures regular, structured interaction with all stakeholders through weekly status meetings, monthly reviews, and real-time issue escalation.';
}

/**
 * Generate QC approach
 */
async function generateQCApproach(requirements: any[], companyData: any): Promise<string> {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `Write a Quality Control approach (1-2 paragraphs) for a government contract proposal.

Include:
- QC processes and review cycles
- Metrics and measurement
- Continuous improvement
- Quality standards

Be specific and professional. Return only the paragraphs, no headings.`,
      },
    ],
  });

  const content = response.content[0];
  return content.type === 'text' ? content.text : 'Our quality control plan implements rigorous review cycles, continuous monitoring, and adherence to industry standards to ensure excellence in all deliverables.';
}
