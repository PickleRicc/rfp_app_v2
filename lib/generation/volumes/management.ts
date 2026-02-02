import { generateManagementApproach } from '../templates/management-approach';
import { generateTransitionPlan } from '../templates/transition-plan';
import { estimatePages, generatePageAllocationSummary } from '../planning/page-estimator';
import { mapRequirementsToSections } from '../planning/section-mapper';
import { enhanceSectionHeadings } from '../content/heading-enhancer';

/**
 * Generate Management Volume (Framework Part 1.2 - MANAGEMENT_VOLUME)
 * Typical sections:
 * - Management Approach
 * - Organizational Structure
 * - Staffing Plan
 * - Transition Plan
 * - Quality Control Plan
 * - Risk Management Plan
 */
export async function generateManagementVolume(
  requirements: any[],
  companyData: any,
  pageLimit?: number
): Promise<any> {
  console.log('🚀 generateManagementVolume START');
  console.log('📊 Requirements:', requirements?.length || 0);
  console.log('🏢 Company data exists:', !!companyData);
  if (pageLimit) {
    console.log(`📄 Page limit: ${pageLimit} pages`);
  }
  
  const sections: any[] = [];
  let totalPages = 0;

  // Management Approach (includes org structure, key personnel, staffing, communication, QC)
  console.log('📝 About to call generateManagementApproach...');
  const { paragraphs: mgmtApproach, exhibits: mgmtExhibits } = await generateManagementApproach(
    requirements,
    companyData
  );

  sections.push({
    title: 'Management Approach',
    content: mgmtApproach,
    exhibits: mgmtExhibits,
  });

  // Transition Plan
  const transitionReqs = requirements.filter((r) =>
    r.requirement_text.toLowerCase().includes('transition') ||
    r.source_section.toLowerCase().includes('transition')
  );

  const { paragraphs: transitionPlan, exhibits: transitionExhibits } = await generateTransitionPlan(
    transitionReqs.length > 0 ? transitionReqs : requirements
  );

  sections.push({
    title: 'Transition Plan',
    content: transitionPlan,
    exhibits: transitionExhibits,
  });

  // Calculate page estimates
  for (const section of sections) {
    if (section.content && Array.isArray(section.content)) {
      const estimate = estimatePages(section.content);
      totalPages += estimate.estimatedPages;
      section.pageEstimate = estimate;
      
      console.log(`📄 ${section.title}: ~${estimate.estimatedPages} pages (${estimate.words} words)`);
    }
  }
  
  console.log(`📊 Total estimated pages: ${totalPages}`);
  
  if (pageLimit && totalPages > pageLimit) {
    console.warn(`⚠️  Volume exceeds page limit: ${totalPages} / ${pageLimit} pages`);
  }
  
  // Generate allocation summary
  const allocationSummary = generatePageAllocationSummary('management', sections, pageLimit);
  console.log('\n' + allocationSummary);

  // Generate section mappings for heading enhancement
  const allMappings = mapRequirementsToSections(requirements);

  // Enhance all section headings with requirement references
  console.log('🏷️  Enhancing section headings with requirement references...');
  const enhancedSections = enhanceSectionHeadings(sections, 'management', allMappings, requirements);
  console.log(`   ✅ Enhanced ${enhancedSections.length} section headings`);

  console.log('✅ generateManagementVolume COMPLETE');
  console.log(`   Total sections: ${enhancedSections.length}`);
  
  return {
    sections: enhancedSections,
    metadata: {
      estimatedPages: totalPages,
      pageLimit: pageLimit,
      exceeds: pageLimit ? totalPages > pageLimit : false,
    },
  };
}
