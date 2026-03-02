/**
 * RFP Checklist Builder (Layer A)
 *
 * Builds structured checklists from compliance extraction data for:
 *   1. Requirement sections (SOO service areas, SOW task areas, or eval factor fallback)
 *   2. Technology allowlist + conflict detection
 *   3. CDRLs / deliverables
 *   4. Performance metrics
 *
 * Checklists serve two purposes:
 *   - Injected into prompts as mandatory reference data
 *   - Used by post-generation validators (content-validator.ts) for code-level enforcement
 *
 * Contract-type-aware: adapts to SOO, SOW, PWS, or unknown document types.
 */

import type {
  ComplianceExtractionsByCategory,
  SowPwsFields,
  SectionMFields,
  SectionLFields,
  TechnologyReqsFields,
  ServiceAreaDetailFields,
  SecurityReqsFields,
} from '@/lib/supabase/compliance-types';

// ===== TYPES =====

export type DocumentStyle = 'soo' | 'sow' | 'pws' | 'unknown';

export interface RequirementSectionItem {
  sectionId: string;
  sectionName: string;
  summary: string;
  documentStyle: DocumentStyle;
  requiredTopics: string[];
  requiredTechnologies: string[];
  performanceMetrics: Array<{ metric: string; target: string }>;
  deliverables: string[];
  source: 'extraction' | 'task_area' | 'eval_factor_fallback' | 'regex_fallback';
  volumeScope: 'technical' | 'management' | 'any';
}

export interface TechChecklistItem {
  name: string;
  category: string;
  sourceSection: string;
  requirementLevel: 'mandatory' | 'current_environment' | 'preferred';
}

export interface TechConflict {
  category: string;
  rfpTool: string;
  commonWrongTools: string[];
}

export interface CdrlItem {
  id: string;
  title: string;
  frequency: string | null;
}

export interface MetricsItem {
  metric: string;
  target: string;
  sourceSection: string;
}

export interface RfpChecklists {
  documentStyle: DocumentStyle;
  sections: RequirementSectionItem[];
  technologies: TechChecklistItem[];
  techConflicts: TechConflict[];
  cdrls: CdrlItem[];
  metrics: MetricsItem[];
}

// ===== KNOWN SUBSTITUTIONS =====

const KNOWN_SUBSTITUTIONS: Array<{ category: string; rfpTool: string; wrongTools: string[] }> = [
  { category: 'virtualization', rfpTool: 'Nutanix', wrongTools: ['VMware', 'vSphere', 'ESXi', 'vCenter'] },
  { category: 'virtualization', rfpTool: 'VMware', wrongTools: ['Nutanix', 'KVM', 'Proxmox'] },
  { category: 'endpoint_management_mac', rfpTool: 'JAMF', wrongTools: ['Intune for Mac'] },
  { category: 'config_management', rfpTool: 'Puppet', wrongTools: ['Chef'] },
  { category: 'config_management', rfpTool: 'Ansible', wrongTools: ['Chef', 'Salt'] },
  { category: 'monitoring', rfpTool: 'Nagios', wrongTools: ['Zabbix', 'Datadog'] },
  { category: 'monitoring', rfpTool: 'SolarWinds', wrongTools: ['Nagios', 'Zabbix', 'Datadog'] },
  { category: 'endpoint_management_windows', rfpTool: 'SCCM', wrongTools: ['PDQ', 'NinjaOne'] },
  { category: 'endpoint_management_windows', rfpTool: 'MECM', wrongTools: ['PDQ', 'NinjaOne'] },
  { category: 'vdi', rfpTool: 'Citrix', wrongTools: ['VMware Horizon', 'Amazon WorkSpaces'] },
];

// ===== VOLUME SCOPE HEURISTICS =====

const MANAGEMENT_KEYWORDS = [
  'staffing', 'transition', 'organization', 'personnel', 'management plan',
  'quality control', 'qcp', 'recruitment', 'retention', 'training program',
  'risk management', 'subcontract',
];

function inferVolumeScope(name: string): 'technical' | 'management' | 'any' {
  const lower = name.toLowerCase();
  if (MANAGEMENT_KEYWORDS.some(kw => lower.includes(kw))) return 'management';
  return 'technical';
}

// ===== EXTRACTION HELPERS =====

function getField<T>(
  rows: ComplianceExtractionsByCategory[keyof ComplianceExtractionsByCategory],
  fieldName: string
): T | null {
  const row = rows?.find(r => r.field_name === fieldName);
  return row ? (row.field_value as T) : null;
}

function getServiceAreaDetails(
  sowPwsRows: ComplianceExtractionsByCategory['sow_pws']
): ServiceAreaDetailFields[] {
  return (sowPwsRows || [])
    .filter(r => r.field_name.startsWith('service_area_detail_'))
    .map(r => r.field_value as ServiceAreaDetailFields)
    .filter(Boolean);
}

function detectDocumentStyle(
  extractions: ComplianceExtractionsByCategory
): DocumentStyle {
  const sowPwsRows = extractions.sow_pws || [];
  const docType = getField<string>(sowPwsRows, 'document_type');
  if (!docType) return 'unknown';
  const lower = docType.toLowerCase();
  if (lower === 'soo') return 'soo';
  if (lower === 'pws') return 'pws';
  if (lower === 'sow') return 'sow';
  return 'unknown';
}

// ===== SECTION BUILDERS =====

/**
 * Build sections from SOO/PWS service_area_index + service_area_detail enrichment.
 */
function buildSectionsFromServiceAreas(
  extractions: ComplianceExtractionsByCategory,
  docStyle: DocumentStyle
): RequirementSectionItem[] {
  const sowPwsRows = extractions.sow_pws || [];
  const serviceAreaIndex = getField<SowPwsFields['service_area_index']>(sowPwsRows, 'service_area_index') || [];
  const details = getServiceAreaDetails(sowPwsRows);
  const deliverables = getField<SowPwsFields['deliverables']>(sowPwsRows, 'deliverables') || [];

  const detailMap = new Map<string, ServiceAreaDetailFields>();
  for (const d of details) {
    detailMap.set(d.area_code, d);
  }

  const sections: RequirementSectionItem[] = [];

  for (const area of serviceAreaIndex) {
    const detail = detailMap.get(area.code);

    const matchedDeliverables = deliverables
      .filter(d => {
        const dLower = d.name.toLowerCase();
        const aLower = area.name.toLowerCase();
        return aLower.split(/\s+/).some(word => word.length > 4 && dLower.includes(word));
      })
      .map(d => d.name);

    sections.push({
      sectionId: area.code,
      sectionName: area.name,
      summary: detail?.description || area.summary || '',
      documentStyle: docStyle,
      requiredTopics: (detail?.sub_requirements || []).map(r => r.text),
      requiredTechnologies: (detail?.required_technologies || []).map(t => t.name),
      performanceMetrics: detail?.performance_metrics || [],
      deliverables: matchedDeliverables,
      source: 'extraction',
      volumeScope: inferVolumeScope(area.name),
    });
  }

  return sections;
}

/**
 * Regex fallback: find section numbers referenced in extraction text
 * that aren't already in the service_area_index.
 */
function buildRegexFallbackSections(
  extractions: ComplianceExtractionsByCategory,
  existingIds: Set<string>,
  docStyle: DocumentStyle
): RequirementSectionItem[] {
  const sowPwsRows = extractions.sow_pws || [];
  const details = getServiceAreaDetails(sowPwsRows);

  const allText = [
    ...(sowPwsRows || []).map(r => JSON.stringify(r.field_value || '')),
    ...details.map(d => JSON.stringify(d)),
  ].join(' ');

  const sectionPattern = /(?:§|Section\s+)?(\d+\.\d+(?:\.\d+)?)/g;
  const foundSections = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = sectionPattern.exec(allText)) !== null) {
    const sectionId = match[1];
    if (!existingIds.has(sectionId) && !foundSections.has(sectionId)) {
      if (sectionId.startsWith('3.') || sectionId.startsWith('2.')) {
        foundSections.add(sectionId);
      }
    }
  }

  const sections: RequirementSectionItem[] = [];
  for (const sectionId of foundSections) {
    const contextPattern = new RegExp(
      `(?:§|Section\\s+)?${sectionId.replace(/\./g, '\\.')}[^"]*?([A-Z][a-zA-Z\\s/&-]{5,40})`,
      'g'
    );
    const contextMatch = contextPattern.exec(allText);
    const inferredName = contextMatch ? contextMatch[1].trim() : `Section ${sectionId}`;

    sections.push({
      sectionId,
      sectionName: inferredName,
      summary: '',
      documentStyle: docStyle,
      requiredTopics: [],
      requiredTechnologies: [],
      performanceMetrics: [],
      deliverables: [],
      source: 'regex_fallback',
      volumeScope: inferVolumeScope(inferredName),
    });
  }

  return sections;
}

/**
 * Build sections from SOW task_areas.
 */
function buildSectionsFromTaskAreas(
  extractions: ComplianceExtractionsByCategory,
  docStyle: DocumentStyle
): RequirementSectionItem[] {
  const sowPwsRows = extractions.sow_pws || [];
  const taskAreas = getField<SowPwsFields['task_areas']>(sowPwsRows, 'task_areas') || [];
  const deliverables = getField<SowPwsFields['deliverables']>(sowPwsRows, 'deliverables') || [];

  return taskAreas.map((task, i) => {
    const taskLower = task.name.toLowerCase();
    const matchedDeliverables = deliverables
      .filter(d => {
        const dLower = d.name.toLowerCase();
        return taskLower.split(/\s+/).some(word => word.length > 4 && dLower.includes(word));
      })
      .map(d => d.name);

    return {
      sectionId: `TaskArea.${i + 1}`,
      sectionName: task.name,
      summary: task.description || '',
      documentStyle: docStyle,
      requiredTopics: task.description ? [task.description] : [],
      requiredTechnologies: [],
      performanceMetrics: [],
      deliverables: matchedDeliverables,
      source: 'task_area' as const,
      volumeScope: inferVolumeScope(task.name),
    };
  });
}

/**
 * Fallback: build sections from Section M evaluation factors.
 */
function buildSectionsFromEvalFactors(
  extractions: ComplianceExtractionsByCategory
): RequirementSectionItem[] {
  const sectionMRows = extractions.section_m || [];
  const evalFactors = getField<SectionMFields['evaluation_factors']>(sectionMRows, 'evaluation_factors') || [];

  return evalFactors.map((factor, i) => ({
    sectionId: `M.${i + 1}`,
    sectionName: factor.name,
    summary: factor.weight_description || '',
    documentStyle: 'unknown' as DocumentStyle,
    requiredTopics: (factor.subfactors || []).map(sf => sf.name + (sf.description ? `: ${sf.description}` : '')),
    requiredTechnologies: [],
    performanceMetrics: [],
    deliverables: [],
    source: 'eval_factor_fallback' as const,
    volumeScope: inferVolumeScope(factor.name),
  }));
}

// ===== TECHNOLOGY CHECKLIST BUILDER =====

function buildTechChecklist(
  extractions: ComplianceExtractionsByCategory
): { technologies: TechChecklistItem[]; conflicts: TechConflict[] } {
  const techReqRows = extractions.technology_reqs || [];
  const requiredPlatforms = getField<TechnologyReqsFields['required_platforms']>(techReqRows, 'required_platforms') || [];
  const infraPlatforms = getField<TechnologyReqsFields['infrastructure_platforms']>(techReqRows, 'infrastructure_platforms') || [];
  const securityTools = getField<TechnologyReqsFields['security_tools']>(techReqRows, 'security_tools') || [];
  const operatingSystems = getField<TechnologyReqsFields['operating_systems']>(techReqRows, 'operating_systems') || [];
  const requiredProtocols = getField<TechnologyReqsFields['required_protocols']>(techReqRows, 'required_protocols') || [];

  const sowPwsRows = extractions.sow_pws || [];
  const serviceAreaDetails = getServiceAreaDetails(sowPwsRows);

  const technologies: TechChecklistItem[] = [];
  const seenNames = new Set<string>();

  function addTech(
    name: string, category: string, sourceSection: string,
    level: TechChecklistItem['requirementLevel']
  ) {
    const key = name.toLowerCase();
    if (seenNames.has(key)) return;
    seenNames.add(key);
    technologies.push({ name, category, sourceSection, requirementLevel: level });
  }

  for (const p of requiredPlatforms) {
    addTech(p.name, p.category, 'technology_reqs', p.requirement_level);
  }
  for (const p of infraPlatforms) {
    addTech(p.name, p.category, 'technology_reqs', 'current_environment');
  }
  for (const t of securityTools) {
    addTech(t.name, 'security', 'technology_reqs', 'mandatory');
  }
  for (const os of operatingSystems) {
    addTech(os.name, 'operating_system', 'technology_reqs', 'mandatory');
  }
  for (const proto of requiredProtocols) {
    addTech(proto.name, 'protocol', 'technology_reqs', 'mandatory');
  }

  for (const detail of serviceAreaDetails) {
    for (const tech of (detail.required_technologies || [])) {
      addTech(tech.name, 'service_area', detail.area_code, tech.requirement_level as TechChecklistItem['requirementLevel']);
    }
  }

  // Build conflicts: match known substitutions against what the RFP actually requires
  const conflicts: TechConflict[] = [];
  const rfpToolNames = new Set(technologies.map(t => t.name.toLowerCase()));

  for (const sub of KNOWN_SUBSTITUTIONS) {
    if (rfpToolNames.has(sub.rfpTool.toLowerCase())) {
      conflicts.push({
        category: sub.category,
        rfpTool: sub.rfpTool,
        commonWrongTools: sub.wrongTools,
      });
    }
  }

  // Dynamic conflict detection: technologies sharing a category
  const byCategory = new Map<string, TechChecklistItem[]>();
  for (const t of technologies) {
    const cat = t.category.toLowerCase();
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(t);
  }

  return { technologies, conflicts };
}

// ===== CDRL BUILDER =====

function buildCdrlChecklist(
  extractions: ComplianceExtractionsByCategory
): CdrlItem[] {
  const sowPwsRows = extractions.sow_pws || [];
  const deliverables = getField<SowPwsFields['deliverables']>(sowPwsRows, 'deliverables') || [];

  return deliverables.map((d, i) => {
    const idMatch = d.name.match(/\b([A-Z]-?\d{3,4})\b/);
    const id = idMatch ? idMatch[1] : `CDRL-${String(i + 1).padStart(3, '0')}`;

    return {
      id,
      title: d.name,
      frequency: d.frequency || null,
    };
  });
}

// ===== METRICS BUILDER =====

function buildMetricsChecklist(
  extractions: ComplianceExtractionsByCategory
): MetricsItem[] {
  const sowPwsRows = extractions.sow_pws || [];
  const serviceAreaDetails = getServiceAreaDetails(sowPwsRows);
  const metrics: MetricsItem[] = [];
  const seenMetrics = new Set<string>();

  for (const detail of serviceAreaDetails) {
    for (const m of (detail.performance_metrics || [])) {
      const key = `${m.metric}|${m.target}`.toLowerCase();
      if (seenMetrics.has(key)) continue;
      seenMetrics.add(key);
      metrics.push({
        metric: m.metric,
        target: m.target,
        sourceSection: detail.area_code,
      });
    }
  }

  return metrics;
}

// ===== MAIN BUILDER =====

export function buildRfpChecklists(
  extractions: ComplianceExtractionsByCategory
): RfpChecklists {
  const docStyle = detectDocumentStyle(extractions);

  let sections: RequirementSectionItem[] = [];

  if (docStyle === 'soo' || docStyle === 'pws') {
    sections = buildSectionsFromServiceAreas(extractions, docStyle);

    const existingIds = new Set(sections.map(s => s.sectionId));
    const fallbackSections = buildRegexFallbackSections(extractions, existingIds, docStyle);
    sections.push(...fallbackSections);
  }

  if (sections.length === 0 && (docStyle === 'sow' || docStyle === 'unknown')) {
    sections = buildSectionsFromTaskAreas(extractions, docStyle === 'unknown' ? 'sow' : docStyle);
  }

  if (sections.length === 0) {
    sections = buildSectionsFromEvalFactors(extractions);
  }

  const { technologies, conflicts } = buildTechChecklist(extractions);
  const cdrls = buildCdrlChecklist(extractions);
  const metrics = buildMetricsChecklist(extractions);

  return { documentStyle: docStyle, sections, technologies, techConflicts: conflicts, cdrls, metrics };
}

// ===== VOLUME FILTER =====

export function filterChecklistForVolume(
  checklists: RfpChecklists,
  volumeType: string,
  extractions: ComplianceExtractionsByCategory
): RfpChecklists {
  const sectionLRows = extractions.section_l || [];
  const volumeStructure = getField<SectionLFields['volume_structure']>(sectionLRows, 'volume_structure');
  const _volumeCount = volumeStructure?.volumes?.length || 0;

  let filteredSections = checklists.sections;
  let filteredTech = checklists.technologies;
  let filteredCdrls = checklists.cdrls;
  let filteredMetrics = checklists.metrics;

  switch (volumeType) {
    case 'technical':
      filteredSections = checklists.sections.filter(
        s => s.volumeScope === 'technical' || s.volumeScope === 'any'
      );
      break;

    case 'management':
      filteredSections = checklists.sections.filter(
        s => s.volumeScope === 'management' || s.volumeScope === 'any'
      );
      filteredMetrics = checklists.metrics.filter(m => {
        const mLower = m.metric.toLowerCase();
        return mLower.includes('staffing') || mLower.includes('retention') ||
               mLower.includes('training') || mLower.includes('quality');
      });
      break;

    case 'past_performance':
      filteredSections = [];
      filteredTech = [];
      filteredCdrls = [];
      filteredMetrics = [];
      break;

    case 'cost_price':
      filteredSections = [];
      filteredTech = [];
      filteredMetrics = [];
      break;

    default:
      break;
  }

  return {
    documentStyle: checklists.documentStyle,
    sections: filteredSections,
    technologies: filteredTech,
    techConflicts: checklists.techConflicts,
    cdrls: filteredCdrls,
    metrics: filteredMetrics,
  };
}

// ===== PROMPT FORMATTER =====

function docTypeLabel(style: DocumentStyle): string {
  switch (style) {
    case 'soo': return 'SOO';
    case 'pws': return 'PWS';
    case 'sow': return 'SOW';
    default: return 'RFP';
  }
}

function sectionTermLabel(style: DocumentStyle): string {
  switch (style) {
    case 'soo': return 'SOO section';
    case 'pws': return 'PWS paragraph';
    case 'sow': return 'SOW task area';
    default: return 'requirement section';
  }
}

export function formatChecklistForPrompt(checklists: RfpChecklists): string {
  const parts: string[] = [];
  const label = docTypeLabel(checklists.documentStyle);
  const sectionTerm = sectionTermLabel(checklists.documentStyle);

  if (checklists.sections.length > 0) {
    parts.push(`=== MANDATORY ${label} SECTION COVERAGE (${checklists.sections.length} ${sectionTerm}s) ===`);
    parts.push(`You MUST create a subsection for every ${sectionTerm} listed below.`);
    parts.push(`If you cannot write full content, create the heading and write:`);
    parts.push(`"[HUMAN INPUT REQUIRED: ${label} {id} requires coverage of: {topics}]"`);
    parts.push(`NEVER skip a section. Missing a ${sectionTerm} is an automatic compliance failure.\n`);

    for (const s of checklists.sections) {
      const topicsPreview = s.requiredTopics.length > 0
        ? ` — Topics: ${s.requiredTopics.slice(0, 3).join('; ')}${s.requiredTopics.length > 3 ? '...' : ''}`
        : '';
      const techPreview = s.requiredTechnologies.length > 0
        ? ` — Tech: ${s.requiredTechnologies.slice(0, 5).join(', ')}`
        : '';
      parts.push(`  ${s.sectionId}: ${s.sectionName}${topicsPreview}${techPreview}`);
    }
    parts.push('');
  }

  if (checklists.technologies.length > 0) {
    const techLimit = Math.min(checklists.technologies.length, 40);
    parts.push(`=== REQUIRED TECHNOLOGY CHECKLIST (${checklists.technologies.length} items) ===`);
    parts.push(`Every technology below MUST appear in your response in the appropriate section.`);
    parts.push(`Do NOT substitute with alternative products unless the ${label} names them.\n`);

    for (const t of checklists.technologies.slice(0, techLimit)) {
      const levelTag = t.requirementLevel === 'mandatory' ? '[REQUIRED]' :
                       t.requirementLevel === 'current_environment' ? '[CURRENT ENV]' : '[PREFERRED]';
      parts.push(`  ${levelTag} ${t.name} (${t.category}) — from ${t.sourceSection}`);
    }
    if (checklists.technologies.length > techLimit) {
      parts.push(`  ... and ${checklists.technologies.length - techLimit} more`);
    }

    if (checklists.techConflicts.length > 0) {
      parts.push(`\nKNOWN TECHNOLOGY CONFLICTS (do NOT use the wrong tool):`);
      for (const c of checklists.techConflicts) {
        parts.push(`  ${label} requires: ${c.rfpTool} — Do NOT use: ${c.commonWrongTools.join(', ')}`);
      }
    }
    parts.push('');
  }

  if (checklists.cdrls.length > 0) {
    parts.push(`=== DELIVERABLE/CDRL TABLE (${checklists.cdrls.length} items — use these exact IDs) ===`);
    parts.push(`If you include a CDRL/deliverable table, use EXACTLY these IDs and titles.\n`);

    for (const c of checklists.cdrls) {
      const freq = c.frequency ? ` (${c.frequency})` : '';
      parts.push(`  ${c.id}: ${c.title}${freq}`);
    }
    parts.push('');
  }

  if (checklists.metrics.length > 0) {
    const metricsLimit = Math.min(checklists.metrics.length, 25);
    parts.push(`=== PERFORMANCE METRICS FROM ${label} (${checklists.metrics.length} thresholds) ===`);
    parts.push(`Reference these exact numbers. Do NOT use [HUMAN INPUT REQUIRED] for listed metrics.\n`);

    for (const m of checklists.metrics.slice(0, metricsLimit)) {
      parts.push(`  ${m.metric}: ${m.target} (${label} §${m.sourceSection})`);
    }
    if (checklists.metrics.length > metricsLimit) {
      parts.push(`  ... and ${checklists.metrics.length - metricsLimit} more`);
    }
    parts.push('');
  }

  return parts.join('\n');
}
