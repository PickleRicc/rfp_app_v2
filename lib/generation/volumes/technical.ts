import { generateExecutiveSummary } from '../templates/executive-summary';
import { generateTechnicalApproach } from '../templates/technical-approach';
import { Paragraph } from 'docx';
import { mapRequirementsToSections, validateRequirementCoverage } from '../planning/section-mapper';
import { estimatePages, checkPageLimit, generatePageAllocationSummary } from '../planning/page-estimator';
import { enhanceSectionHeadings } from '../content/heading-enhancer';

/**
 * Generate Technical Volume (Framework Part 1.2 - TECHNICAL_VOLUME)
 * Typical sections:
 * - Executive Summary / Understanding
 * - Technical Approach (task areas from PWS)
 * - Tools and Technologies
 * - Innovation / Value-Added
 */
export async function generateTechnicalVolume(
  requirements: any[],
  companyData: any,
  pageLimit?: number
): Promise<any> {
  console.log('🚀 generateTechnicalVolume START');
  console.log('📊 Requirements:', requirements?.length || 0);
  console.log('🏢 Company data exists:', !!companyData);
  if (pageLimit) {
    console.log(`📄 Page limit: ${pageLimit} pages`);
  }
  
  const sections: any[] = [];
  let totalPages = 0;

  // Executive Summary
  console.log('📝 About to call generateExecutiveSummary...');
  const execSummary = await generateExecutiveSummary(
    requirements,
    companyData,
    'RFP Technical Requirements'
  );
  
  sections.push({
    title: 'Executive Summary',
    content: execSummary,
  });

  // Technical Approach - Use section mapper for explicit requirement-to-section mapping
  const allMappings = mapRequirementsToSections(requirements);
  const technicalMappings = allMappings.filter((m) => m.sectionType === 'technical');
  
  console.log(`📋 Section mapper found ${technicalMappings.length} technical sections`);
  
  // Validate coverage
  const coverage = validateRequirementCoverage(requirements, allMappings);
  console.log(`📊 Requirement coverage: ${coverage.coveragePercent.toFixed(1)}%`);
  if (coverage.uncovered.length > 0) {
    console.warn(`⚠️  Uncovered requirements: ${coverage.uncovered.join(', ')}`);
  }
  
  // If section mapper found specific sections, use those
  if (technicalMappings.length > 0) {
    const taskAreas = technicalMappings.map((m) => m.sectionName);
    const techReqs = requirements.filter((r) =>
      technicalMappings.some((m) => m.requirements.includes(r.id))
    );
    
    const { paragraphs: techApproach, exhibits: techExhibits } = await generateTechnicalApproach(
      techReqs,
      companyData,
      taskAreas
    );

    sections.push({
      title: 'Technical Approach',
      content: techApproach,
      exhibits: techExhibits,
    });
  } else {
    // Fallback to original logic if no mappings found
    const techReqs = requirements.filter((r) => r.category === 'technical');
    const taskAreas = extractTaskAreas(techReqs);

    const { paragraphs: techApproach, exhibits: techExhibits } = await generateTechnicalApproach(
      techReqs,
      companyData,
      taskAreas
    );

    sections.push({
      title: 'Technical Approach',
      content: techApproach,
      exhibits: techExhibits,
    });
  }

  // Tools and Technologies
  if (companyData.toolsTechnologies && companyData.toolsTechnologies.length > 0) {
    const toolsSection = generateToolsSection(companyData.toolsTechnologies);
    sections.push({
      title: 'Tools and Technologies',
      content: toolsSection,
    });
  }

  // Innovation / Value-Added
  if (companyData.innovations && companyData.innovations.length > 0) {
    const innovationSection = generateInnovationSection(companyData.innovations);
    sections.push({
      title: 'Innovation and Value-Added Capabilities',
      content: innovationSection,
    });
  }

  // Calculate page estimates for all sections
  // totalPages already declared at line 29
  totalPages = 0; // Reset for recalculation
  for (const section of sections) {
    if (section.content && Array.isArray(section.content)) {
      const estimate = estimatePages(section.content);
      totalPages += estimate.estimatedPages;
      section.pageEstimate = estimate;
      
      console.log(`📄 ${section.title}: ~${estimate.estimatedPages} pages (${estimate.words} words)`);
    }
  }
  
  console.log(`📊 Total estimated pages: ${totalPages}`);
  
  // Check against page limit
  if (pageLimit) {
    const limitCheck = checkPageLimit({ estimatedPages: totalPages } as any, pageLimit);
    if (limitCheck.exceeds) {
      console.warn(`⚠️  Volume exceeds page limit: ${totalPages} / ${pageLimit} pages`);
      console.warn(`   Overage: ${limitCheck.overagePages} pages (${limitCheck.overagePercent.toFixed(1)}%)`);
      console.warn(`   Recommendation: ${limitCheck.recommendation}`);
    } else {
      console.log(`✅ Volume within page limit: ${totalPages} / ${pageLimit} pages`);
    }
  }
  
  // Generate allocation summary
  const allocationSummary = generatePageAllocationSummary('technical', sections, pageLimit);
  console.log('\n' + allocationSummary);

  // Enhance all section headings with requirement references
  console.log('🏷️  Enhancing section headings with requirement references...');
  const enhancedSections = enhanceSectionHeadings(sections, 'technical', allMappings, requirements);
  console.log(`   ✅ Enhanced ${enhancedSections.length} section headings`);

  console.log('✅ generateTechnicalVolume COMPLETE');
  console.log(`   Total sections: ${enhancedSections.length}`);
  
  return {
    sections: enhancedSections,
    metadata: {
      estimatedPages: totalPages,
      pageLimit: pageLimit,
      exceeds: pageLimit ? totalPages > pageLimit : false,
      sectionMappings: allMappings,
    },
  };
}

/**
 * Extract task areas from technical requirements
 */
function extractTaskAreas(requirements: any[]): string[] {
  const areas = new Set<string>();

  for (const req of requirements) {
    if (req.source_section) {
      // Extract from PWS/SOW section references
      const match = req.source_section.match(/(?:PWS|SOW)\s+(\d+\.?\d*)\s*[-:]?\s*([^,;]*)/i);
      if (match && match[2] && match[2].trim().length > 0) {
        areas.add(match[2].trim());
      }
    }
  }

  if (areas.size === 0) {
    // Default task areas for government contracts
    return [
      'System Development and Engineering',
      'Implementation and Integration',
      'Testing and Quality Assurance',
      'Operations and Maintenance',
      'Support Services',
    ];
  }

  return Array.from(areas).slice(0, 10);
}

/**
 * Generate Tools and Technologies section
 */
function generateToolsSection(tools: any[]): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  paragraphs.push(
    new Paragraph({
      text: 'Our technical team leverages industry-leading tools and technologies to ensure successful project delivery:',
      style: 'BodyText11pt',
      spacing: { after: 240 },
    })
  );

  // Group tools by category
  const categories = new Map<string, any[]>();
  for (const tool of tools) {
    const category = tool.category || 'General';
    if (!categories.has(category)) {
      categories.set(category, []);
    }
    categories.get(category)!.push(tool);
  }

  // Generate paragraphs for each category
  for (const [category, categoryTools] of categories) {
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: category,
            bold: true,
            size: 22,
          }),
        ],
        spacing: { before: 180, after: 120 },
      })
    );

    for (const tool of categoryTools) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${tool.name} (${tool.proficiency}): `,
              bold: true,
              size: 22,
            }),
            new TextRun({
              text: tool.description || `${tool.years_experience} years of experience`,
              size: 22,
            }),
          ],
          bullet: { level: 0 },
          style: 'BodyText11pt',
          spacing: { after: 120 },
        })
      );
    }
  }

  return paragraphs;
}

/**
 * Generate Innovation section
 */
function generateInnovationSection(innovations: any[]): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  paragraphs.push(
    new Paragraph({
      text: 'We bring innovative capabilities that provide added value beyond the base requirements:',
      style: 'BodyText11pt',
      spacing: { after: 240 },
    })
  );

  for (const innovation of innovations) {
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: innovation.name,
            bold: true,
            size: 24,
          }),
        ],
        spacing: { before: 240, after: 120 },
      })
    );

    paragraphs.push(
      new Paragraph({
        text: innovation.description,
        style: 'BodyText11pt',
        spacing: { after: 120 },
      })
    );

    if (innovation.evidence) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'Evidence: ',
              italics: true,
              size: 22,
            }),
            new TextRun({
              text: innovation.evidence,
              size: 22,
            }),
          ],
          style: 'BodyText11pt',
          spacing: { after: 180 },
        })
      );
    }
  }

  return paragraphs;
}

import { TextRun } from 'docx';
