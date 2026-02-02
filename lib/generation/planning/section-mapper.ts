/**
 * Section-to-Requirement Mapping System (Framework Part 8.1 - STEP 1)
 * Explicit logic for mapping requirements to proposal sections
 */

export interface SectionMapping {
  sectionName: string;
  sectionType: 'technical' | 'management' | 'past_performance' | 'price';
  requirements: string[]; // requirement IDs
  priority: 'primary' | 'secondary';
  estimatedComplexity?: 'low' | 'medium' | 'high';
}

/**
 * Map all requirements to specific sections
 */
export function mapRequirementsToSections(requirements: any[]): SectionMapping[] {
  const mappings: SectionMapping[] = [];

  // Technical Volume Mapping
  for (const req of requirements) {
    if (req.category === 'technical') {
      const section = determineTechnicalSection(req.requirement_text);

      mappings.push({
        sectionName: section,
        sectionType: 'technical',
        requirements: [req.id],
        priority: req.priority === 'mandatory' ? 'primary' : 'secondary',
        estimatedComplexity: estimateComplexity(req.requirement_text),
      });
    }
  }

  // Management Volume Mapping
  for (const req of requirements) {
    if (
      req.category === 'management' ||
      req.requirement_text.toLowerCase().includes('staff') ||
      req.requirement_text.toLowerCase().includes('personnel') ||
      req.requirement_text.toLowerCase().includes('manage') ||
      req.requirement_text.toLowerCase().includes('organization')
    ) {
      const section = determineManagementSection(req.requirement_text);

      mappings.push({
        sectionName: section,
        sectionType: 'management',
        requirements: [req.id],
        priority: 'primary',
        estimatedComplexity: estimateComplexity(req.requirement_text),
      });
    }
  }

  // Past Performance Volume Mapping
  for (const req of requirements) {
    if (
      req.category === 'past_performance' ||
      req.requirement_text.toLowerCase().includes('past performance') ||
      req.requirement_text.toLowerCase().includes('relevant experience') ||
      req.requirement_text.toLowerCase().includes('similar work')
    ) {
      mappings.push({
        sectionName: 'Past Performance',
        sectionType: 'past_performance',
        requirements: [req.id],
        priority: 'primary',
      });
    }
  }

  // Price Volume Mapping
  for (const req of requirements) {
    if (
      req.category === 'price' ||
      req.requirement_text.toLowerCase().includes('price') ||
      req.requirement_text.toLowerCase().includes('cost') ||
      req.requirement_text.toLowerCase().includes('pricing')
    ) {
      mappings.push({
        sectionName: 'Price',
        sectionType: 'price',
        requirements: [req.id],
        priority: 'primary',
      });
    }
  }

  // Consolidate duplicate sections
  return consolidateMappings(mappings);
}

/**
 * Determine which technical section a requirement belongs to
 */
function determineTechnicalSection(requirementText: string): string {
  const text = requirementText.toLowerCase();

  // Development & Design
  if (
    text.includes('develop') ||
    text.includes('design') ||
    text.includes('architect') ||
    text.includes('build')
  ) {
    return 'Development Approach';
  }

  // Testing & QA
  if (
    text.includes('test') ||
    text.includes('quality assurance') ||
    text.includes('qa') ||
    text.includes('validation') ||
    text.includes('verification')
  ) {
    return 'Testing & Quality Assurance';
  }

  // Security
  if (
    text.includes('security') ||
    text.includes('cybersecurity') ||
    text.includes('authorization') ||
    text.includes('authentication') ||
    text.includes('ato') ||
    text.includes('fedramp')
  ) {
    return 'Security Approach';
  }

  // Data Management
  if (
    text.includes('data') ||
    text.includes('database') ||
    text.includes('storage') ||
    text.includes('backup')
  ) {
    return 'Data Management';
  }

  // Cloud & Infrastructure
  if (
    text.includes('cloud') ||
    text.includes('infrastructure') ||
    text.includes('aws') ||
    text.includes('azure') ||
    text.includes('hosting')
  ) {
    return 'Infrastructure & Cloud Services';
  }

  // Integration
  if (
    text.includes('integrat') ||
    text.includes('api') ||
    text.includes('interface') ||
    text.includes('interoperability')
  ) {
    return 'Integration Approach';
  }

  // DevOps & Deployment
  if (
    text.includes('devops') ||
    text.includes('ci/cd') ||
    text.includes('deploy') ||
    text.includes('pipeline')
  ) {
    return 'DevOps & Deployment';
  }

  // Documentation
  if (
    text.includes('document') ||
    text.includes('technical writing') ||
    text.includes('user guide') ||
    text.includes('manual')
  ) {
    return 'Documentation Approach';
  }

  // Support & Maintenance
  if (
    text.includes('support') ||
    text.includes('maintenance') ||
    text.includes('sustain') ||
    text.includes('operations')
  ) {
    return 'Support & Maintenance';
  }

  // Default
  return 'Technical Approach';
}

/**
 * Determine which management section a requirement belongs to
 */
function determineManagementSection(requirementText: string): string {
  const text = requirementText.toLowerCase();

  // Staffing & Personnel
  if (
    text.includes('staff') ||
    text.includes('personnel') ||
    text.includes('key person') ||
    text.includes('labor categor') ||
    text.includes('team')
  ) {
    return 'Staffing Plan';
  }

  // Transition
  if (
    text.includes('transition') ||
    text.includes('phase-in') ||
    text.includes('phase in') ||
    text.includes('knowledge transfer') ||
    text.includes('onboard')
  ) {
    return 'Transition Plan';
  }

  // Quality Control
  if (
    text.includes('quality control') ||
    text.includes('quality assurance') ||
    text.includes('qc') ||
    text.includes('qa plan') ||
    text.includes('review process')
  ) {
    return 'Quality Control Plan';
  }

  // Risk Management
  if (
    text.includes('risk') ||
    text.includes('mitigation') ||
    text.includes('contingency')
  ) {
    return 'Risk Management Plan';
  }

  // Communication
  if (
    text.includes('communication') ||
    text.includes('meeting') ||
    text.includes('report') ||
    text.includes('status update')
  ) {
    return 'Communication Plan';
  }

  // Organizational Structure
  if (
    text.includes('organizat') ||
    text.includes('org chart') ||
    text.includes('reporting structure') ||
    text.includes('hierarchy')
  ) {
    return 'Organizational Structure';
  }

  // Default
  return 'Management Approach';
}

/**
 * Estimate complexity of requirement
 */
function estimateComplexity(requirementText: string): 'low' | 'medium' | 'high' {
  const wordCount = requirementText.split(/\s+/).length;

  // Long requirements are typically more complex
  if (wordCount > 100) return 'high';
  if (wordCount > 50) return 'medium';

  // Keywords indicating complexity
  const complexKeywords = [
    'integrate',
    'implement',
    'develop',
    'design',
    'multiple',
    'comprehensive',
    'various',
  ];

  const hasComplexKeywords = complexKeywords.some((keyword) =>
    requirementText.toLowerCase().includes(keyword)
  );

  return hasComplexKeywords ? 'medium' : 'low';
}

/**
 * Consolidate mappings with same section
 */
function consolidateMappings(mappings: SectionMapping[]): SectionMapping[] {
  const consolidated = new Map<string, SectionMapping>();

  for (const mapping of mappings) {
    const key = `${mapping.sectionType}-${mapping.sectionName}`;

    if (consolidated.has(key)) {
      const existing = consolidated.get(key)!;
      existing.requirements.push(...mapping.requirements);
      
      // Upgrade priority if any requirement is primary
      if (mapping.priority === 'primary') {
        existing.priority = 'primary';
      }
      
      // Upgrade complexity if any requirement is high
      if (mapping.estimatedComplexity === 'high') {
        existing.estimatedComplexity = 'high';
      } else if (mapping.estimatedComplexity === 'medium' && existing.estimatedComplexity !== 'high') {
        existing.estimatedComplexity = 'medium';
      }
    } else {
      consolidated.set(key, { ...mapping });
    }
  }

  return Array.from(consolidated.values()).sort((a, b) => {
    // Sort by volume type, then by priority, then by section name
    if (a.sectionType !== b.sectionType) {
      const order = ['technical', 'management', 'past_performance', 'price'];
      return order.indexOf(a.sectionType) - order.indexOf(b.sectionType);
    }
    if (a.priority !== b.priority) {
      return a.priority === 'primary' ? -1 : 1;
    }
    return a.sectionName.localeCompare(b.sectionName);
  });
}

/**
 * Validate requirement coverage across mappings
 */
export function validateRequirementCoverage(
  requirements: any[],
  mappings: SectionMapping[]
): {
  covered: string[];
  uncovered: string[];
  coveragePercent: number;
  mappingsByType: Record<string, number>;
} {
  const mappedReqIds = new Set(mappings.flatMap((m) => m.requirements));

  const covered = requirements
    .filter((r) => mappedReqIds.has(r.id))
    .map((r) => r.requirement_number);

  const uncovered = requirements
    .filter((r) => !mappedReqIds.has(r.id))
    .map((r) => r.requirement_number);

  // Count mappings by type
  const mappingsByType: Record<string, number> = {};
  for (const mapping of mappings) {
    mappingsByType[mapping.sectionType] =
      (mappingsByType[mapping.sectionType] || 0) + 1;
  }

  return {
    covered,
    uncovered,
    coveragePercent: requirements.length > 0 ? (covered.length / requirements.length) * 100 : 100,
    mappingsByType,
  };
}

/**
 * Generate section mapping report
 */
export function generateMappingReport(mappings: SectionMapping[]): string {
  const lines: string[] = [];
  
  lines.push('SECTION-TO-REQUIREMENT MAPPING REPORT');
  lines.push('=' .repeat(50));
  lines.push('');

  const byType = mappings.reduce((acc, m) => {
    if (!acc[m.sectionType]) acc[m.sectionType] = [];
    acc[m.sectionType].push(m);
    return acc;
  }, {} as Record<string, SectionMapping[]>);

  for (const [type, sections] of Object.entries(byType)) {
    lines.push(`${type.toUpperCase()} VOLUME:`);
    lines.push('');

    for (const section of sections) {
      lines.push(`  ${section.sectionName}`);
      lines.push(`    Requirements: ${section.requirements.length}`);
      lines.push(`    Priority: ${section.priority}`);
      if (section.estimatedComplexity) {
        lines.push(`    Complexity: ${section.estimatedComplexity}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}