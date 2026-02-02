/**
 * Heading Enhancer - Adds requirement references to section headings
 * Uses the same mapping logic as compliance matrix for consistency
 * Follows Framework Part 2.2: Cross-Reference Notation
 * FORMAT: "Section Title [RFQ X.X; PWS X.X]"
 */

import { SectionMapping } from '../planning/section-mapper';
import { extractRfqSection, extractPwsRequirement } from './cross-references';

/**
 * Add requirement references to a section heading per Framework Part 2.2
 * @param sectionName - The section name (e.g., "Development Approach")
 * @param sectionMappings - All section mappings from mapRequirementsToSections()
 * @param requirements - All requirements (to look up requirement numbers)
 * @returns Enhanced heading with requirement references
 */
export function addRequirementReferencesToHeading(
  sectionName: string,
  sectionMappings: SectionMapping[],
  requirements: any[]
): string {
  // Find mappings for this section
  const matchingMappings = sectionMappings.filter(
    (m) => m.sectionName === sectionName
  );

  if (matchingMappings.length === 0) {
    return sectionName; // No requirements mapped to this section
  }

  // Collect all requirement IDs for this section
  const reqIds = new Set<string>();
  for (const mapping of matchingMappings) {
    for (const reqId of mapping.requirements) {
      reqIds.add(reqId);
    }
  }

  if (reqIds.size === 0) {
    return sectionName;
  }

  // Get requirements and extract RFQ + PWS references
  const reqs = requirements.filter((r) => reqIds.has(r.id));
  
  // Collect RFQ sections (Section L/M references)
  const rfqSections = new Set<string>();
  for (const req of reqs) {
    const rfqRef = req.rfq_section || extractRfqSection(req);
    if (rfqRef) {
      rfqSections.add(rfqRef);
    }
  }
  
  // Collect PWS requirements
  const pwsReqs = new Set<string>();
  for (const req of reqs) {
    const pwsRef = req.requirement_number || req.pws_requirement || extractPwsRequirement(req);
    if (pwsRef) {
      pwsReqs.add(pwsRef);
    }
  }

  // Format per Framework: "Section Title [RFQ X.X; PWS X.X]"
  const refParts: string[] = [];
  
  if (rfqSections.size > 0) {
    const rfqArray = Array.from(rfqSections).slice(0, 3);
    refParts.push(`RFQ ${rfqArray.join(', ')}`);
  }
  
  if (pwsReqs.size > 0) {
    const pwsArray = Array.from(pwsReqs);
    // Format PWS requirements with ranges if consecutive
    const formattedPws = formatPwsReferences(pwsArray);
    refParts.push(formattedPws);
  }

  if (refParts.length === 0) {
    return sectionName;
  }

  return `${sectionName} [${refParts.join('; ')}]`;
}

/**
 * Format PWS requirements with ranges for readability
 * Example: REQ 3.1, 3.2, 3.3, 3.7 → "PWS REQ 3.1-3.3, 3.7"
 */
function formatPwsReferences(pwsRefs: string[]): string {
  // Limit to first 10 for readability
  const limited = pwsRefs.slice(0, 10);
  const suffix = pwsRefs.length > 10 ? `, +${pwsRefs.length - 10} more` : '';
  
  // Simple format for now - just list them
  // TODO: Could implement smart range detection (3.1-3.5)
  return `PWS ${limited.join(', ')}${suffix}`;
}

/**
 * Enhance all sections in a volume with requirement references
 * @param sections - Array of sections with titles
 * @param volumeType - Type of volume (technical, management, etc.)
 * @param sectionMappings - All section mappings
 * @param requirements - All requirements
 * @returns Sections with enhanced titles
 */
export function enhanceSectionHeadings(
  sections: any[],
  volumeType: 'technical' | 'management' | 'past_performance' | 'price',
  sectionMappings: SectionMapping[],
  requirements: any[]
): any[] {
  // Filter mappings for this volume type
  const volumeMappings = sectionMappings.filter(
    (m) => m.sectionType === volumeType
  );

  return sections.map((section) => {
    if (!section.title) {
      return section; // No title to enhance
    }

    // Check if title already has requirement references
    if (section.title.includes('[') && section.title.includes(']')) {
      return section; // Already has references
    }

    // Add requirement references
    const enhancedTitle = addRequirementReferencesToHeading(
      section.title,
      volumeMappings,
      requirements
    );

    return {
      ...section,
      title: enhancedTitle,
    };
  });
}

/**
 * Create a lookup map from section name to requirement references
 * Useful for quick lookups during heading generation
 */
export function createSectionToRequirementsMap(
  sectionMappings: SectionMapping[],
  requirements: any[]
): Map<string, string[]> {
  const map = new Map<string, string[]>();

  for (const mapping of sectionMappings) {
    const reqNumbers = mapping.requirements
      .map((reqId) => {
        const req = requirements.find((r) => r.id === reqId);
        return req?.requirement_number || req?.source_section || null;
      })
      .filter(Boolean) as string[];

    if (reqNumbers.length > 0) {
      if (map.has(mapping.sectionName)) {
        map.get(mapping.sectionName)!.push(...reqNumbers);
      } else {
        map.set(mapping.sectionName, reqNumbers);
      }
    }
  }

  return map;
}

/**
 * Format requirement reference for a section (compact version)
 * @param sectionName - The section name
 * @param sectionToReqMap - Pre-built map from createSectionToRequirementsMap()
 * @returns Formatted reference string or empty string
 */
export function getRequirementReferenceForSection(
  sectionName: string,
  sectionToReqMap: Map<string, string[]>
): string {
  const reqNumbers = sectionToReqMap.get(sectionName);
  
  if (!reqNumbers || reqNumbers.length === 0) {
    return '';
  }

  // Remove duplicates
  const uniqueReqs = Array.from(new Set(reqNumbers));
  
  // Limit display
  const displayReqs = uniqueReqs.slice(0, 10);
  const suffix = uniqueReqs.length > 10 ? `, +${uniqueReqs.length - 10} more` : '';
  
  return ` [${displayReqs.join(', ')}${suffix}]`;
}
