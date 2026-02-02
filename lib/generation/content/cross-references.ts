/**
 * Cross-Reference Helper (Framework Part 2.2)
 * Formats requirement cross-references for section headings
 * Format: [RFQ L.4.2; PWS REQ 3.1]
 */

export function formatRequirementReference(requirements: any[]): string {
  if (!requirements || requirements.length === 0) {
    return '';
  }

  const refs: string[] = [];

  // Group by RFQ sections
  const rfqSections = requirements
    .map((r) => r.rfq_section)
    .filter(Boolean)
    .filter((value, index, self) => self.indexOf(value) === index); // Unique only

  if (rfqSections.length > 0) {
    refs.push(`RFQ ${rfqSections.join(', ')}`);
  }

  // Group by PWS requirements - prioritize requirement_number field
  const pwsReqs = requirements
    .map((r) => {
      // Prioritize requirement_number (e.g., "REQ 001")
      if (r.requirement_number) return r.requirement_number;
      // Fallback to pws_requirement
      if (r.pws_requirement) return r.pws_requirement;
      // Fallback to source_section (e.g., "REQ 1.1")
      if (r.source_section) return r.source_section;
      return null;
    })
    .filter(Boolean)
    .filter((value, index, self) => self.indexOf(value) === index); // Unique only

  if (pwsReqs.length > 0) {
    // Limit to first 5 to keep headings readable
    const displayReqs = pwsReqs.slice(0, 5);
    const refsText = displayReqs.join(', ');
    refs.push(`${refsText}${pwsReqs.length > 5 ? ', et al.' : ''}`);
  }

  return refs.length > 0 ? ` [${refs.join('; ')}]` : '';
}

/**
 * Extract RFQ section from requirement text or source
 */
export function extractRfqSection(requirement: any): string | null {
  const text = `${requirement.requirement_text || ''} ${requirement.source_section || ''}`;

  // Look for Section L or M references (more flexible patterns)
  const patterns = [
    /Section\s+([LM][\s.]*[\d.]+)/i,  // "Section L 4.2" or "Section L.4.2"
    /\b([LM][\s.]*[\d.]+)\b/,          // "L 4.2" or "L.4.2"
    /Section\s+([LM])\s+(\d[\d.]*)/i,  // "Section L 4" 
    /RFQ\s+([LM][\s.]*[\d.]+)/i,       // "RFQ L.4.2"
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      // Normalize format to "L.4.2"
      let section = match[1];
      if (match[2]) {
        section = `${match[1]}.${match[2]}`;
      }
      return section.replace(/\s+/g, '.');
    }
  }

  return null;
}

/**
 * Extract PWS requirement number
 */
export function extractPwsRequirement(requirement: any): string | null {
  const text = `${requirement.requirement_text || ''} ${requirement.source_section || ''}`;

  // More flexible patterns for requirement numbers
  const patterns = [
    /(?:REQ|PWS|Requirement)\s+([\d.]+)/i,  // "REQ 3.1" or "PWS 3.1"
    /(?:Paragraph|Para|Section)\s+([\d.]+)/i, // "Paragraph 3.1"
    /\b(\d+\.\d+(?:\.\d+)?)\b/,              // Standalone "3.1.2" format
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1];
    }
  }

  // Use requirement_number as fallback if it looks like a PWS reference
  if (requirement.requirement_number && /^[\d.]+$/.test(requirement.requirement_number)) {
    return requirement.requirement_number;
  }

  // Last resort: use requirement_number even if not perfectly formatted
  if (requirement.requirement_number) {
    return requirement.requirement_number;
  }

  return null;
}

/**
 * Parse and enhance requirements with cross-reference data
 */
export function enhanceRequirementsWithCrossRefs(requirements: any[]): any[] {
  return requirements.map((req) => ({
    ...req,
    rfq_section: req.rfq_section || extractRfqSection(req),
    pws_requirement: req.pws_requirement || extractPwsRequirement(req),
  }));
}
