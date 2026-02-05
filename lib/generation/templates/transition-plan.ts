import { Paragraph, TextRun, HeadingLevel, ImageRun, AlignmentType } from 'docx';
import { anthropic, MODEL } from '@/lib/anthropic/client';
import { formatRequirementReference, enhanceRequirementsWithCrossRefs } from '../content/cross-references';
import { parseClaudeJSON } from '@/lib/anthropic/json-extractor';
import { getHeadingNumbering } from '../docx/numbering';
import { generateGanttChart, TimelinePhase } from '../exhibits/timeline';
import { cleanupTempFile } from '../exhibits/render';
import { readFile } from 'fs/promises';

/**
 * Generate Transition Plan section (Framework Part 5.4)
 * 4-phase structure:
 * - Phase 1: Planning & Preparation
 * - Phase 2: Knowledge Transfer
 * - Phase 3: Parallel Operations
 * - Phase 4: Full Assumption
 * Includes timeline exhibit (Gantt chart)
 */
export async function generateTransitionPlan(
  requirements: any[]
): Promise<{ paragraphs: Paragraph[]; exhibits: any[] }> {
  const paragraphs: Paragraph[] = [];
  const exhibits: any[] = [];

  // NOTE: H1 heading is created by document generator from section.title
  // Templates should only create H2+ subsection headings and content paragraphs

  // Introduction
  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: 'Our transition approach is designed to ensure seamless continuity of operations with minimal disruption to ongoing activities. We employ a proven four-phase methodology that has been successfully executed on multiple similar transitions.',
          size: 22,
          font: 'Arial',
        }),
      ],
      spacing: { after: 360 },
    })
  );

  // Timeline exhibit reference
  const exhibitNum = exhibits.length + 1;
  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Exhibit ${exhibitNum}`,
          bold: true,
          italics: true,
          size: 22,
        }),
        new TextRun({
          text: ' provides a detailed timeline showing our transition phases, key milestones, and deliverables.',
          size: 22,
        }),
      ],
      style: 'BodyText11pt',
      spacing: { after: 240 },
    })
  );

  // Generate actual Gantt chart
  const timelinePhases: TimelinePhase[] = [
    { name: 'Planning & Preparation', duration: 30, milestone: 'Plan Approved' },
    { name: 'Knowledge Transfer', duration: 45, milestone: 'KT Complete' },
    { name: 'Parallel Operations', duration: 30, milestone: 'Parallel Verified' },
    { name: 'Full Assumption', duration: 15, milestone: 'Contract Operational' },
  ];

  const timelinePath = await generateGanttChart(timelinePhases, 'Transition Timeline');

  if (timelinePath) {
    const imageBuffer = await readFile(timelinePath);

    paragraphs.push(
      new Paragraph({
        children: [
          new ImageRun({
            data: imageBuffer,
            transformation: {
              width: 550,  // Wider for Gantt readability
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
            text: `Exhibit ${exhibitNum}. Transition Timeline and Milestones`,
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
    await cleanupTempFile(timelinePath);
  }

  exhibits.push({
    type: 'timeline',
    title: 'Transition Timeline and Milestones',
    number: exhibitNum,
  });

  // Generate each phase
  const phases = [
    {
      number: 1,
      name: 'Planning & Preparation',
      days: 'Days 1-30',
      description: 'Initial setup, team mobilization, and planning activities',
    },
    {
      number: 2,
      name: 'Knowledge Transfer',
      days: 'Days 31-75',
      description: 'Comprehensive knowledge transfer from incumbent contractor',
    },
    {
      number: 3,
      name: 'Parallel Operations',
      days: 'Days 76-105',
      description: 'Side-by-side operations with incumbent to ensure quality',
    },
    {
      number: 4,
      name: 'Full Assumption',
      days: 'Day 106+',
      description: 'Complete assumption of all responsibilities',
    },
  ];

  for (const phase of phases) {
    const phaseContent = await generatePhaseContent(phase, requirements);

      paragraphs.push(
        new Paragraph({
          text: `Phase ${phase.number}: ${phase.name} (${phase.days})`,
          heading: HeadingLevel.HEADING_2,
          numbering: getHeadingNumbering(2),
          spacing: { before: 360, after: 120 },
        })
      );

    // 🔧 FIX: Use TextRun with explicit size and font
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: phaseContent.overview,
            size: 22,  // 11pt = 22 half-points
            font: 'Arial',
          }),
        ],
        spacing: { after: 180 },
      })
    );

    // Key activities
    if (phaseContent.activities && phaseContent.activities.length > 0) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'Key Activities:',
              bold: true,
              size: 22,
            }),
          ],
          spacing: { before: 120, after: 60 },
        })
      );

      for (const activity of phaseContent.activities) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: activity,
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

    // Deliverables
    if (phaseContent.deliverables && phaseContent.deliverables.length > 0) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'Deliverables:',
              bold: true,
              size: 22,
            }),
          ],
          spacing: { before: 180, after: 60 },
        })
      );

      for (const deliverable of phaseContent.deliverables) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: deliverable,
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

    // Success criteria
    if (phaseContent.successCriteria) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'Success Criteria: ',
              bold: true,
              size: 22,
            }),
            new TextRun({
              text: phaseContent.successCriteria,
              size: 22,
            }),
          ],
          style: 'BodyText11pt',
          spacing: { before: 180, after: 240 },
        })
      );
    }
  }

  // Risk mitigation
  paragraphs.push(
    new Paragraph({
      text: 'Transition Risks and Mitigation',
      heading: HeadingLevel.HEADING_2,
      numbering: getHeadingNumbering(2),
      spacing: { before: 480, after: 120 },
    })
  );

  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: 'We have identified potential transition risks and developed specific mitigation strategies:',
          size: 22,
          font: 'Arial',
        }),
      ],
      spacing: { after: 180 },
    })
  );

  const risks = [
    'Knowledge Loss: Overlap period with incumbent, comprehensive documentation',
    'Personnel Clearances: Early submission of clearance requests, backup personnel',
    'System Access: Pre-transition coordination, phased access implementation',
    'Operational Continuity: Parallel operations period, contingency plans',
  ];

  for (const risk of risks) {
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: risk,
            size: 22,
            font: 'Arial',
          }),
        ],
        bullet: { level: 0 },
        spacing: { after: 120 },
      })
    );
  }

  return { paragraphs, exhibits };
}

/**
 * Generate content for a specific transition phase
 */
async function generatePhaseContent(phase: any, requirements: any[]): Promise<any> {
  try {
    console.log(`🤖 Calling Anthropic API for transition phase: ${phase.name}`);
    
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: `Generate content for transition Phase ${phase.number}: ${phase.name} (${phase.days})

Description: ${phase.description}

Requirements context:
${requirements.slice(0, 3).map((r) => r.requirement_text.substring(0, 100)).join('\n')}

Provide:
1. Overview paragraph (2-3 sentences) describing what happens in this phase
2. 3-5 key activities
3. 2-4 deliverables
4. Success criteria (1 sentence)

Respond in JSON format:
{
  "overview": "overview paragraph",
  "activities": ["activity 1", "activity 2", ...],
  "deliverables": ["deliverable 1", "deliverable 2", ...],
  "successCriteria": "success criteria"
}`,
      },
    ],
    });

    console.log(`✅ Transition phase content generated for ${phase.name}`);

    const content = response.content[0];
    if (content.type !== 'text') {
      console.error('❌ Unexpected response type:', content.type);
      throw new Error('Unexpected response type');
    }

    try {
      const parsed = parseClaudeJSON(content.text);
      console.log(`✅ Successfully parsed transition phase JSON for ${phase.name}`);
      return parsed;
    } catch (e) {
      console.warn(`⚠️  Failed to parse JSON for phase ${phase.name}, using fallback. Error:`, e);
      return {
        overview: phase.description,
        activities: [
          'Coordinate with stakeholders',
          'Execute planned activities',
          'Monitor progress',
        ],
        deliverables: ['Phase completion report', 'Updated documentation'],
        successCriteria: 'All phase objectives achieved on schedule',
      };
    }
  } catch (error) {
    console.error(`❌ Error generating transition phase ${phase.name}:`, error);
    throw error;
  }
}
