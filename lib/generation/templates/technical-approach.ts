import { Paragraph, TextRun, HeadingLevel, ImageRun, AlignmentType } from 'docx';
import { anthropic, MODEL } from '@/lib/anthropic/client';
import { formatRequirementReference, enhanceRequirementsWithCrossRefs, extractRfqSection } from '../content/cross-references';
import { getComplianceInstructions } from '../content/compliance-language';
import { getGhostingContext } from '../content/win-themes';
import { parseClaudeJSON } from '@/lib/anthropic/json-extractor';
import { getHeadingNumbering } from '../docx/numbering';
import { generateProcessDiagram } from '../exhibits/process-diagram';
import { cleanupTempFile } from '../exhibits/render';
import { readFile } from 'fs/promises';

/**
 * Generate Technical Approach section (Framework Part 5.2)
 * For each task area:
 * - Requirement box
 * - Understanding paragraph
 * - Approach narrative (what, how, who, when)
 * - Process exhibit reference
 * - Proof point from past performance
 * - Deliverables if applicable
 */
export async function generateTechnicalApproach(
  requirements: any[],
  companyData: any,
  taskAreas: string[]
): Promise<{ paragraphs: Paragraph[]; exhibits: any[] }> {
  const paragraphs: Paragraph[] = [];
  const exhibits: any[] = [];

  // NOTE: H1 heading is created by document generator from section.title
  // Templates should only create H2+ subsection headings and content paragraphs

  // Filter technical requirements
  const techReqs = requirements.filter((r) => r.category === 'technical');

  // If no explicit task areas, group by source section
  const areas = taskAreas.length > 0 ? taskAreas : extractTaskAreas(techReqs);

  // Generate section for each task area
  for (let i = 0; i < areas.length; i++) {
    const taskArea = areas[i];
    // Try to match requirements to task area by text
    let relevantReqs = techReqs.filter((r) =>
      r.source_section?.toLowerCase().includes(taskArea.toLowerCase()) ||
      r.requirement_text?.toLowerCase().includes(taskArea.toLowerCase())
    );

    // Fallback: if no text match, use all techReqs for first area or distribute evenly
    // This ensures deliverables are always generated (Framework Part 5.2)
    if (relevantReqs.length === 0 && techReqs.length > 0) {
      // Distribute requirements across task areas
      const reqsPerArea = Math.ceil(techReqs.length / areas.length);
      const startIdx = i * reqsPerArea;
      relevantReqs = techReqs.slice(startIdx, startIdx + reqsPerArea);
    }

    // Section heading with hierarchical numbering (1.1., 1.2., etc.)
    // Cross-references will be added by heading enhancer at volume level
    paragraphs.push(
      new Paragraph({
        text: taskArea,
        heading: HeadingLevel.HEADING_2,
        numbering: getHeadingNumbering(2),
        spacing: { before: 480, after: 240 },
      })
    );

    // Requirement box (Part 2.1) - Framework format with RFQ + PWS references
    if (relevantReqs.length > 0) {
      paragraphs.push(
        new Paragraph({
          text: 'This section addresses the following requirements:',
          style: 'RFPBold',
          spacing: { before: 120, after: 60 },
        })
      );

      for (const req of relevantReqs.slice(0, 5)) {
        // Extract RFQ and PWS references per Framework Part 2.1
        const rfqRef = req.rfq_section || extractRfqSection(req);
        const pwsRef = req.requirement_number || req.pws_requirement;
        
        // Format: "RFQ L.4.2; PWS REQ 3.1: Requirement text..."
        const refPrefix = [];
        if (rfqRef) refPrefix.push(`RFQ ${rfqRef}`);
        if (pwsRef) refPrefix.push(`PWS ${pwsRef}`);
        const refText = refPrefix.length > 0 ? `${refPrefix.join('; ')}: ` : '';
        
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `${refText}${req.requirement_text.substring(0, 180)}${req.requirement_text.length > 180 ? '...' : ''}`,
                size: 20,
                font: 'Arial',
              }),
            ],
            style: 'RFPBox',
            bullet: { level: 0 },
            spacing: { after: 60 },
          })
        );
      }

      paragraphs.push(new Paragraph({ text: '', spacing: { after: 240 } }));
    }

    // Generate approach content with AI
    const approach = await generateTaskAreaApproach(taskArea, relevantReqs, companyData);

    // Understanding paragraph with BoldIntro for first sentence (Framework Part 3.2)
    const understandingSentences = approach.understanding.split(/(?<=\.)\s+/);
    const firstSentence = understandingSentences[0] || approach.understanding;
    const remainderSentences = understandingSentences.slice(1).join(' ');

    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: firstSentence + ' ',
            bold: true, // BoldIntro effect
            size: 22,
            font: 'Arial',
          }),
          ...(remainderSentences ? [new TextRun({
            text: remainderSentences,
            size: 22,
            font: 'Arial',
          })] : []),
        ],
        spacing: { after: 240 },
      })
    );

    // Approach narrative
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: approach.methodology,
            size: 22,
            font: 'Arial',
          }),
        ],
        spacing: { after: 240 },
      })
    );

    // Benefits callout box (Framework Part 4.2)
    if (approach.benefit) {
      const benefitCallout = generateBenefitsCallout('Key Benefit', approach.benefit);
      paragraphs.push(...benefitCallout);
    }

    // Exhibit reference
    const exhibitNum = exhibits.length + 1;
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'As shown in ',
            size: 22,
            font: 'Arial',
          }),
          new TextRun({
            text: `Exhibit ${exhibitNum}`,
            bold: true,
            italics: true,
            size: 22,
            font: 'Arial',
          }),
          new TextRun({
            text: `, our proven ${taskArea} methodology ensures ${approach.benefit || 'successful delivery'}.`,
            size: 22,
            font: 'Arial',
          }),
        ],
        style: 'BodyText11pt',
        spacing: { after: 240 },
      })
    );

    // Generate process diagram showing technical workflow
    const processSteps = [
      'Receive Requirements',
      'Analyze Scope',
      'Design Solution',
      'Implement',
      'Test & Validate',
      'Deploy & Monitor'
    ];

    const processDiagramPath = await generateProcessDiagram(
      `${taskArea} Workflow`,
      processSteps
    );

    if (processDiagramPath) {
      const imageBuffer = await readFile(processDiagramPath);

      paragraphs.push(
        new Paragraph({
          children: [
            new ImageRun({
              data: imageBuffer,
              transformation: {
                width: 500,
                height: 300,
              },
              type: 'png',
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { before: 240, after: 120 },
        })
      );

      // Caption
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Exhibit ${exhibitNum}. ${taskArea} Workflow`,
              bold: true,
              size: 20,
              font: 'Arial',
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 360 },
        })
      );

      // Cleanup temp file
      await cleanupTempFile(processDiagramPath);
    }

    exhibits.push({
      type: 'process_diagram',
      title: `${taskArea} Methodology`,
      number: exhibitNum,
      task_area: taskArea,
    });

    // Proof point from past performance with IntenseReference for contract name (Framework Part 3.2)
    const relevantContract = findRelevantPastPerformance(taskArea, companyData.pastPerformance);
    if (relevantContract) {
      const achievement = relevantContract.achievements[0] || {};
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Proven Track Record: `,
              bold: true,
              size: 22,
              font: 'Arial',
            }),
            new TextRun({
              text: `On `,
              size: 22,
              font: 'Arial',
            }),
            new TextRun({
              text: relevantContract.contract_nickname,
              italics: true, // IntenseReference effect
              color: '1e40af',
              size: 22,
              font: 'Arial',
            }),
            new TextRun({
              text: ` for ${relevantContract.client_agency}, we ${achievement.statement || 'delivered exceptional results'}.`,
              size: 22,
              font: 'Arial',
            }),
          ],
          style: 'BodyText11pt',
          spacing: { after: 360 },
        })
      );
    }

    // Deliverables subsection (Framework Part 5.2)
    if (relevantReqs.length > 0) {
      const deliverablesParagraphs = await generateDeliverablesSubsection(taskArea, relevantReqs, companyData);
      paragraphs.push(...deliverablesParagraphs);
    }
  }

  return { paragraphs, exhibits };
}

/**
 * Generate approach content for a task area using AI
 */
async function generateTaskAreaApproach(
  taskArea: string,
  requirements: any[],
  companyData: any
): Promise<any> {
  try {
    console.log(`🤖 Calling Anthropic API for task area: ${taskArea}`);
    
    const complianceInstructions = getComplianceInstructions(companyData.profile.company_name);
    const ghostingContext = getGhostingContext(companyData.competitiveAdvantages || []);
    
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 3072,
      messages: [
        {
          role: 'user',
          content: `${complianceInstructions}

${ghostingContext}

Write a technical approach for: ${taskArea}

Requirements to address:
${requirements.slice(0, 5).map((r) => `- ${r.requirement_number || 'REQ'}: ${r.requirement_text}`).join('\n')}

Company: ${companyData.profile.company_name}

Company capabilities:
${companyData.serviceAreas.slice(0, 3).map((s: any) => `- ${s.service_name}: ${s.description}`).join('\n')}

Tools available:
${companyData.toolsTechnologies?.slice(0, 5).map((t: any) => `- ${t.name} (${t.proficiency})`).join('\n') || 'Standard industry tools'}

Write 2 paragraphs following COMPLIANCE LANGUAGE RULES above:

1. Understanding Paragraph (2-3 sentences):
   - Restate requirement showing understanding
   - Use pattern: "[Agency/Customer] requires [summary]. ${companyData.profile.company_name} will [approach]."
   - Acknowledge the challenges

2. Methodology Paragraph (3-4 sentences):
   - Start with "${companyData.profile.company_name} will [verb from requirement]..."
   - WHAT you will do (deliverables, outcomes)
   - HOW you will do it (process, tools, specific steps)
   - WHO will do it (roles referenced)
   - WHEN/how often (timeline, frequency)

Also provide a one-sentence benefit statement.

Respond in JSON:
{
  "understanding": "understanding paragraph with compliance language",
  "methodology": "methodology paragraph with ${companyData.profile.company_name} will [action]",
  "benefit": "one sentence benefit"
}`,
        },
      ],
    });

    console.log(`✅ Anthropic API response received for ${taskArea}`);

    const content = response.content[0];
    if (content.type !== 'text') {
      console.error('❌ Unexpected response type:', content.type);
      throw new Error('Unexpected response type');
    }

    try {
      const parsed = parseClaudeJSON(content.text);
      console.log(`✅ Successfully parsed technical approach JSON for ${taskArea}`);
      return parsed;
    } catch (e) {
      console.warn(`⚠️  Failed to parse JSON for ${taskArea}, using fallback. Error:`, e);
      return {
        understanding: `We understand the ${taskArea} requirements and will deliver a comprehensive solution.`,
        methodology: `Our approach combines industry best practices with proven methodologies to ensure successful delivery.`,
        benefit: 'on-time, high-quality delivery',
      };
    }
  } catch (error) {
    console.error(`❌ Error calling Anthropic API for ${taskArea}:`, error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
    }
    throw error; // Re-throw to be caught by caller
  }
}

/**
 * Extract task areas from requirements
 */
function extractTaskAreas(requirements: any[]): string[] {
  const areas = new Set<string>();

  for (const req of requirements) {
    // Extract from source section
    if (req.source_section) {
      const match = req.source_section.match(/(?:PWS|SOW)\s+(\d+\.?\d*)\s*-?\s*([^,;]*)/i);
      if (match && match[2]) {
        areas.add(match[2].trim());
      }
    }
  }

  if (areas.size === 0) {
    // Default task areas
    return ['System Development', 'Implementation', 'Testing & Quality Assurance', 'Support & Maintenance'];
  }

  return Array.from(areas).slice(0, 10); // Limit to 10 task areas
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
 * Generate Deliverables subsection for a task area (Framework Part 5.2)
 */
async function generateDeliverablesSubsection(
  taskArea: string,
  requirements: any[],
  companyData: any
): Promise<Paragraph[]> {
  const paragraphs: Paragraph[] = [];

  // H3 heading: Deliverables
  paragraphs.push(
    new Paragraph({
      text: 'Deliverables',
      heading: HeadingLevel.HEADING_3,
      numbering: getHeadingNumbering(3),
      spacing: { before: 360, after: 120 },
    })
  );

  try {
    // Generate deliverables list using AI
    const deliverables = await generateDeliverablesList(taskArea, requirements, companyData);

    // Add deliverable items as bullets
    for (const deliverable of deliverables) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${deliverable.name}: `,
              bold: true,
              size: 22,
              font: 'Arial',
            }),
            new TextRun({
              text: `${deliverable.description} (${deliverable.format})`,
              size: 22,
              font: 'Arial',
            }),
          ],
          style: 'Bullet1',
          spacing: { after: 120 },
        })
      );
    }

    // Reference to appendix if applicable
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'Sample deliverables are provided in the Appendix for reference.',
            size: 22,
            font: 'Arial',
            italics: true,
          }),
        ],
        spacing: { before: 120, after: 360 },
      })
    );
  } catch (error) {
    console.error(`❌ Error generating deliverables for ${taskArea}:`, error);
    // Fallback: generic deliverables
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'Detailed deliverables will include documentation, reports, and work products as specified in the requirements.',
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
 * Generate deliverables list using AI
 */
async function generateDeliverablesList(
  taskArea: string,
  requirements: any[],
  companyData: any
): Promise<Array<{ name: string; description: string; format: string }>> {
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: `Generate 3-5 specific deliverables for: ${taskArea}

Requirements context:
${requirements.slice(0, 5).map((r) => `- ${r.requirement_text.substring(0, 150)}`).join('\n')}

For each deliverable, provide:
- name: Short deliverable name (2-5 words)
- description: What it contains/provides (1-2 sentences)
- format: Document type (e.g., "Report", "Technical Document", "Database", "Presentation", "Plan")

Respond in JSON array format:
[
  {
    "name": "deliverable name",
    "description": "what it provides",
    "format": "document type"
  }
]`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    const parsed = parseClaudeJSON(content.text);

    // Validate and limit to 3-5 items
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.slice(0, 5);
    }

    throw new Error('Invalid deliverables format');
  } catch (error) {
    console.warn(`⚠️  Failed to generate deliverables list for ${taskArea}, using fallback`);
    // Generic fallback deliverables
    return [
      { name: 'Technical Documentation', description: 'Comprehensive documentation of approach and implementation', format: 'Technical Document' },
      { name: 'Status Reports', description: 'Weekly progress reports with metrics and milestones', format: 'Report' },
      { name: 'Deliverable Acceptance', description: 'Formal acceptance documentation for completed deliverables', format: 'Form' },
    ];
  }
}

/**
 * Find relevant past performance contract
 */
function findRelevantPastPerformance(taskArea: string, pastPerformance: any[]): any | null {
  const taskAreaLower = taskArea.toLowerCase();

  for (const contract of pastPerformance) {
    // Check if task area is in contract's task areas or description
    if (
      contract.task_areas?.some((ta: string) => ta.toLowerCase().includes(taskAreaLower) || taskAreaLower.includes(ta.toLowerCase())) ||
      contract.overview?.toLowerCase().includes(taskAreaLower) ||
      contract.description_of_effort?.toLowerCase().includes(taskAreaLower)
    ) {
      return contract;
    }
  }

  // Return first contract if no specific match
  return pastPerformance[0] || null;
}
