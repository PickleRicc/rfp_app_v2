import { Paragraph, TextRun, HeadingLevel } from 'docx';
import { anthropic, MODEL } from '@/lib/anthropic/client';
import { parseClaudeJSON } from '@/lib/anthropic/json-extractor';

/**
 * Generate Executive Summary section (Framework Part 5.1)
 * Structure:
 * - Opening paragraph (company + value prop)
 * - Understanding of agency mission
 * - Solution overview
 * - Why Us (discriminators + proof points)
 * Length: 1-2 pages
 */
export async function generateExecutiveSummary(
  requirements: any[],
  companyData: any,
  rfpContext: string
): Promise<Paragraph[]> {
  console.log('🎯 generateExecutiveSummary called');
  console.log('📊 Input data:', {
    requirementsCount: requirements?.length || 0,
    hasCompanyData: !!companyData,
    hasProfile: !!companyData?.profile,
    rfpContext: rfpContext?.substring(0, 50),
  });
  
  const paragraphs: Paragraph[] = [];

  // NOTE: H1 heading is created by document generator from section.title
  // Templates should only create H2+ subsection headings and content paragraphs

  // Generate AI content
  console.log('🔄 About to call generateExecutiveSummaryContent...');
  const content = await generateExecutiveSummaryContent(requirements, companyData, rfpContext);
  console.log('✅ generateExecutiveSummaryContent returned:', !!content);

  // Opening paragraph
  if (content.opening) {
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: content.opening,
            size: 22,
            font: 'Arial',
          }),
        ],
        spacing: { after: 240 },
      })
    );
  }

  // Understanding section
  if (content.understanding) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'Understanding of Your Mission',
              bold: true,
              size: 24,
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
              text: content.understanding,
              size: 22,
              font: 'Arial',
            }),
          ],
          spacing: { after: 240 },
        })
      );
  }

  // Solution overview
  if (content.solution) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'Our Solution',
              bold: true,
              size: 24,
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
              text: content.solution,
              size: 22,
              font: 'Arial',
            }),
          ],
          spacing: { after: 240 },
        })
      );
  }

  // Why Us section with discriminators
  if (content.whyUs && content.discriminators) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Why ${companyData.profile.company_name}`,
              bold: true,
              size: 24,
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
              text: content.whyUs,
              size: 22,
              font: 'Arial',
            }),
          ],
          spacing: { after: 180 },
        })
      );

      // Key discriminators as bullets
      for (const discriminator of content.discriminators) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: discriminator,
                size: 22,
                font: 'Arial',
              }),
            ],
            bullet: { level: 0 },
            spacing: { after: 120 },
          })
        );
      }
  }

  return paragraphs;
}

/**
 * Generate executive summary content using AI
 */
async function generateExecutiveSummaryContent(
  requirements: any[],
  companyData: any,
  rfpContext: string
): Promise<any> {
  try {
    console.log('🤖 Calling Anthropic API for executive summary...');
    
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `You are writing an Executive Summary for a professional government proposal. Follow this structure:

Company Information:
- Company: ${companyData.profile.company_name}
- Elevator Pitch: ${companyData.profile.elevator_pitch}
- Mission: ${companyData.profile.mission_statement || 'Not provided'}

Past Performance Highlights:
${companyData.pastPerformance.slice(0, 3).map((p: any) => `- ${p.contract_nickname} for ${p.client_agency}: ${p.achievements[0]?.statement || 'Successful delivery'}`).join('\n')}

Value Propositions:
${companyData.valuePropositions.slice(0, 3).map((v: any) => `- ${v.theme}: ${v.statement}`).join('\n')}

RFP Context:
${rfpContext}

Key Requirements:
${requirements.slice(0, 10).map((r: any) => `- ${r.requirement_text.substring(0, 200)}`).join('\n')}

Write an Executive Summary with these sections:

1. Opening Paragraph (2-3 sentences):
   - Introduce the company and team
   - State your single-sentence value proposition
   - Reference understanding of customer's mission

2. Understanding of Agency Mission (1 paragraph):
   - Demonstrate knowledge of agency mission
   - Acknowledge key challenges
   - Show alignment to strategic priorities

3. Our Solution (1 paragraph):
   - High-level approach summary
   - How it addresses their needs
   - Key differentiators (3-4 items)

4. Why Us (1 paragraph + 3-4 bullet points):
   - Why you're the best choice
   - Top discriminators with proof points
   - Tie to evaluation criteria

Respond in JSON format:
{
  "opening": "opening paragraph text",
  "understanding": "understanding paragraph text",
  "solution": "solution overview paragraph text",
  "whyUs": "why us paragraph text",
  "discriminators": ["discriminator 1 with proof point", "discriminator 2 with proof point", "discriminator 3 with proof point"]
}

Write in professional business language. Be confident but not boastful. Focus on customer benefits.`,
        },
      ],
    });

    console.log('✅ Anthropic API response received');

    const content = response.content[0];
    if (content.type !== 'text') {
      console.error('❌ Unexpected response type:', content.type);
      throw new Error('Unexpected response type');
    }

    console.log('📝 Response text length:', content.text.length);

    try {
      const parsed = parseClaudeJSON(content.text);
      console.log('✅ Successfully parsed executive summary JSON');
      return parsed;
    } catch (e) {
      console.warn('⚠️  Failed to parse JSON, using fallback. Error:', e);
      console.log('Raw response (first 300 chars):', content.text.substring(0, 300));
      // If parsing fails, return default structure
      return {
        opening: content.text.substring(0, 500),
        understanding: '',
        solution: '',
        whyUs: '',
        discriminators: [],
      };
    }
  } catch (error) {
    console.error('❌ Error calling Anthropic API for executive summary:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
      console.error('   Stack:', error.stack);
    }
    throw error; // Re-throw to be caught by caller
  }
}
