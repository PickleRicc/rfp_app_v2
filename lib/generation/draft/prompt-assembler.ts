/**
 * Proposal Draft Prompt Assembler
 * Phase 9 Plan 02: Draft Generation Pipeline
 *
 * Transforms raw data from all three sources (Tier 1 company profile, Tier 2 data call,
 * Phase 7 compliance extractions) into structured AI prompts tailored to each volume type.
 *
 * Functions:
 *   assembleVolumePrompt       — Builds system + user prompts for a single volume
 *   assembleComplianceMatrixData — Maps Section M eval factors to generated volume locations
 */

import type {
  CompanyProfile,
  Personnel,
  PastPerformance,
  Certification,
  ContractVehicle,
  NaicsCode,
} from '@/lib/supabase/company-types';
import type { DataCallResponse, SmeContribution } from '@/lib/supabase/tier2-types';
import type { SolicitationStrategy } from '@/lib/supabase/strategy-types';
import type { BoeAssessment } from '@/lib/supabase/boe-types';
import type { P2wAnalysis } from '@/lib/supabase/p2w-types';
import type {
  ComplianceExtractionsByCategory,
  SectionMFields,
  SowPwsFields,
  AdminDataFields,
  OperationalContextFields,
  TechnologyReqsFields,
  ServiceAreaDetailFields,
} from '@/lib/supabase/compliance-types';
import type {
  ServiceAreaApproach,
  SiteStaffingPlan,
  TechnologySelection,
} from '@/lib/supabase/tier2-types';
import { getComplianceInstructions } from '@/lib/generation/content/compliance-language';
import type { RfpChecklists } from '@/lib/generation/pipeline/soo-checklist-builder';
import { formatChecklistForPrompt } from '@/lib/generation/pipeline/soo-checklist-builder';

// ===== CONTRACT STYLE =====

/**
 * Auto-detected contract style based on extraction data.
 * Drives prompt structure adaptation — IT operations contracts get per-service-area
 * structure, software dev gets SDLC phases, etc.
 */
export type ContractStyle =
  | 'it_operations'     // SOO/PWS with 5+ service areas, operational scope
  | 'software_dev'      // SOW with phases, sprints, SDLC
  | 'consulting'        // Advisory, assessment, strategy
  | 'research'          // R&D, lab support, scientific
  | 'mixed'             // Combination
  | 'general';          // Default

// ===== INTERFACES =====

/**
 * Input data for assembling a volume prompt.
 * Bundles all three data sources (Tier 1, Tier 2, extractions) plus volume metadata.
 */
export interface VolumePromptData {
  /** Tier 1: Company profile with win themes, differentiators, and corporate identity */
  companyProfile: CompanyProfile;

  /** Tier 2: Data call response with opportunity details, personnel, and technical approach */
  dataCallResponse: DataCallResponse;

  /**
   * Phase 7 compliance extractions grouped by category.
   * Provides Section L, Section M, SOW/PWS, admin data, past performance requirements, etc.
   */
  extractions: ComplianceExtractionsByCategory;

  /** RFP page limit for this volume (null if not specified in Section L) */
  pageLimit: number | null;

  /**
   * Spacing used to calculate words-per-page.
   * Government RFPs typically require single-spaced content.
   * Defaults to 'single' when not specified.
   */
  pageLimitSpacing?: 'single' | 'double';

  // ===== TIER 1 COLLECTIONS (piped from company intake for richer prompts) =====

  /** Tier 1 personnel records — filtered to key personnel for token efficiency */
  personnel?: Personnel[];

  /** Tier 1 past performance records with CPARS, achievements, descriptions */
  pastPerformance?: PastPerformance[];

  /** Tier 1 company certifications */
  certifications?: Certification[];

  /** Tier 1 contract vehicles (GWACs, BPAs, IDIQs, GSA Schedules) */
  contractVehicles?: ContractVehicle[];

  /** Tier 1 NAICS codes */
  naicsCodes?: NaicsCode[];

  // ===== TIER 2 v2 COLLECTIONS (new enriched sections) =====

  /** Tier 2 per-service-area approach entries from data call */
  serviceAreaApproaches?: ServiceAreaApproach[];

  /** Tier 2 per-site staffing plan entries from data call */
  siteStaffing?: SiteStaffingPlan[];

  /** Tier 2 per-technology selection entries from data call */
  technologySelections?: TechnologySelection[];

  /** Data call files with extracted text (resumes, LOCs, certs) */
  dataCallFiles?: Array<{
    id: string;
    section: string;
    field_key: string;
    filename: string;
    extracted_text: string | null;
  }>;

  /** RFP checklists from Layer A — sections, technologies, CDRLs, metrics */
  rfpChecklists?: RfpChecklists;

  /**
   * Proposal Manager strategy for this solicitation (Phase 8.5).
   * When present, a strategy brief is injected as the FIRST block in the user prompt,
   * before all data sections, setting writer intent before data context.
   */
  strategy?: SolicitationStrategy | null;

  /**
   * Approved SME contributions for this solicitation.
   * Only approved entries should be passed — filtered by the Inngest generator.
   * Injected after personnel docs and before Section M factors.
   */
  smeContributions?: SmeContribution[];

  /**
   * BOE (Basis of Estimate) assessment for this solicitation.
   * When present, staffing summary and narrative are injected after the volume body
   * to give the AI a grounded staffing model derived directly from the SOW/PWS.
   */
  boeAssessment?: BoeAssessment | null;

  /**
   * P2W (Price-to-Win) rate analysis for this solicitation.
   * Only injected for cost/price volumes — competitive rate data is price-sensitive
   * and must not appear in technical or management volumes.
   */
  p2wAnalysis?: P2wAnalysis | null;
}

/**
 * Result of assembleVolumePrompt — ready to send to the Claude API.
 */
export interface VolumePromptResult {
  /** System prompt establishing AI identity, style, and company context */
  systemPrompt: string;

  /** Volume-specific user prompt with all relevant data and instructions */
  userPrompt: string;

  /**
   * Target word count for this volume.
   * Calculated as: pageLimit * wordsPerPage * 0.875 (87.5% utilization, midpoint of 85-90%).
   * Defaults to 2500 (~10 pages) when no page limit is specified.
   */
  targetWordCount: number;
}

/**
 * A single evaluation factor mapped to a generated volume.
 * Used to build the compliance matrix.
 */
export interface ComplianceMatrixEntry {
  /** Evaluation factor name from Section M (e.g., "Technical Approach") */
  factor: string;

  /** Subfactor names (e.g., ["Technical Merit", "Staffing Plan"]) */
  subfactors: string[];

  /** Weight description from Section M (e.g., "Most Important", "30%") */
  weight: string | null;

  /** Which proposal volume addresses this factor most directly */
  mapped_volume: string;

  /**
   * Specific sections within the volume expected to address this factor.
   * Populated based on volume type heuristics.
   */
  mapped_sections: string[];
}

// ===== CONSTANTS =====

/** Words per page at single spacing (government RFP standard) */
const WORDS_PER_PAGE_SINGLE = 250;

/** Words per page at double spacing */
const WORDS_PER_PAGE_DOUBLE = 500;

/** Target utilization as a fraction of the page limit */
const PAGE_UTILIZATION_TARGET = 0.875; // 87.5% — midpoint of 85-90%

/** Default target word count when no page limit is specified (~10 pages) */
const DEFAULT_TARGET_WORD_COUNT = 2500;

// ===== HELPERS =====

/**
 * Detect volume type from volume name using case-insensitive keyword matching.
 * Returns a canonical type identifier used to select the appropriate prompt template.
 */
function detectVolumeType(
  volumeName: string
): 'technical' | 'management' | 'past_performance' | 'cost_price' | 'default' {
  const name = volumeName.toLowerCase();

  if (name.includes('technical') || name.includes('approach')) {
    return 'technical';
  }
  if (name.includes('management') || name.includes('staffing') || name.includes('transition')) {
    return 'management';
  }
  if (name.includes('past perf') || name.includes('past performance')) {
    return 'past_performance';
  }
  if (name.includes('cost') || name.includes('price')) {
    return 'cost_price';
  }

  return 'default';
}

/**
 * Calculate the target word count for a volume given its page limit and spacing.
 * Uses 87.5% utilization (midpoint of the 85-90% target range).
 */
function calculateTargetWordCount(
  pageLimit: number | null,
  spacing: 'single' | 'double'
): number {
  if (!pageLimit) {
    return DEFAULT_TARGET_WORD_COUNT;
  }

  const wordsPerPage = spacing === 'double' ? WORDS_PER_PAGE_DOUBLE : WORDS_PER_PAGE_SINGLE;
  return Math.round(pageLimit * wordsPerPage * PAGE_UTILIZATION_TARGET);
}

/**
 * Build a page limit instruction block for volume prompts.
 * When a hard page limit exists, uses strong enforcement language to prevent overshoot.
 * When no limit, falls back to softer "Approximately X words" guidance.
 */
function buildPageLimitInstruction(
  targetWordCount: number,
  pageLimit: number | null,
  spacing: string
): string {
  if (pageLimit) {
    const wordsPerPage = spacing === 'double' ? WORDS_PER_PAGE_DOUBLE : WORDS_PER_PAGE_SINGLE;
    const maxWordCount = pageLimit * wordsPerPage;
    return `HARD PAGE LIMIT: This volume has a STRICT ${pageLimit}-page limit (${maxWordCount} words maximum at ${wordsPerPage} words/page). Government evaluators will DISCARD all content beyond page ${pageLimit} without reading it.

WORD BUDGET — plan BEFORE writing:
- ABSOLUTE MAXIMUM: ${maxWordCount} words. Do NOT exceed this under any circumstances.
- TARGET: ${targetWordCount} words (87.5% utilization — leaves margin for formatting).
- Tables count toward the page limit. Keep tables compact (abbreviate where possible).
- Win theme callout boxes count toward the limit. Use 1-2 sentences per box, not paragraphs.
- Prioritize: address ALL evaluation factors and ALL service areas, but use concise prose. Favor specific evidence over verbose narrative.
- If content won't fit: shorten lower-weighted sections, consolidate tables, and remove redundant introductory paragraphs. NEVER drop an evaluation factor or service area to save space.
- Do NOT include a compliance matrix or appendix within this volume — those are separate volumes.`;
  }

  return `TARGET LENGTH: Approximately ${targetWordCount} words (no page limit specified — use professional judgment).`;
}

/**
 * Build win theme instructions from the company's enterprise win themes.
 * Each win theme becomes a callout box instruction inserted at major section starts.
 */
function buildWinThemeInstructions(winThemes: string[]): string {
  if (!winThemes || winThemes.length === 0) {
    return '';
  }

  const themeList = winThemes
    .map(theme => `  - "${theme}"`)
    .join('\n');

  return `
WIN THEME CALLOUT BOXES:
Insert a win theme callout box at the beginning of each major section.
Use the following enterprise win themes, rotating through them:
${themeList}

Format each callout box as:
=== WIN THEME: {theme} ===
{One sentence connecting this theme to the section's specific content}
========================

These callout boxes reinforce the company's competitive positioning throughout the proposal.
`;
}

/**
 * Build the sparse data handling instruction appended to every prompt.
 * Instructs the AI to use [PLACEHOLDER] markers for missing data.
 */
function buildSparseDataInstruction(): string {
  return `
SPARSE DATA HANDLING:
Where specific data is unavailable or not provided, insert a placeholder in this exact format:
[HUMAN INPUT REQUIRED: describe what specific information is needed here]

This allows the reviewer to identify exactly what information must be supplied before the proposal is finalized.

FABRICATION PREVENTION — CRITICAL:
You MUST NOT invent, fabricate, or assume ANY of the following unless explicitly provided in the source data above:

1. SLA METRICS: Do NOT fabricate resolution times, response times, uptime percentages, or availability targets.
   BAD: "Critical tickets resolved within 1 business day"
   GOOD: "Critical tickets resolved within [HUMAN INPUT REQUIRED: resolution SLA per contract metrics]"
   GOOD (if SOW provides it): "Critical tickets resolved within 4 hours per SOW Table 3"

2. TOOL/SOFTWARE NAMES: Only name tools that appear in the provided source data (tools_and_platforms,
   technology_selections, service_area_approaches, or SOW task areas). Do NOT guess enterprise tools.
   BAD: "Using Citrix VDI, Dameware, Ansible, and Puppet for configuration management"
   GOOD: "Using [list only tools from source data] for configuration management"
   If no specific tools are provided for a service area, describe the APPROACH without naming specific products.

3. INCUMBENT CONTRACTORS: NEVER name an incumbent contractor unless explicitly provided in source data.
   BAD: "Transition from Agile Defense, Inc."
   GOOD: "Transition from the incumbent contractor"

4. CDRL TURNAROUND TIMES: Only state CDRL deadlines that appear in the SOW deliverables data.
   BAD: "CDRL A004 delivered within 3 business days"
   GOOD: "CDRL A004 delivered per the schedule specified in the SOW"

5. SPECIFIC NUMERIC COMMITMENTS: Do NOT fabricate staffing ratios, CSAT targets, deployment timelines,
   installation SLAs, or any numeric commitment that could become a contractually binding obligation.
   BAD: "98% customer satisfaction target" / "New devices deployed within 1 business day"
   GOOD: "[HUMAN INPUT REQUIRED: customer satisfaction target]" or describe the process without a specific number.

6. PERSONNEL DETAILS: Use ONLY data from the KEY PERSONNEL REGISTRY and personnel records above.
   Do NOT add education details, certifications, or experience claims not in the source data.

When in doubt, use a placeholder. A placeholder is always preferable to a fabricated claim that could
create an unwanted contractual obligation or fail source verification during scoring.
`;
}

/**
 * Build the RFP requirement blockquote instruction appended to volume prompts.
 * Instructs the AI to quote RFP requirements before responding, creating visual
 * traceability for evaluators. The markdown parser converts > blocks to CalloutBox style.
 */
function buildBlockquoteInstruction(): string {
  return `
RFP REQUIREMENT QUOTING:
When addressing a specific RFP requirement or evaluation factor, QUOTE the requirement first using a blockquote (> prefix), then provide your response. This creates visual traceability for evaluators.

Example:
> The contractor shall provide a detailed technical approach for managing IT infrastructure.

[Company Name] will implement a comprehensive IT infrastructure management approach...
`;
}

// ===== CHECKLIST INJECTION =====

/**
 * Build the checklist enforcement block to inject into volume user prompts.
 * Adapts language based on document style (SOO/SOW/PWS).
 */
function buildChecklistEnforcementBlock(checklists: RfpChecklists | undefined): string {
  if (!checklists) return '';
  const formatted = formatChecklistForPrompt(checklists);
  if (!formatted.trim()) return '';
  return `\n${formatted}`;
}

/**
 * Build modernization goals enforcement block.
 * Only injected when extraction data has modernization_goals.
 */
function buildModernizationEnforcementBlock(
  modernizationGoals: string[],
  docLabel: string
): string {
  if (!modernizationGoals || modernizationGoals.length === 0) return '';
  const numbered = modernizationGoals.map((g, i) => `  ${i + 1}. ${g}`).join('\n');
  return `
MODERNIZATION/STRATEGIC GOALS: The ${docLabel} defines the following strategic objectives.
You MUST address each one explicitly and describe how your approach supports it:
${numbered}
`;
}

// ===== CONTRACT STYLE DETECTION =====

/**
 * Auto-detect the contract style from extraction data.
 * Drives prompt structure — IT ops gets per-service-area sections,
 * software dev gets SDLC phases, etc.
 */
export function detectContractStyle(
  extractions: ComplianceExtractionsByCategory
): ContractStyle {
  const sowPwsRows = extractions.sow_pws || [];
  const opCtxRows = extractions.operational_context || [];
  const techReqRows = extractions.technology_reqs || [];

  // Extract key signals
  let documentType: string | null = null;
  let totalServiceAreas = 0;

  for (const row of sowPwsRows) {
    if (row.field_name === 'document_type') {
      documentType = (row.field_value as string) || null;
    }
    if (row.field_name === 'total_service_areas') {
      totalServiceAreas = Number(row.field_value) || 0;
    }
  }

  // Check for IT ops indicators
  const itOpsKeywords = ['servicenow', 'cisco', 'nutanix', 'sccm', 'mecm', 'active directory',
    'vmware', 'solarwinds', 'jamf', 'puppet', 'ansible', 'service desk', 'help desk',
    'it operations', 'it support', 'infrastructure'];
  let itOpsSignals = 0;

  for (const row of techReqRows) {
    const valueStr = JSON.stringify(row.field_value || '').toLowerCase();
    for (const kw of itOpsKeywords) {
      if (valueStr.includes(kw)) itOpsSignals++;
    }
  }

  // IT Operations: SOO/PWS with 5+ service areas OR strong IT ops tech signals
  if (
    (documentType === 'SOO' || documentType === 'PWS') &&
    (totalServiceAreas >= 5 || itOpsSignals >= 3)
  ) {
    return 'it_operations';
  }
  if (totalServiceAreas >= 5 && itOpsSignals >= 2) {
    return 'it_operations';
  }

  // Software dev: SOW with development-related keywords
  const devKeywords = ['agile', 'sprint', 'sdlc', 'devops', 'devsecops', 'ci/cd',
    'software development', 'application development', 'coding'];
  let devSignals = 0;
  for (const row of sowPwsRows) {
    const valueStr = JSON.stringify(row.field_value || '').toLowerCase();
    for (const kw of devKeywords) {
      if (valueStr.includes(kw)) devSignals++;
    }
  }
  if (documentType === 'SOW' && devSignals >= 2) {
    return 'software_dev';
  }

  // Research: agency mission or scope indicates R&D
  const researchKeywords = ['research', 'laboratory', 'r&d', 'scientific', 'experiment'];
  let researchSignals = 0;
  for (const row of opCtxRows) {
    const valueStr = JSON.stringify(row.field_value || '').toLowerCase();
    for (const kw of researchKeywords) {
      if (valueStr.includes(kw)) researchSignals++;
    }
  }
  // Research lab IT support is still it_operations if it has service areas
  if (researchSignals >= 2 && totalServiceAreas < 5) {
    return 'research';
  }

  // Consulting: advisory keywords
  const consultingKeywords = ['advisory', 'assessment', 'strategy', 'consulting', 'analysis'];
  let consultingSignals = 0;
  for (const row of sowPwsRows) {
    const valueStr = JSON.stringify(row.field_value || '').toLowerCase();
    for (const kw of consultingKeywords) {
      if (valueStr.includes(kw)) consultingSignals++;
    }
  }
  if (consultingSignals >= 2) {
    return 'consulting';
  }

  // Mixed: has significant signals from multiple categories
  const signalCounts = [itOpsSignals, devSignals, researchSignals, consultingSignals].filter(s => s >= 2);
  if (signalCounts.length >= 2) {
    return 'mixed';
  }

  return 'general';
}

// ===== EXTRACTION HELPERS =====

/**
 * Extract a single field value from a category's extraction rows by field_name.
 */
function getExtractionField<T>(
  rows: ComplianceExtractionsByCategory[keyof ComplianceExtractionsByCategory],
  fieldName: string
): T | null {
  const row = rows?.find(r => r.field_name === fieldName);
  return row ? (row.field_value as T) : null;
}

/**
 * Collect all service area detail rows from sow_pws extractions.
 * These have field_name pattern: service_area_detail_{code}
 */
function getServiceAreaDetails(
  sowPwsRows: ComplianceExtractionsByCategory['sow_pws']
): ServiceAreaDetailFields[] {
  return (sowPwsRows || [])
    .filter(r => r.field_name.startsWith('service_area_detail_'))
    .map(r => r.field_value as ServiceAreaDetailFields)
    .filter(Boolean);
}

/**
 * Build a compliance data block from data_call_responses.compliance_verification.
 * Surfaces SPRS score, CAGE code, FCL status, etc. for the AI to reference.
 */
function buildComplianceDataBlock(dataCallResponse: DataCallResponse): string {
  const cv = dataCallResponse.compliance_verification;
  if (!cv || Object.keys(cv).length === 0) return '';

  const parts: string[] = ['\nCOMPLIANCE DATA:'];
  const obj = cv as unknown as Record<string, unknown>;
  if (obj.sprs_score) parts.push(`  - SPRS Score: ${obj.sprs_score} (assessed ${obj.sprs_assessment_date || 'date unknown'})`);
  if (obj.facility_clearance_level) parts.push(`  - Facility Clearance: ${obj.facility_clearance_level} (CAGE: ${obj.facility_clearance_cage || 'N/A'})`);
  if (obj.sdvosb_certified) parts.push(`  - SDVOSB: Certified (${obj.sdvosb_cert_number || 'N/A'}, expires ${obj.sdvosb_expiration || 'N/A'})`);
  if (obj.nist_800_171_compliant) parts.push(`  - NIST 800-171: Compliant (${obj.open_poam_items || 0} open POA&M items)`);
  if (obj.cmmi_level) parts.push(`  - CMMI Level: ${obj.cmmi_level}`);
  parts.push('');
  return parts.join('\n');
}

/**
 * Build an AUTHORITATIVE key personnel registry block from data_call_responses.key_personnel.
 * This block is injected into EVERY volume prompt to ensure all volumes use the same names.
 */
function buildKeyPersonnelRegistryBlock(
  keyPersonnel?: DataCallResponse['key_personnel'],
  personnelRecords?: { full_name: string; availability?: string }[]
): string {
  if (!keyPersonnel || keyPersonnel.length === 0) return '';

  const entries = keyPersonnel.map((kp, i) => {
    const match = personnelRecords?.find(p => p.full_name.toLowerCase() === (kp.name || '').toLowerCase());
    const availTag = match?.availability ? ` [Availability: ${match.availability}]` : '';
    return `  ${i + 1}. ${kp.role}: ${kp.name}${availTag}`;
  }).join('\n');

  return `
══════════════════════════════════════════════════════
AUTHORITATIVE KEY PERSONNEL REGISTRY (USE THESE NAMES IN ALL VOLUMES):
${entries}

CRITICAL: Use ONLY the names listed above for key personnel leads throughout this volume.
Do NOT use names from resume documents, personnel database records, or any other source
if they differ from this registry. This registry is the single source of truth for the
proposal package. Using different names across volumes is a compliance failure.
If a person's availability is NOT "Immediately Available", account for their delayed
start in transition planning — do NOT imply Day 1 availability.
══════════════════════════════════════════════════════
`;
}

/**
 * Build a personnel documents block from extracted resume/LOC text.
 */
function buildPersonnelDocsBlock(
  files?: VolumePromptData['dataCallFiles']
): string {
  if (!files || files.length === 0) return '';

  const resumeFiles = files.filter(f => f.field_key.includes('resume') && f.extracted_text);
  const locFiles = files.filter(f => f.field_key.includes('loc') && f.extracted_text);

  if (resumeFiles.length === 0 && locFiles.length === 0) return '';

  const parts: string[] = ['\nKEY PERSONNEL DOCUMENTS:'];
  for (const f of resumeFiles) {
    parts.push(`\n--- Resume: ${f.filename} ---`);
    parts.push(f.extracted_text!);
  }
  for (const f of locFiles) {
    parts.push(`\n--- Letter of Commitment: ${f.filename} ---`);
    parts.push(f.extracted_text!);
  }
  parts.push('');
  return parts.join('\n');
}

// ===== VOLUME-SPECIFIC PROMPT BUILDERS =====

/**
 * Build user prompt for a Technical volume.
 * Enriched with operational context, service area details, technology requirements,
 * and contract style-adaptive structure.
 */
function buildTechnicalPrompt(
  volumeName: string,
  volumeOrder: number,
  data: VolumePromptData,
  targetWordCount: number
): string {
  const { companyProfile, dataCallResponse, extractions } = data;
  const { technical_approach, opportunity_details } = dataCallResponse;

  const contractStyle = detectContractStyle(extractions);

  // ── Operational Context from extraction ──
  const opCtxRows = extractions.operational_context || [];
  const agencyName = getExtractionField<string>(opCtxRows, 'agency_name');
  const agencyAbbr = getExtractionField<string>(opCtxRows, 'agency_abbreviation');
  const agencyMission = getExtractionField<string>(opCtxRows, 'agency_mission');
  const userCount = getExtractionField<string>(opCtxRows, 'user_count');
  const staffComposition = getExtractionField<string>(opCtxRows, 'staff_composition');
  const incumbentContractor = getExtractionField<string | null>(opCtxRows, 'incumbent_contractor');
  const estimatedValue = getExtractionField<string | null>(opCtxRows, 'estimated_contract_value');
  const contractScopeSummary = getExtractionField<string>(opCtxRows, 'contract_scope_summary');
  const sites = getExtractionField<OperationalContextFields['sites']>(opCtxRows, 'sites') || [];
  const networks = getExtractionField<OperationalContextFields['networks']>(opCtxRows, 'networks') || [];
  const secEnvSummary = getExtractionField<string>(opCtxRows, 'security_environment_summary');

  // ── SOW/PWS from extraction ──
  const sowPwsRows = extractions.sow_pws || [];
  const scopeSummary = getExtractionField<string>(sowPwsRows, 'scope_summary');
  const totalServiceAreas = getExtractionField<number>(sowPwsRows, 'total_service_areas') || 0;
  const serviceAreaIndex = getExtractionField<SowPwsFields['service_area_index']>(sowPwsRows, 'service_area_index') || [];
  const taskAreas = getExtractionField<SowPwsFields['task_areas']>(sowPwsRows, 'task_areas') || [];
  const serviceAreaDetails = getServiceAreaDetails(sowPwsRows);
  const modernizationGoals = getExtractionField<string[]>(sowPwsRows, 'modernization_goals') || [];
  const deliverables = getExtractionField<SowPwsFields['deliverables']>(sowPwsRows, 'deliverables') || [];

  // ── Technology Requirements from extraction ──
  const techReqRows = extractions.technology_reqs || [];
  const requiredPlatforms = getExtractionField<TechnologyReqsFields['required_platforms']>(techReqRows, 'required_platforms') || [];
  const requiredStandards = getExtractionField<TechnologyReqsFields['required_standards']>(techReqRows, 'required_standards') || [];
  const infrastructurePlatforms = getExtractionField<TechnologyReqsFields['infrastructure_platforms']>(techReqRows, 'infrastructure_platforms') || [];
  const endpointCount = getExtractionField<string | null>(techReqRows, 'endpoint_count');
  const applicationCount = getExtractionField<string | null>(techReqRows, 'application_count');

  // ── Section M evaluation factors ──
  const sectionMExtraction = extractions.section_m || [];
  const sectionMFields: SectionMFields = sectionMExtraction.length > 0
    ? (sectionMExtraction[0].field_value as SectionMFields) || {}
    : {};
  const evalFactors = sectionMFields.evaluation_factors || [];
  const technicalFactors = evalFactors.filter(f =>
    f.name.toLowerCase().includes('technical') ||
    f.name.toLowerCase().includes('approach') ||
    f.name.toLowerCase().includes('merit')
  );

  const winThemeInstructions = buildWinThemeInstructions(
    companyProfile.enterprise_win_themes || []
  );

  // ── Tier 2 enrichment: service area approaches, site staffing, technology selections ──
  const serviceAreaApproaches = data.serviceAreaApproaches || [];
  const siteStaffing = data.siteStaffing || [];
  const technologySelections = data.technologySelections || [];

  // ── Build prompt sections ──

  // Agency & Contract Context
  const agencyDisplayName = agencyName
    ? `${agencyName}${agencyAbbr ? ` (${agencyAbbr})` : ''}`
    : '[PLACEHOLDER: Agency name]';

  const contractContextBlock = `CONTRACT CONTEXT:
- Agency: ${agencyDisplayName}
- Agency Mission: ${agencyMission || '[PLACEHOLDER: Agency mission not extracted]'}
- Contract Scope: ${contractScopeSummary || scopeSummary || '[PLACEHOLDER: Contract scope not extracted]'}
- User Population: ${userCount || '[PLACEHOLDER: User count not extracted]'} ${staffComposition || ''}
- Estimated Contract Value: ${estimatedValue || '[PLACEHOLDER: Contract value not extracted]'}
- Contract Type: ${opportunity_details?.contract_type || '[PLACEHOLDER: Contract type not specified]'}
- Incumbent: ${incumbentContractor || '[PLACEHOLDER: Incumbent not identified]'}
- Detected Contract Style: ${contractStyle}`;

  // Sites
  const sitesBlock = sites.length > 0
    ? `\nPERFORMANCE SITES (${sites.length} sites):\n${sites.map(s =>
        `  - ${s.name}${s.abbreviation ? ` (${s.abbreviation})` : ''}: ${s.location}${s.is_primary ? ' [PRIMARY]' : ''}${s.description ? ` — ${s.description}` : ''}`
      ).join('\n')}`
    : '';

  // Networks & Security Environment
  const networksBlock = networks.length > 0
    ? `\nNETWORK ENVIRONMENT:\n${networks.map(n =>
        `  - ${n.name} (${n.classification}): ${n.description}`
      ).join('\n')}${secEnvSummary ? `\n  Security Summary: ${secEnvSummary}` : ''}`
    : secEnvSummary
    ? `\nSECURITY ENVIRONMENT: ${secEnvSummary}`
    : '';

  // Technology Landscape
  const techLandscapeBlock = (requiredPlatforms.length > 0 || infrastructurePlatforms.length > 0)
    ? `\nTECHNOLOGY LANDSCAPE:\n${[
        ...requiredPlatforms.map(p => `  - ${p.name} (${p.category}): ${p.context} [${p.requirement_level}]`),
        ...infrastructurePlatforms.map(p => `  - ${p.name} (${p.category}): ${p.context}`),
      ].join('\n')}${endpointCount ? `\n  Endpoints: ${endpointCount}` : ''}${applicationCount ? `\n  Applications: ${applicationCount}` : ''}`
    : '';

  const standardsBlock = requiredStandards.length > 0
    ? `\nREQUIRED STANDARDS & FRAMEWORKS:\n${requiredStandards.map(s => `  - ${s.name}: ${s.context}`).join('\n')}`
    : '';

  // Service Areas (for IT ops contracts)
  let serviceAreasBlock = '';
  if (serviceAreaIndex.length > 0) {
    serviceAreasBlock = `\nSERVICE AREAS (${totalServiceAreas} areas identified from SOW/PWS):`;
    for (const area of serviceAreaIndex) {
      // Find matching detail extraction
      const detail = serviceAreaDetails.find(d => d.area_code === area.code);
      // Find matching Tier 2 approach
      const approach = serviceAreaApproaches.find(a => a.area_code === area.code);

      serviceAreasBlock += `\n\n  === ${area.code} ${area.name} ===`;
      serviceAreasBlock += `\n  Summary: ${area.summary}`;

      if (detail) {
        if (detail.sub_requirements?.length > 0) {
          serviceAreasBlock += `\n  Key Requirements (${detail.sub_requirements.length}):`;
          for (const req of detail.sub_requirements.slice(0, 5)) {
            serviceAreasBlock += `\n    - [${req.type.toUpperCase()}] ${req.text}`;
          }
          if (detail.sub_requirements.length > 5) {
            serviceAreasBlock += `\n    ... and ${detail.sub_requirements.length - 5} more requirements`;
          }
        }
        if (detail.required_technologies?.length > 0) {
          serviceAreasBlock += `\n  Required Technologies: ${detail.required_technologies.map(t => `${t.name} (${t.requirement_level})`).join(', ')}`;
        }
        if (detail.performance_metrics?.length > 0) {
          serviceAreasBlock += `\n  SLAs/Metrics: ${detail.performance_metrics.map(m => `${m.metric}: ${m.target}`).join('; ')}`;
        }
        if (detail.staffing_indicators?.length > 0) {
          serviceAreasBlock += `\n  Staffing Indicators: ${detail.staffing_indicators.map(s => s.metric).join('; ')}`;
        }
        if (detail.site_requirements?.length > 0) {
          serviceAreasBlock += `\n  Site Requirements: ${detail.site_requirements.join(', ')}`;
        }
      }

      if (approach) {
        serviceAreasBlock += `\n  OUR APPROACH: ${approach.approach_narrative}`;
        if (approach.proposed_tools) serviceAreasBlock += `\n  Proposed Tools: ${approach.proposed_tools}`;
        if (approach.proposed_staffing) serviceAreasBlock += `\n  Proposed Staffing: ${approach.proposed_staffing}`;
        if (approach.key_differentiator) serviceAreasBlock += `\n  Differentiator: ${approach.key_differentiator}`;
      }
    }
  }

  // Fallback task areas (for non-IT-ops or legacy data)
  const taskAreaText = serviceAreaIndex.length === 0 && taskAreas.length > 0
    ? `\nSOW/PWS TASK AREAS:\n${taskAreas.map(ta => `  - ${ta.name}: ${ta.description || 'See SOW for details'}`).join('\n')}`
    : serviceAreaIndex.length === 0
    ? '\nSOW/PWS TASK AREAS:\n  [PLACEHOLDER: SOW task areas not extracted — review solicitation SOW/PWS section]'
    : '';

  // Technology Selections from Tier 2
  const techSelectionsBlock = technologySelections.length > 0
    ? `\nOUR TECHNOLOGY SELECTIONS:\n${technologySelections.map(t =>
        `  - ${t.technology_name}: Experience: ${t.company_experience || '[PLACEHOLDER]'}${t.proposed_usage ? `, Usage: ${t.proposed_usage}` : ''}${t.certifications_held ? `, Certs: ${t.certifications_held}` : ''}`
      ).join('\n')}`
    : '';

  // Site Staffing from Tier 2
  const siteStaffingBlock = siteStaffing.length > 0
    ? `\nOUR SITE STAFFING PLAN:\n${siteStaffing.map(s =>
        `  - ${s.site_name} (${s.location}): ${s.proposed_fte_count}${s.key_roles ? ` — ${s.key_roles}` : ''}${s.special_requirements ? ` | ${s.special_requirements}` : ''}`
      ).join('\n')}`
    : '';

  // Modernization goals
  const modernizationBlock = modernizationGoals.length > 0
    ? `\nMODERNIZATION / TRANSFORMATION OBJECTIVES:\n${modernizationGoals.map(g => `  - ${g}`).join('\n')}`
    : '';

  // CDRLs / Deliverables
  const deliverablesBlock = deliverables.length > 0
    ? `\nCONTRACT DELIVERABLES (CDRLs) — MUST reference each in relevant task area AND in deliverables table:\n${deliverables.map(d => `  - ${d.name}${d.frequency ? ` (${d.frequency})` : ''}${d.format ? ` — Format: ${d.format}` : ''}`).join('\n')}`
    : `\nCONTRACT DELIVERABLES (CDRLs) — EXTRACTION FALLBACK:
CDRL details were not fully extracted from the solicitation documents. Derive the CDRL table from the SOW task areas above. For a typical DoD IT operations SOW, standard CDRLs include:
  - A001: Monthly Status Report (Monthly, MS Word/PDF)
  - A002: Quality Control Plan (at contract start + updates, MS Word)
  - A003: Transition-In Plan (at contract start, MS Word)
  - A004: Staffing Plan (at contract start + updates, MS Word)
  - A005: Incident Response Plan (at contract start, MS Word)
  - A006: Disaster Recovery / Business Continuity Plan (at contract start + annual update, MS Word)
  - A007: Security Documentation / SSP / POA&M (per RMF schedule, MS Word)
  - A008: Service Level Agreement Metrics Report (Monthly, MS Excel/PDF)
Map each CDRL to the relevant SOW task area. Use the frequency and format shown unless the SOW text specifies otherwise. Do NOT use [HUMAN INPUT REQUIRED] for CDRL names — use the derived names above.`;

  // Section M factors
  const technicalFactorText = technicalFactors.length > 0
    ? technicalFactors.map(f => {
        const subfactors = f.subfactors?.map(sf => `    - ${sf.name}: ${sf.description || ''}`).join('\n') || '';
        return `  - ${f.name}${f.weight_description ? ` (${f.weight_description})` : ''}${subfactors ? '\n' + subfactors : ''}`;
      }).join('\n')
    : '  [PLACEHOLDER: Technical evaluation factors not extracted from Section M]';

  // Tier 1 enrichments
  const certifications = data.certifications || [];
  const certSection = certifications.length > 0
    ? `\nCOMPANY CERTIFICATIONS:\n${certifications.map(c => `  - ${c.certification_type}${c.certifying_agency ? ` (${c.certifying_agency})` : ''}${c.expiration_date ? ` — expires ${c.expiration_date}` : ''}`).join('\n')}\n`
    : '';

  const vehicles = data.contractVehicles || [];
  const vehicleSection = vehicles.length > 0
    ? `\nCONTRACT VEHICLES:\n${vehicles.map(v => `  - ${v.vehicle_name} (${v.vehicle_type})${v.contract_number ? ` — #${v.contract_number}` : ''}${v.ceiling_value ? ` — $${(v.ceiling_value / 1_000_000).toFixed(1)}M ceiling` : ''}`).join('\n')}\n`
    : '';

  const keyPersonnel = (data.personnel || []).filter(p =>
    p.proposed_roles?.some(r => r.is_key_personnel)
  );
  const keyPersonnelSection = keyPersonnel.length > 0
    ? `\nKEY PERSONNEL QUALIFICATIONS:\n${keyPersonnel.map(p => {
        const edu = p.education?.[0];
        const certs = p.certifications?.map(c => c.name).join(', ');
        return `  - ${p.full_name}: ${p.total_experience_years} years total${p.federal_experience_years ? `, ${p.federal_experience_years} years federal` : ''}${edu ? ` | ${edu.degree_level} in ${edu.field_of_study} (${edu.institution})` : ''}${certs ? ` | Certs: ${certs}` : ''}${p.clearance_level && p.clearance_level !== 'None' ? ` | Clearance: ${p.clearance_level} (${p.clearance_status || 'Unknown'})` : ''}`;
      }).join('\n')}\n`
    : '';

  // Teaming partners
  const teamingPartners = (opportunity_details as unknown as Record<string, unknown>)?.teaming_partners as Array<{ name: string; role: string; workshare_percentage?: number; capabilities?: string }> | undefined;
  const teamingBlock = teamingPartners && teamingPartners.length > 0
    ? `\nTEAMING ARRANGEMENT:\n- Prime Contractor: ${companyProfile.company_name}\n${teamingPartners.map(tp => `- ${tp.name}: ${tp.role}${tp.workshare_percentage ? ` (${tp.workshare_percentage}% workshare)` : ''}${tp.capabilities ? ` — ${tp.capabilities}` : ''}`).join('\n')}`
    : '';

  // ── Structure instructions based on contract style ──
  let structureInstruction: string;
  switch (contractStyle) {
    case 'it_operations':
      structureInstruction = `Structure this volume as follows:
   Executive Summary → Understanding of Requirements →
   Teaming and Integration Approach →
   [Per Service Area: address each service area (${serviceAreaIndex.map(a => `${a.code} ${a.name}`).join(' → ')}) with its own subsection] →
   Cross-Cutting Capabilities (Security, Quality, ITIL Framework) →
   Multi-Site Staffing Overview (${sites.map(s => s.name).join(', ')}) →
   Labor Category Matrix → Transition Approach → Risk Management`;
      break;
    case 'software_dev':
      structureInstruction = `Structure this volume as follows:
   Executive Summary → Technical Approach → Architecture →
   Development Methodology → Testing Strategy → DevSecOps →
   Staffing Plan → Risk Management → Quality Management`;
      break;
    case 'research':
      structureInstruction = `Structure this volume as follows:
   Executive Summary → Understanding of Research Mission →
   Technical Approach → Laboratory Support Methodology →
   Staffing Plan → Risk Management → Quality Management`;
      break;
    default:
      structureInstruction = `Structure: Executive Summary → Technical Approach → Staffing Plan → Risk Management → Quality Management.`;
  }

  const spacing = data.pageLimitSpacing || 'single';

  return `You are writing the ${volumeName} (${deriveVolumeLabel(volumeName, volumeOrder)}) for ${companyProfile.company_name}'s proposal response to ${agencyDisplayName}.

${buildPageLimitInstruction(targetWordCount, data.pageLimit, spacing)}

${contractContextBlock}
${sitesBlock}${networksBlock}${techLandscapeBlock}${standardsBlock}

COMPANY TECHNICAL CAPABILITIES:
- Core Services: ${companyProfile.core_services_summary || '[PLACEHOLDER: Core services summary not provided]'}
- Corporate Overview: ${companyProfile.corporate_overview || '[PLACEHOLDER: Corporate overview not provided]'}
- Key Differentiators: ${companyProfile.key_differentiators_summary || '[PLACEHOLDER: Key differentiators not provided]'}
${certSection}${vehicleSection}${keyPersonnelSection}${teamingBlock}
OUR TECHNICAL APPROACH FOR THIS BID:
- Approach Summary: ${technical_approach?.approach_summary || '[PLACEHOLDER: Technical approach summary not provided in data call]'}
- Tools and Platforms: ${technical_approach?.tools_and_platforms || '[PLACEHOLDER: Tools and platforms not specified]'}
- Staffing Model: ${technical_approach?.staffing_model || '[PLACEHOLDER: Staffing model not described]'}
- Key Assumptions: ${technical_approach?.assumptions || '[PLACEHOLDER: Technical assumptions not documented]'}
- Risk Mitigations: ${technical_approach?.risks || '[PLACEHOLDER: Risk areas and mitigations not documented]'}
${serviceAreasBlock}${taskAreaText}${techSelectionsBlock}${siteStaffingBlock}${modernizationBlock}${deliverablesBlock}
${buildComplianceDataBlock(data.dataCallResponse)}${buildKeyPersonnelRegistryBlock(data.dataCallResponse.key_personnel, data.personnel)}${buildPersonnelDocsBlock(data.dataCallFiles)}
SECTION M TECHNICAL EVALUATION FACTORS (address each explicitly):
${technicalFactorText}

WRITING INSTRUCTIONS:
1. Do NOT include a cover letter or transmittal letter. Start directly with the Executive Summary.
2. Open each major section with a win theme callout box (1-2 sentences max per box).
3. ${structureInstruction}
4. SECTION HEADINGS MUST USE EVALUATION FACTOR NAMES: For each evaluation factor/subfactor listed in the SECTION M block above, create a section heading that uses the EXACT factor name verbatim (e.g., if the TOR says "M.1.1 Technical Approach — Technical Merit", use "M.1.1 Technical Merit" as a heading). An evaluator should be able to ctrl+F the factor/subfactor ID and name and find a dedicated section immediately. Do NOT reorganize the document in a way that buries evaluation factors inside other headings.
5. Include a requirements traceability approach — show how your technical approach traces to each task area.
6. Use specific evidence for every capability claim — reference contract experience, tools, or certifications.
7. Name ONLY technologies that appear in the source data above (tools_and_platforms, technology_selections, service_area_approaches, or SOW). Confirmed tools: ${requiredPlatforms.slice(0, 8).map(p => p.name).join(', ') || 'see source data'}. Do NOT name tools not listed in source data — describe the capability approach instead.
8. Reference the actual agency name "${agencyDisplayName}" — never use generic "the agency."
9. For multi-site contracts, describe how operations will be managed across ${sites.length > 0 ? sites.map(s => s.name).join(', ') : 'all performance sites'}.
10. Reference EVERY CDRL by its exact ID in the relevant task area section. Include a consolidated deliverables table.
11. Cite SPRS score and assessment date in the cybersecurity section (e.g., "SPRS score of [X], assessed [date], per DFARS 252.204-7019").
12. Include a Disaster Recovery / Business Continuity approach referencing CDRL A006.
13. In Planning Support, address market research for hardware AND IT process evaluation methodology.
14. In Infrastructure Monitoring, address critical asset list maintenance.
15. Include a labor category matrix table: category, minimum qualifications, certifications, estimated annual hours. Use the SAME labor categories and qualifications across all volumes for consistency. For estimated annual hours, use 1,920 hours per year for full-time roles (standard 2,080 minus federal holidays and leave). Do NOT use [HUMAN INPUT REQUIRED] for hours — calculate from the FTE count in the staffing data.
16. Include a teaming cohesiveness section: how ${companyProfile.company_name} and subcontractors integrate operationally — communication, escalation, workshare.
17. Reference Key Personnel resumes and LOCs as separate attachments. Reference subcontractor LOCs by company name.
18. The Risk Management section MUST contain substantive content: identify at least 5 specific risks relevant to this contract (transition, staffing, technology, security, schedule), rate each by likelihood and impact, and describe concrete mitigation strategies. Do NOT leave this section empty or as a heading only.
19. Do NOT include appendices in this volume. No resume appendix, no past performance appendix, no certifications appendix. This volume is ONLY the technical narrative.
20. Include a Small Business Participation subsection identifying subcontractor roles, workshare percentages, and small business participation commitments.
21. In the Customer Training section, explicitly address ALL delivery methods required by the SOW including over-the-shoulder training, just-in-time training, classroom/virtual training, and self-paced materials. Do not omit any required training delivery method.
22. Include an explicit cross-reference to the separately submitted Performance Work Statement (PWS) by attachment designation (e.g., "as detailed in our separately submitted Performance Work Statement, Attachment X").
23. In the Cybersecurity section, include explicit compliance statements for BOTH DFARS 252.204-7019 (NIST SP 800-171 assessment) AND DFARS 252.204-7012 (Safeguarding Covered Defense Information). Both are required for DoD contracts.
24. In service area subsections, ONLY reference tools and technologies that are listed in the source data. If no specific tool is listed for a service area, describe the technical approach and methodology without naming specific commercial products.
${winThemeInstructions}
${buildChecklistEnforcementBlock(data.rfpChecklists)}${buildModernizationEnforcementBlock(modernizationGoals, getExtractionField<string>(sowPwsRows, 'document_type') || 'RFP')}
${buildSparseDataInstruction()}`;
}

/**
 * Build user prompt for a Management volume.
 * Enriched with multi-site management, ITIL/SLA framework, operational context,
 * and CLIN category management.
 */
function buildManagementPrompt(
  volumeName: string,
  volumeOrder: number,
  data: VolumePromptData,
  targetWordCount: number
): string {
  const { companyProfile, dataCallResponse, extractions } = data;
  const { key_personnel, opportunity_details } = dataCallResponse;

  const contractStyle = detectContractStyle(extractions);

  // ── Operational Context from extraction ──
  const opCtxRows = extractions.operational_context || [];
  const agencyName = getExtractionField<string>(opCtxRows, 'agency_name');
  const agencyAbbr = getExtractionField<string>(opCtxRows, 'agency_abbreviation');
  const userCount = getExtractionField<string>(opCtxRows, 'user_count');
  const sites = getExtractionField<OperationalContextFields['sites']>(opCtxRows, 'sites') || [];
  const incumbentContractor = getExtractionField<string | null>(opCtxRows, 'incumbent_contractor');
  const clinCategories = getExtractionField<OperationalContextFields['clin_categories']>(opCtxRows, 'clin_categories') || [];
  const networks = getExtractionField<OperationalContextFields['networks']>(opCtxRows, 'networks') || [];

  // ── Technology standards (for ITIL/framework refs) ──
  const techReqRows = extractions.technology_reqs || [];
  const requiredStandards = getExtractionField<TechnologyReqsFields['required_standards']>(techReqRows, 'required_standards') || [];

  // ── Service area performance metrics (for SLA framework) ──
  const sowPwsRows = extractions.sow_pws || [];
  const serviceAreaDetails = getServiceAreaDetails(sowPwsRows);
  const allPerformanceMetrics = serviceAreaDetails.flatMap(d => d.performance_metrics || []);

  // ── Tier 2 enrichments ──
  const siteStaffing = data.siteStaffing || [];

  const agencyDisplayName = agencyName
    ? `${agencyName}${agencyAbbr ? ` (${agencyAbbr})` : ''}`
    : '[PLACEHOLDER: Agency name]';

  const winThemeInstructions = buildWinThemeInstructions(
    companyProfile.enterprise_win_themes || []
  );

  // Cross-reference Tier 2 key_personnel with Tier 1 personnel for enriched bios
  const tier1Personnel = data.personnel || [];
  const personnelText = key_personnel && key_personnel.length > 0
    ? key_personnel.map((kp, i) => {
        const tier1Match = tier1Personnel.find(p =>
          p.full_name.toLowerCase() === (kp.name || '').toLowerCase()
        );
        let enrichment = '';
        if (tier1Match) {
          const edu = tier1Match.education?.[0];
          const certs = tier1Match.certifications?.slice(0, 5).map(c => c.name).join(', ');
          const recentWork = tier1Match.work_history?.slice(0, 2).map(w =>
            `${w.job_title} at ${w.employer} (${w.start_date}–${w.end_date})${w.description ? ': ' + w.description.slice(0, 100) : ''}`
          ).join('; ');
          enrichment = `\n     Experience: ${tier1Match.total_experience_years} years total${tier1Match.federal_experience_years ? `, ${tier1Match.federal_experience_years} years federal` : ''}` +
            (edu ? `\n     Education: ${edu.degree_level} in ${edu.field_of_study} (${edu.institution})` : '') +
            (certs ? `\n     Certifications: ${certs}` : '') +
            (tier1Match.clearance_level && tier1Match.clearance_level !== 'None' ? `\n     Clearance: ${tier1Match.clearance_level} (${tier1Match.clearance_status || 'Unknown'})` : '') +
            (recentWork ? `\n     Recent Work: ${recentWork}` : '');
        }
        return `  ${i + 1}. ${kp.role}: ${kp.name}\n     Qualifications: ${kp.qualifications_summary || '[PLACEHOLDER: Qualifications summary not provided]'}${enrichment}`;
      }).join('\n\n')
    : '  [PLACEHOLDER: Key personnel not entered in data call — add proposed individuals with qualifications]';

  const teaming = opportunity_details?.prime_or_sub === 'teaming' && opportunity_details.teaming_partners?.length > 0
    ? `Teaming Partners: ${opportunity_details.teaming_partners.join(', ')}`
    : opportunity_details?.prime_or_sub === 'sub'
    ? `Performing as: Subcontractor`
    : `Performing as: Prime Contractor`;

  // ── Multi-site management context ──
  const multiSiteBlock = sites.length > 1
    ? `\nMULTI-SITE MANAGEMENT CONTEXT (${sites.length} sites):
${sites.map(s =>
  `  - ${s.name}${s.abbreviation ? ` (${s.abbreviation})` : ''}: ${s.location}${s.is_primary ? ' [PRIMARY]' : ''}`
).join('\n')}
${siteStaffing.length > 0 ? `\nPROPOSED SITE STAFFING:\n${siteStaffing.map(s =>
  `  - ${s.site_name}: ${s.proposed_fte_count}${s.key_roles ? ` — ${s.key_roles}` : ''}${s.special_requirements ? ` | ${s.special_requirements}` : ''}`
).join('\n')}` : ''}`
    : '';

  // ── CLIN Category Management ──
  const clinBlock = clinCategories.length > 0
    ? `\nCLIN CATEGORIES TO MANAGE:\n${clinCategories.map(c =>
        `  - ${c.category}: ${c.description}${c.scope ? ` — Scope: ${c.scope}` : ''}`
      ).join('\n')}`
    : '';

  // ── ITIL/Framework requirements ──
  const itilStandards = requiredStandards.filter(s =>
    s.name.toLowerCase().includes('itil') || s.name.toLowerCase().includes('itsm')
  );
  const frameworkBlock = itilStandards.length > 0
    ? `\nITIL/ITSM FRAMEWORK REQUIREMENTS:\n${itilStandards.map(s => `  - ${s.name}: ${s.context}`).join('\n')}`
    : '';

  // ── SLA Framework ──
  const slaBlock = allPerformanceMetrics.length > 0
    ? `\nSLA/PERFORMANCE METRICS FROM SOW (address in QCP and SLA Management sections):\n${allPerformanceMetrics.slice(0, 15).map(m =>
        `  - ${m.metric}: ${m.target}`
      ).join('\n')}${allPerformanceMetrics.length > 15 ? `\n  ... and ${allPerformanceMetrics.length - 15} more metrics` : ''}`
    : '';

  // ── Network environment for security management ──
  const networkBlock = networks.length > 0
    ? `\nNETWORK ENVIRONMENT (address in security management approach):\n${networks.map(n =>
        `  - ${n.name} (${n.classification}): ${n.description}`
      ).join('\n')}`
    : '';

  // ── Structure instructions based on contract style ──
  let structureInstruction: string;
  switch (contractStyle) {
    case 'it_operations':
      structureInstruction = `Structure:
   Executive Summary → Organizational Structure (enterprise + per-site) → Key Personnel Bios →
   Multi-Site Management Plan (how you manage across ${sites.length} sites) →
   Staffing Plan (per-site FTE breakdown calibrated to ${userCount || 'user population'}) →
   Transition Plan (phased by site, address incumbent ${incumbentContractor || 'contractor'} knowledge transfer) →
   ITIL Process Framework → SLA Management Plan → Quality Control Plan → Risk Management Plan`;
      break;
    default:
      structureInstruction = `Structure: Executive Summary → Organizational Structure → Key Personnel Bios → Staffing Plan → Transition Plan (Phase-In/Phase-Out) → Quality Control Plan → Risk Management Plan.`;
  }

  const spacing = data.pageLimitSpacing || 'single';

  return `You are writing the ${volumeName} (${deriveVolumeLabel(volumeName, volumeOrder)}) for ${companyProfile.company_name}'s proposal response to ${agencyDisplayName}.

${buildPageLimitInstruction(targetWordCount, data.pageLimit, spacing)}

COMPANY MANAGEMENT APPROACH:
- Standard Management Approach: ${companyProfile.standard_management_approach || '[PLACEHOLDER: Standard management approach narrative not provided in Tier 1 profile]'}
- Corporate Overview: ${companyProfile.corporate_overview || '[PLACEHOLDER: Corporate overview not provided]'}
- ${teaming}
- Contract Scale: ${userCount ? `Supporting ${userCount}` : '[PLACEHOLDER: User count]'} across ${sites.length > 0 ? `${sites.length} sites` : '[PLACEHOLDER: site count]'}

KEY PERSONNEL FOR THIS BID:
${personnelText}
${multiSiteBlock}${clinBlock}${frameworkBlock}${slaBlock}${networkBlock}${buildComplianceDataBlock(data.dataCallResponse)}${buildKeyPersonnelRegistryBlock(data.dataCallResponse.key_personnel, data.personnel)}${buildPersonnelDocsBlock(data.dataCallFiles)}

WRITING INSTRUCTIONS:
1. Do NOT include a cover letter or transmittal letter. Start directly with the Executive Summary or Organizational Structure.
2. Open each major section with a win theme callout box (see below).
3. ${structureInstruction}
4. For each key personnel entry, include: role, name, relevant qualifications, years of experience, and how their experience directly supports this contract. State "Resumes and Letters of Commitment are provided as separate attachments."
5. Transition Plan must address: Day 1 readiness, knowledge transfer from ${incumbentContractor || 'incumbent contractor'}, staff retention strategy, and timeline with milestones. Include all three phases (Days 1-10, 11-20, 21-30) and Full Operational Capability (FOC) declaration criteria.${sites.length > 1 ? ` Address phased transition across ${sites.map(s => s.name).join(', ')}.` : ''}
6. Quality Control Plan must address: QCP methodology, inspection points, corrective action procedures, and continuous improvement process.${allPerformanceMetrics.length > 0 ? ' Tie QCP to the SLA metrics listed above and reference the QASP as a separately submitted volume.' : ''}
7. Use the standard management approach narrative as the foundation — customize it for ${agencyDisplayName}.
8. SECTION HEADINGS MUST USE EVALUATION FACTOR NAMES: For each management evaluation factor/subfactor from Section M, create a section heading that uses the EXACT factor name and ID verbatim (e.g., "M.1.2 Management Approach — Key Personnel"). An evaluator must be able to ctrl+F the factor ID and find a dedicated section.
9. Reference the actual agency name "${agencyDisplayName}" — never use generic placeholders.
10. Calibrate staffing numbers to the contract scale (${userCount || '[PLACEHOLDER]'} users, ${sites.length} sites). The site staffing table MUST show FTE counts for EVERY site — do not leave any site rows as PLACEHOLDER if the data is provided above.
11. Include a labor category matrix table showing each category, minimum qualifications, required certifications, and estimated annual hours. Use the SAME labor categories as the Technical volume to ensure cross-volume consistency. For estimated annual hours, use 1,920 hours per year per FTE (standard 2,080 minus federal holidays and leave). Do NOT use [HUMAN INPUT REQUIRED] for hours.
12. Cite SPRS score and NIST 800-171 assessment date in relevant security/compliance sections. Reference the SSP and POA&M as separately submitted volumes.
13. Do NOT include appendices. This volume is ONLY the management/personnel narrative.
14. Include a DEDICATED Recruitment Plan subsection addressing: how you attract cleared IT professionals, local labor market sourcing, veteran hiring pipeline, university partnerships, and use of GSA Schedule labor pools.
15. Include a DEDICATED Retention Plan subsection addressing: professional development and certification sponsorship, career progression paths, competitive compensation benchmarking, recognition programs, and employee satisfaction tracking.
16. Include a Small Business Participation Plan subsection identifying subcontractor roles, workshare percentages, and any additional small business participation commitments.
17. For each key personnel: If their availability is NOT "Immediately Available" (e.g., "2 Weeks Notice"), the transition plan must account for this delay — do NOT imply Day 1 availability for personnel who require a notice period. Include availability status in the personnel bio section.

SECTION WORD BUDGET${data.pageLimit ? ` (${data.pageLimit} pages = ~${targetWordCount} words max)` : ''}:
- Executive Summary: ~200 words
- Organizational Structure: ~300 words
- Key Personnel Bios: ~400 words (brief per person)
- Staffing Plan + Site Table: ~350 words
- Transition Plan: ~400 words
- Quality Control Plan: ~300 words
- Risk Management: ~250 words
- Recruitment Plan: ~150 words
- Retention Plan: ~150 words
This budget leaves margin for win theme callouts and tables. Adhere closely to prevent page limit overruns.
${winThemeInstructions}
${buildChecklistEnforcementBlock(data.rfpChecklists)}
${buildSparseDataInstruction()}`;
}

/**
 * Build user prompt for a Past Performance volume.
 * One section per reference, structured with relevance justification.
 */
function buildPastPerformancePrompt(
  volumeName: string,
  volumeOrder: number,
  data: VolumePromptData,
  targetWordCount: number
): string {
  const { companyProfile, dataCallResponse, extractions } = data;
  const { past_performance, opportunity_details } = dataCallResponse;

  // Section M past performance relevance criteria from Phase 7 extraction
  const ppExtraction = extractions.past_performance || [];
  const ppFields = ppExtraction.length > 0
    ? (ppExtraction[0].field_value as { recency_requirement?: string; relevance_criteria?: string[]; references_required?: number | string }) || {}
    : {};

  const winThemeInstructions = buildWinThemeInstructions(
    companyProfile.enterprise_win_themes || []
  );

  // Cross-reference Tier 2 past_performance refs with Tier 1 PastPerformance records
  const tier1PP = data.pastPerformance || [];
  const refsText = past_performance && past_performance.length > 0
    ? past_performance.map((ref, i) => {
        // Try matching by contract number or project name
        const tier1Match = tier1PP.find(pp =>
          (ref.contract_number && pp.contract_number && pp.contract_number.toLowerCase() === ref.contract_number.toLowerCase()) ||
          (ref.project_name && pp.contract_name && pp.contract_name.toLowerCase() === ref.project_name.toLowerCase())
        );
        let enrichment = '';
        if (tier1Match) {
          const cpars = tier1Match.cpars_rating;
          const cparsText = cpars ? `Overall: ${cpars.overall}${cpars.quality ? `, Quality: ${cpars.quality}` : ''}${cpars.schedule ? `, Schedule: ${cpars.schedule}` : ''}${cpars.management ? `, Management: ${cpars.management}` : ''}${cpars.cost_control ? `, Cost Control: ${cpars.cost_control}` : ''}` : '';
          const achievements = tier1Match.achievements?.slice(0, 3).map(a => `${a.statement} (${a.metric_value})`).join('; ');
          enrichment =
            (cparsText ? `\n    - CPARS Ratings: ${cparsText}` : '') +
            (tier1Match.description_of_effort ? `\n    - Description of Effort: ${tier1Match.description_of_effort.slice(0, 500)}` : '') +
            (tier1Match.task_areas?.length ? `\n    - Task Areas: ${tier1Match.task_areas.join(', ')}` : '') +
            (tier1Match.tools_used?.length ? `\n    - Tools Used: ${tier1Match.tools_used.join(', ')}` : '') +
            (achievements ? `\n    - Key Achievements: ${achievements}` : '') +
            `\n    - Team Size: ${tier1Match.team_size || 'N/A'}, Role: ${tier1Match.role || 'N/A'}`;
        }
        return `  Reference ${i + 1}:
    - Project Name: ${ref.project_name}
    - Client Agency: ${ref.client_agency}
    - Contract Number: ${ref.contract_number}
    - Contract Value: ${ref.contract_value}
    - Period of Performance: ${ref.period_of_performance}
    - Relevance Summary: ${ref.relevance_summary}
    - POC: ${ref.contact_name} (${ref.contact_email}, ${ref.contact_phone})${enrichment}`;
      }).join('\n\n')
    : '  [PLACEHOLDER: Past performance references not entered in data call — add at least the required number of references]';

  const spacing = data.pageLimitSpacing || 'single';

  // ── Extract TOR format requirements from Section L ──
  const sectionLRows = extractions.section_l || [];
  const volumeStructure = sectionLRows.find(r => r.field_name === 'volume_structure');
  const ppVolumeInstructions = volumeStructure?.field_value as { volumes?: Array<{ name: string; instructions?: string }> } | undefined;
  const ppVolumeInstr = ppVolumeInstructions?.volumes?.find(v =>
    v.name.toLowerCase().includes('past perf')
  );

  // ── Subcontractor/teaming data ──
  const teamingPartners = (opportunity_details as unknown as Record<string, unknown>)?.teaming_partners as Array<{ name: string; role: string }> | undefined;

  return `You are writing the ${volumeName} (${deriveVolumeLabel(volumeName, volumeOrder)}) for ${companyProfile.company_name}'s proposal response.

${buildPageLimitInstruction(targetWordCount, data.pageLimit, spacing)}.

RFP PAST PERFORMANCE REQUIREMENTS:
- References Required: ${ppFields.recency_requirement ? `Recency: ${ppFields.recency_requirement}` : '[PLACEHOLDER: Recency requirement not extracted]'}
- Relevance Criteria: ${ppFields.relevance_criteria?.join('; ') || '[PLACEHOLDER: Relevance criteria not extracted from Section M/past performance section]'}
- References Count Required: ${ppFields.references_required || '[PLACEHOLDER: Number of references required not extracted]'}
${ppVolumeInstr?.instructions ? `\nTOR/RFP FORMAT INSTRUCTIONS FOR THIS VOLUME:\n${ppVolumeInstr.instructions}` : ''}

PAST PERFORMANCE REFERENCES FROM DATA CALL:
${refsText}

TIER 1 PAST PERFORMANCE DATABASE (use for enriching references with detailed achievements, CPARS, tools, task areas):
${tier1PP.length > 0 ? tier1PP.map((pp, i) => {
    const cpars = pp.cpars_rating;
    const cparsText = cpars ? `CPARS: Overall=${cpars.overall}${cpars.quality ? `, Quality=${cpars.quality}` : ''}${cpars.schedule ? `, Schedule=${cpars.schedule}` : ''}${cpars.management ? `, Management=${cpars.management}` : ''}${cpars.cost_control ? `, Cost Control=${cpars.cost_control}` : ''}` : 'CPARS: Not available';
    return `  ${i + 1}. ${pp.contract_nickname || pp.contract_name} — ${pp.client_agency}
     Contract: ${pp.contract_number}, Value: $${pp.contract_value?.toLocaleString()}, Period: ${pp.start_date} to ${pp.end_date}
     Role: ${pp.role}, Team Size: ${pp.team_size}, Place: ${pp.place_of_performance}
     ${cparsText}
     Scope: ${pp.description_of_effort?.slice(0, 300) || 'N/A'}
     Task Areas: ${pp.task_areas?.join(', ') || 'N/A'}
     Tools: ${pp.tools_used?.join(', ') || 'N/A'}
     Achievements: ${pp.achievements?.slice(0, 3).map(a => `${a.statement} (${a.metric_value})`).join('; ') || 'N/A'}
     POC: ${pp.client_poc ? `${(pp.client_poc as unknown as Record<string, string>).name}, ${(pp.client_poc as unknown as Record<string, string>).title}, ${(pp.client_poc as unknown as Record<string, string>).phone}, ${(pp.client_poc as unknown as Record<string, string>).email}` : 'N/A'}`;
  }).join('\n\n') : '  No Tier 1 past performance records available.'}
${teamingPartners && teamingPartners.length > 0 ? `\nTEAMING PARTNERS (TOR may allow subcontractor past performance):\n${teamingPartners.map(tp => `  - ${tp.name}: ${tp.role}`).join('\n')}\nIf the solicitation allows subcontractor references, include a section for major subcontractor past performance.` : ''}
${buildKeyPersonnelRegistryBlock(data.dataCallResponse.key_personnel, data.personnel)}
WRITING INSTRUCTIONS:
1. Do NOT include a cover letter or transmittal letter. Start directly with the volume content.
2. If the TOR/RFP specifies a format for past performance references, follow that EXACT format and section numbering — do NOT use a generic format.
   When the TOR specifies a per-reference structure, each reference MUST include ALL of these fields (use [HUMAN INPUT REQUIRED] for any not available in source data):
   - Section 1: Contract Description
     a. Contract name and number
     b. Contracting agency / activity
     c. CAGE code
     d. UEI (Unique Entity Identifier)
     e. Contracting Officer and COR names with contact info
     f. Contract type (FFP, CPFF, T&M, etc.)
     g. Awarded price / value
     h. Final or projected final price
     i. Original period of performance (start – end)
     j. Final or projected completion date
     k. Role (prime or subcontractor)
     l. Team size
   - Section 2: Performance Narrative (scope, achievements with metrics, CPARS ratings)
   - Section 3: Subcontractor / JV Partners (if applicable)
   Each section MUST use an explicit numbered heading (e.g., "Section 1 — Contract Description", "Section 2 — Performance Narrative", "Section 3 — Subcontractor Partners"). Do NOT omit these headings — evaluators expect them per the TOR format.
3. Select the MOST RELEVANT references from the Tier 1 database above. Prioritize contracts that match the current requirement in: scope (IT operations, service desk, infrastructure), magnitude (similar user count, team size, value), complexity (DoD, classified environments, multi-site), and agency (same agency or similar DoD/federal civilian).
4. Include ALL CPARS rating dimensions from the source data — you MUST output all 5 dimensions (Overall, Quality, Schedule, Management, Cost Control) when available. Do NOT selectively omit dimensions. Do NOT use [PLACEHOLDER] if the data is provided above. Format: "Received CPARS ratings of: Overall — Exceptional, Quality — Exceptional, Schedule — Very Good, Management — Exceptional, Cost Control — Very Good."
5. For each reference, explicitly map the scope/magnitude/complexity to the current requirement using the evaluation criteria language.
6. If subcontractor past performance is allowed (e.g., TOR says "major subcontractors" or partners with 10%+ workshare), include a separate section for each qualifying subcontractor with their most relevant reference following the same format. Check the TOR/RFP volume instructions for explicit guidance on subcontractor past performance. If the TOR permits subcontractor references, state that explicitly — do NOT use [HUMAN INPUT REQUIRED] for something answerable from the solicitation data.
7. Avoid generic language — every claim about performance quality must be traceable to the source data above.
8. Do NOT include appendices that duplicate the body references. The body content IS the past performance volume.
${winThemeInstructions}
${buildSparseDataInstruction()}`;
}

/**
 * Build user prompt for a Cost/Price volume.
 * Produces price narrative and basis of estimate with [PLACEHOLDER] markers for actual numbers.
 */
function buildCostPricePrompt(
  volumeName: string,
  volumeOrder: number,
  data: VolumePromptData,
  targetWordCount: number
): string {
  const { companyProfile, dataCallResponse, extractions } = data;
  const { opportunity_details } = dataCallResponse;

  // Admin data for CLIN structure and contract type
  const adminExtraction = extractions.admin_data || [];
  const adminFields: AdminDataFields = adminExtraction.length > 0
    ? (adminExtraction[0].field_value as AdminDataFields) || {}
    : {};

  const clinText = adminFields.clin_structure && adminFields.clin_structure.length > 0
    ? adminFields.clin_structure.map(clin => `  - CLIN ${clin.clin_number}: ${clin.description}${clin.type ? ` (${clin.type})` : ''}`).join('\n')
    : '  [PLACEHOLDER: CLIN structure not extracted from Section J or admin documents]';

  // Tier 1 enrichments for cost/price
  const vehicles = data.contractVehicles || [];
  const vehicleSection = vehicles.length > 0
    ? `\nACTIVE CONTRACT VEHICLES:\n${vehicles.map(v => `  - ${v.vehicle_name} (${v.vehicle_type})${v.ceiling_value ? ` — $${(v.ceiling_value / 1_000_000).toFixed(1)}M ceiling` : ''}${v.labor_categories?.length ? ` — Labor cats: ${v.labor_categories.slice(0, 5).join(', ')}` : ''}`).join('\n')}\n`
    : '';

  const certifications = data.certifications || [];
  const certSection = certifications.length > 0
    ? `\nRELEVANT CERTIFICATIONS:\n${certifications.map(c => `  - ${c.certification_type}${c.certifying_agency ? ` (${c.certifying_agency})` : ''}`).join('\n')}\n`
    : '';

  // Operational context for agency name and solicitation number
  const opCtxRows = extractions.operational_context || [];
  const agencyName = getExtractionField<string>(opCtxRows, 'agency_name');
  const agencyAbbr = getExtractionField<string>(opCtxRows, 'agency_abbreviation');
  const agencyDisplayName = agencyName
    ? `${agencyName}${agencyAbbr ? ` (${agencyAbbr})` : ''}`
    : '[PLACEHOLDER: Agency name]';
  const userCount = getExtractionField<string>(opCtxRows, 'user_count');
  const estimatedValue = getExtractionField<string | null>(opCtxRows, 'estimated_contract_value');

  // Section M cost/price evaluation factors
  const sectionMExtraction = extractions.section_m || [];
  const sectionMFields: SectionMFields = sectionMExtraction.length > 0
    ? (sectionMExtraction[0].field_value as SectionMFields) || {}
    : {};
  const costFactors = (sectionMFields.evaluation_factors || []).filter(f =>
    f.name.toLowerCase().includes('cost') || f.name.toLowerCase().includes('price')
  );
  const costFactorText = costFactors.length > 0
    ? costFactors.map(f => `  - ${f.name}: ${f.weight_description || 'weight not specified'}${f.subfactors?.map(sf => `\n    - ${sf.name}: ${sf.description || ''}`).join('') || ''}`).join('\n')
    : '';

  // Site staffing for labor category alignment
  const siteStaffing = data.siteStaffing || [];
  const totalFTE = siteStaffing.reduce((sum, s) => sum + (parseInt(String(s.proposed_fte_count)) || 0), 0);

  const spacing = data.pageLimitSpacing || 'single';

  return `You are writing the ${volumeName} (${deriveVolumeLabel(volumeName, volumeOrder)}) for ${companyProfile.company_name}'s proposal response to ${agencyDisplayName}.

${buildPageLimitInstruction(targetWordCount, data.pageLimit, spacing)}

SOLICITATION CONTEXT:
- Agency: ${agencyDisplayName}
- Estimated Contract Value: ${estimatedValue || '[PLACEHOLDER: Contract value not extracted]'}
- User Population: ${userCount || '[PLACEHOLDER: User count]'}
- Total Proposed FTEs: ${totalFTE || '[PLACEHOLDER: FTE count]'}

CONTRACT AND PRICING CONTEXT:
- Contract Type: ${opportunity_details?.contract_type || adminFields.contract_type || '[PLACEHOLDER: Contract type not specified]'}
- Period of Performance: ${adminFields.period_of_performance || '[PLACEHOLDER: Period of performance not extracted]'}
- Set-Aside: ${opportunity_details?.set_aside || '[PLACEHOLDER: Set-aside not specified]'}
${costFactorText ? `\nSECTION M COST/PRICE EVALUATION CRITERIA (use this EXACT language when discussing how costs will be evaluated):\n${costFactorText}` : ''}

CLIN STRUCTURE:
${clinText}
${vehicleSection}${certSection}${buildKeyPersonnelRegistryBlock(data.dataCallResponse.key_personnel, data.personnel)}
WRITING INSTRUCTIONS:
1. Write a Price Narrative / Basis of Estimate (BOE) — narrative text explaining the pricing methodology, NOT actual prices.
2. Structure: Pricing Approach Overview → Basis of Estimate Methodology → Labor Categories and Rates → Other Direct Costs → Fee/Profit Rationale.
3. Use [PLACEHOLDER: $X] for ALL dollar amounts, hourly rates, and percentages — the user will fill these in when completing the pricing spreadsheet in Microsoft Word.
4. Use [PLACEHOLDER: X hours] for labor hour estimates.
5. Use [PLACEHOLDER: X FTEs] for staffing levels.
6. Explain the rationale for the pricing approach without revealing the actual price — explain HOW prices were derived, not WHAT they are.
7. Reference the contract type (${opportunity_details?.contract_type || adminFields.contract_type || 'specified type'}) and explain how it influences the pricing structure.
8. Include a section on price reasonableness and how the company ensures competitive, fair pricing.
9. Reference the actual agency name "${agencyDisplayName}" — never use generic placeholders for the agency name or solicitation number.
10. Use the SAME labor categories from the Technical Volume's labor category matrix for consistency. If site staffing data is provided, align the labor hour estimates with the proposed FTE counts.
${buildSparseDataInstruction()}`;
}

/**
 * Build user prompt for an unrecognized/default volume type.
 * Includes all available data and instructs on addressing the volume name as a topic.
 */
function buildDefaultPrompt(
  volumeName: string,
  volumeOrder: number,
  data: VolumePromptData,
  targetWordCount: number
): string {
  const { companyProfile, dataCallResponse } = data;
  const { opportunity_details, technical_approach } = dataCallResponse;

  const winThemeInstructions = buildWinThemeInstructions(
    companyProfile.enterprise_win_themes || []
  );

  // Tier 1 capability summary
  const naicsCodes = data.naicsCodes || [];
  const naicsSection = naicsCodes.length > 0
    ? `\nNAICS CODES:\n${naicsCodes.map(n => `  - ${n.code}: ${n.title}${n.is_primary ? ' (Primary)' : ''}`).join('\n')}\n`
    : '';

  const capabilityCounts = [
    data.certifications?.length ? `${data.certifications.length} certifications` : null,
    data.contractVehicles?.length ? `${data.contractVehicles.length} contract vehicles` : null,
    data.personnel?.length ? `${data.personnel.length} personnel records` : null,
    data.pastPerformance?.length ? `${data.pastPerformance.length} past performance references` : null,
  ].filter(Boolean);
  const capabilitySummary = capabilityCounts.length > 0
    ? `\nCAPABILITY SUMMARY: ${capabilityCounts.join(', ')}\n`
    : '';

  const spacing = data.pageLimitSpacing || 'single';

  return `You are writing the ${volumeName} (${deriveVolumeLabel(volumeName, volumeOrder)}) for ${companyProfile.company_name}'s proposal response.

${buildPageLimitInstruction(targetWordCount, data.pageLimit, spacing)}

AVAILABLE COMPANY DATA:
- Company Name: ${companyProfile.company_name}
- Core Services: ${companyProfile.core_services_summary || '[PLACEHOLDER: Core services not provided]'}
- Corporate Overview: ${companyProfile.corporate_overview || '[PLACEHOLDER: Corporate overview not provided]'}
- Key Differentiators: ${companyProfile.key_differentiators_summary || '[PLACEHOLDER: Key differentiators not provided]'}
- Standard Management Approach: ${companyProfile.standard_management_approach || '[PLACEHOLDER: Management approach not provided]'}
${naicsSection}${capabilitySummary}${buildComplianceDataBlock(data.dataCallResponse)}${buildKeyPersonnelRegistryBlock(data.dataCallResponse.key_personnel, data.personnel)}${buildPersonnelDocsBlock(data.dataCallFiles)}
BID CONTEXT:
- Contract Type: ${opportunity_details?.contract_type || '[PLACEHOLDER: Contract type not specified]'}
- Set-Aside: ${opportunity_details?.set_aside || '[PLACEHOLDER: Set-aside not specified]'}
- Bid Role: ${opportunity_details?.prime_or_sub || '[PLACEHOLDER: Prime/sub role not specified]'}
- Technical Approach Summary: ${technical_approach?.approach_summary || '[PLACEHOLDER: Technical approach not provided]'}

WRITING INSTRUCTIONS:
1. Do NOT include a cover letter or transmittal letter. Start directly with the volume content.
2. Treat "${volumeName}" as the primary subject of this volume.
3. Follow all solicitation instructions for this volume — address any explicit requirements verbatim.
4. Structure the content to directly address the solicitation's requirements for this volume.
5. Apply formal government proposal writing style throughout.
6. Open each major section with a win theme callout box.
7. Do NOT include appendices unless this volume specifically requires them. Keep the content focused and within the page limit.
8. This document is part of a multi-volume proposal. Use the volume designation from the opening line (e.g., "Volume III") as the document header — do NOT use a raw sequential number. For sub-volumes (like a PWS within Volume I), use the document name as the title, not an independent volume number.
9. Use key_personnel names from the data call for all personnel references — do NOT substitute names from resume documents if they differ.
${winThemeInstructions}
${buildChecklistEnforcementBlock(data.rfpChecklists)}
${buildSparseDataInstruction()}`;
}

// ===== BOE / P2W CONTEXT HELPERS =====

/**
 * Build a BOE (Basis of Estimate) staffing context block for volume prompts.
 *
 * For cost/price volumes: full BOE table (labor category | FTE | annual hours) plus narrative.
 * For management/technical volumes: FTE totals by category only, with a pointer to the C/P volume.
 * Returns '' when no usable BOE data is present.
 */
function buildBoeContextBlock(
  boeAssessment: BoeAssessment | null | undefined,
  volumeType: string
): string {
  if (!boeAssessment || !boeAssessment.boe_table || boeAssessment.boe_table.length === 0) {
    return '';
  }

  const boeTable = boeAssessment.boe_table;

  if (volumeType === 'cost_price') {
    // Full BOE table + narrative for cost/price volumes
    const tableRows = boeTable
      .map(row => `  ${row.labor_category} | ${row.fte_count} FTE | ${row.total_annual_hours.toLocaleString()} hrs/yr`)
      .join('\n');

    const narrative = boeAssessment.narrative_markdown
      ? `\nBOE NARRATIVE:\n${boeAssessment.narrative_markdown}\n`
      : '';

    const totalFte = boeAssessment.total_fte_proposed != null
      ? `\nTOTAL PROPOSED FTEs: ${boeAssessment.total_fte_proposed}`
      : '';

    const confidence = boeAssessment.sow_confidence
      ? `\nSOW CONFIDENCE: ${boeAssessment.sow_confidence.toUpperCase()}`
      : '';

    return `\n=== BASIS OF ESTIMATE (INDEPENDENT STAFFING ASSESSMENT) ===
The following staffing model was derived directly from the SOW/PWS requirements.
Use these labor categories, FTE counts, and annual hours as your pricing baseline.

STAFFING TABLE (Labor Category | FTE Count | Annual Hours):
${tableRows}${totalFte}${confidence}${narrative}
=== END BOE ===\n\n`;
  }

  // For management and technical volumes: summarized FTE totals by category
  // Aggregate FTEs by labor category across all task areas
  const fteTotals = new Map<string, number>();
  for (const row of boeTable) {
    fteTotals.set(row.labor_category, (fteTotals.get(row.labor_category) ?? 0) + row.fte_count);
  }

  const summaryRows = Array.from(fteTotals.entries())
    .map(([cat, fte]) => `  ${cat}: ${fte} FTE`)
    .join('\n');

  const totalFte = boeAssessment.total_fte_proposed != null
    ? `\nTotal Proposed FTEs: ${boeAssessment.total_fte_proposed}`
    : '';

  return `\n=== BASIS OF ESTIMATE (INDEPENDENT STAFFING ASSESSMENT) ===
Use the following FTE summary when discussing staffing levels in this volume.
Full BOE detail (task-area breakdown, hours, rationale) is in the Cost/Price volume.

FTE SUMMARY BY LABOR CATEGORY:
${summaryRows}${totalFte}

Note: These counts are derived from the independent BOE analysis of the SOW/PWS requirements.
=== END BOE SUMMARY ===\n\n`;
}

/**
 * Build a P2W (Price-to-Win) competitive rate benchmarks block for cost/price prompts.
 *
 * Only injected for cost/price volumes — rate data is competitive intelligence and must
 * not appear in technical or management volumes where evaluators may see it out of context.
 * Returns '' for all other volume types.
 */
function buildP2wRatesBlock(
  p2wAnalysis: P2wAnalysis | null | undefined,
  volumeType: string
): string {
  // P2W is price-sensitive — only expose to cost/price volume
  if (volumeType !== 'cost_price') return '';
  if (!p2wAnalysis || !p2wAnalysis.rate_table || p2wAnalysis.rate_table.length === 0) return '';

  const rateRows = p2wAnalysis.rate_table
    .map(row => `  ${row.labor_category}: $${row.recommended_target.toFixed(2)}/hr (${row.rate_confidence} confidence)`)
    .join('\n');

  const totalCostNote = p2wAnalysis.total_cost_target != null
    ? `\nESTIMATED TOTAL CONTRACT VALUE (target): $${p2wAnalysis.total_cost_target.toLocaleString()}`
    : '';

  const igceNote = p2wAnalysis.igce_comparison_note
    ? `\nIGCE COMPARISON: ${p2wAnalysis.igce_comparison_note}`
    : '';

  return `\n=== COMPETITIVE RATE BENCHMARKS (use recommended_target rates in pricing) ===
These rates are based on BLS OES and GSA Schedule benchmarks.
Use the recommended_target as your pricing baseline when writing rate justification narrative.

RECOMMENDED HOURLY RATES BY LABOR CATEGORY:
${rateRows}${totalCostNote}${igceNote}

Note: These benchmarks are derived from publicly available BLS OES wage data and GSA Schedule pricing.
Reference the methodology (BLS OES + GSA Schedule analysis) when explaining your price reasonableness approach.
=== END RATE BENCHMARKS ===\n\n`;
}

// ===== MAIN EXPORTED FUNCTIONS =====

const ROMAN_NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

/**
 * Derive a human-readable volume label from the volume name and type.
 * TOR-style proposals use Roman numerals (Volume I, II, III, IV).
 * Maps known volume types to their canonical TOR positions; falls back
 * to the volume name itself for sub-volumes (PWS, QASP, SSP, etc.).
 */
function deriveVolumeLabel(volumeName: string, volumeOrder: number): string {
  const name = volumeName.toLowerCase();

  if (name.includes('technical') || name.includes('approach')) return 'Volume I';
  if (name.includes('management') || name.includes('staffing') || name.includes('transition')) return 'Volume II';
  if (name.includes('past perf') || name.includes('past performance')) return 'Volume III';
  if (name.includes('cost') || name.includes('price')) return 'Volume IV';

  if (volumeOrder <= ROMAN_NUMERALS.length) return `Volume ${ROMAN_NUMERALS[volumeOrder - 1]}`;
  return volumeName;
}

/**
 * Assemble a structured AI prompt for a single proposal volume.
 *
 * Detects the volume type from volumeName using keyword matching, then builds
 * a tailored system + user prompt incorporating all three data sources.
 *
 * @param volumeName   - Section L volume name (e.g., "Technical Approach", "Management")
 * @param volumeOrder  - Position in the volume sequence (1-based)
 * @param data         - Bundle of Tier 1, Tier 2, and extraction data plus page limit
 * @returns            System prompt, user prompt, and target word count
 */
// ===== STRATEGY + SME INJECTION BLOCKS =====

/**
 * Build the Proposal Manager strategy brief block.
 * Injected as the FIRST block in the user prompt before all data sections.
 * When present, this sets the writer's strategic intent before they see any data.
 */
function buildStrategyBlock(
  strategy: SolicitationStrategy | null | undefined,
  volumeName: string
): string {
  if (!strategy) return '';

  const parts: string[] = [
    '=== PROPOSAL MANAGER STRATEGY BRIEF ===',
    'CRITICAL: Follow these strategic directions throughout this volume. They override default approach.',
  ];

  if (strategy.win_theme_priorities?.length) {
    parts.push('\nWIN THEME PRIORITY ORDER (weave these in sequence — #1 is most important):');
    strategy.win_theme_priorities.forEach((t, i) => {
      parts.push(`  ${i + 1}. ${t}`);
    });
  }

  if (strategy.risk_posture && strategy.risk_posture !== 'balanced') {
    const postureCopy: Record<string, string> = {
      aggressive: 'AGGRESSIVE POSTURE — Lead with bold claims backed by metrics. Push win themes hard in every section. Use competitive language.',
      conservative: 'CONSERVATIVE POSTURE — Compliance-first, measured tone. Let facts and data speak. Minimize unsupported claims.',
    };
    parts.push(`\nRISK POSTURE: ${postureCopy[strategy.risk_posture] || strategy.risk_posture.toUpperCase()}`);
  }

  const volStrategy = strategy.volume_strategies?.find(
    (v) => v.volume_name === volumeName
  );

  if (volStrategy?.approach_notes?.trim()) {
    parts.push(`\nVOLUME APPROACH (follow these PM instructions for this volume):\n${volStrategy.approach_notes}`);
  }

  if (volStrategy?.emphasis_areas?.length) {
    parts.push(`\nEMPHASIS AREAS (lead with these topics, put them first in relevant sections):`);
    volStrategy.emphasis_areas.forEach((a) => parts.push(`  - ${a}`));
  }

  if (strategy.agency_intel?.trim()) {
    parts.push(`\nAGENCY INTELLIGENCE (inform your framing and tone):\n${strategy.agency_intel}`);
  }

  if (strategy.competitive_notes?.trim()) {
    parts.push(`\nCOMPETITIVE CONTEXT:\n${strategy.competitive_notes}`);
  }

  parts.push('=== END STRATEGY BRIEF ===');
  return parts.join('\n') + '\n\n';
}

/**
 * Phase 3C — Win theme solicitation adaptation.
 *
 * Produces an ordered list of win themes adapted to the specific solicitation.
 * Starts from the PM's strategy win theme priorities if available; otherwise
 * falls back to the company's enterprise win themes. Each theme is annotated
 * with the Section M evaluation factor it most closely aligns with, so proposal
 * writers can explicitly reference the criterion that the theme addresses.
 *
 * @param companyProfile        - Tier 1 company profile (source of enterprise_win_themes)
 * @param strategy              - PM strategy for this solicitation (may be null/undefined)
 * @param sectionMEvalFactors   - Flat list of eval factor names extracted from Section M
 * @returns                     Annotated win theme strings, Tier 2-priority order
 */
export function buildAdaptedWinThemes(
  companyProfile: CompanyProfile,
  strategy: SolicitationStrategy | null | undefined,
  sectionMEvalFactors: string[]
): string[] {
  // Source: strategy priorities (solicitation-specific) take precedence over enterprise themes
  const baseThemes: string[] =
    strategy?.win_theme_priorities?.length
      ? strategy.win_theme_priorities
      : companyProfile.enterprise_win_themes || [];

  if (baseThemes.length === 0) return [];

  return baseThemes.map((theme) => {
    // Build a keyword set from the theme text for fuzzy matching
    const themeWords = theme
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 3);

    // Find the first eval factor whose text shares a keyword with this theme
    const matchingFactor = sectionMEvalFactors.find((factor) => {
      const factorLower = factor.toLowerCase();
      return themeWords.some((word) => factorLower.includes(word));
    });

    return matchingFactor
      ? `${theme} (aligns with Section M: ${matchingFactor})`
      : theme;
  });
}

/**
 * Build the SME contributions block for a specific volume.
 * Only includes approved contributions matching the volume name.
 * Injected after personnel docs and before Section M factors.
 */
function buildSmeContributionsBlock(
  smeContributions: SmeContribution[] | undefined,
  volumeName: string
): string {
  const relevant = (smeContributions ?? []).filter(
    (c) => c.approved && c.volume_name === volumeName
  );
  if (!relevant.length) return '';

  const parts: string[] = [
    '=== SME EXPERT CONTRIBUTIONS (AUTHORITATIVE SOURCE MATERIAL) ===',
    'The following content was authored by certified subject matter experts assigned to this bid.',
    'MANDATORY: You MUST incorporate this content into the relevant sections of this volume.',
    'Paraphrase only minimally to fit narrative flow. Do NOT omit, skip, contradict, or fabricate beyond what is provided.',
    '',
  ];

  relevant.forEach((c, i) => {
    parts.push(`--- SME CONTRIBUTION ${i + 1} ---`);
    parts.push(`TOPIC: ${c.topic}`);
    parts.push(`CONTRIBUTOR: ${c.contributor_name}${c.contributor_title ? ` — ${c.contributor_title}` : ''}`);
    parts.push(`CONTENT:\n${c.content}`);
    parts.push('');
  });

  parts.push('=== END SME CONTRIBUTIONS ===');
  return parts.join('\n') + '\n\n';
}

export function assembleVolumePrompt(
  volumeName: string,
  volumeOrder: number,
  data: VolumePromptData
): VolumePromptResult {
  const { companyProfile, pageLimit } = data;
  const spacing = data.pageLimitSpacing || 'single';
  const targetWordCount = calculateTargetWordCount(pageLimit, spacing);
  const volumeType = detectVolumeType(volumeName);

  // ─── System Prompt (shared across all volume types) ──────────────────────
  const complianceInstructions = getComplianceInstructions(companyProfile.company_name);

  const systemPrompt = `You are an expert government proposal writer with 20+ years of experience winning federal contracts. You write in a formal, compliance-focused style using action verbs and "shall/will" phrasing. Every claim is backed by specific evidence. You mirror the evaluation criteria language from the RFP. You are writing for ${companyProfile.company_name} (${companyProfile.legal_name || companyProfile.company_name}).

Your proposals are indistinguishable from those written by top-tier government proposal shops. You understand the Federal Acquisition Regulation (FAR), color team reviews, and the SHIPLEY proposal development methodology. Your writing is persuasive, compliance-focused, and evaluator-friendly — structured so that a government Source Selection Board can easily score your proposal against the evaluation criteria.

Key rules:
1. Never fabricate specific facts — use [PLACEHOLDER: description] or [HUMAN INPUT REQUIRED: description] for any missing data.
2. Mirror the evaluation criteria language throughout the volume. Use the EXACT terminology from the solicitation's evaluation factors. Copy the factor/subfactor names VERBATIM and use them as section headings or opening phrases.
3. Use active voice and action verbs at the start of sentences.
4. Structure content so evaluators can quickly find evidence for each criterion.
5. NEVER exceed page limits — government evaluators strictly enforce page limits. Content beyond the limit may be discarded without evaluation.
6. Match your technical approach to the SPECIFIC scope of the SOW/PWS/SOO. If the contract is for IT operations/service desk/infrastructure management, write about those capabilities — do not default to cloud migration or modernization unless the SOW specifically calls for them.
7. Create a dedicated subsection for EVERY SOW/PWS/SOO task area. Do not skip or combine task areas.
8. Include a complete deliverables summary table listing ALL CDRLs with their EXACT ID (A001, A002, etc.), name, frequency, format, and responsible party.
9. Before writing, plan your section allocation: divide the word count across ALL required sections proportionally. Do NOT exhaust the page budget on early sections leaving later sections incomplete.
10. NEVER duplicate content. Each section heading must appear EXACTLY ONCE. Do NOT produce a second pass, revision, or appendix that repeats earlier sections. Output ONE complete document with sequential section numbering — no duplicates, no appendices that restate main body content.
11. Use the exact user count from the solicitation/SOO consistently throughout. Do not use different numbers in different sections.
12. Do NOT generate inline content for separate evaluated volumes or attachments. Cross-reference them instead.
13. Do NOT include a cover letter, transmittal letter, or letter of transmittal. Start directly with the volume content (executive summary or first section). Cover letters waste pages against the page limit and are not scored.
14. Do NOT include appendices within this volume unless explicitly instructed. No resume appendix, no past performance appendix, no certifications appendix, no compliance matrix appendix. Each of these is a separate proposal volume.

VOLUME SEPARATION (CRITICAL — violating this can disqualify a proposal):
- This volume MUST contain ONLY the content specified for this volume type. Do NOT include content that belongs in other volumes.
- NEVER include past performance narratives, contract references, or CPARS ratings in a Technical Volume. Past performance is ALWAYS a separate volume.
- NEVER include full resumes or curriculum vitae in a Technical Volume. Resumes are separate attachments. You may summarize key personnel qualifications in 2-3 sentences per person, then reference "see separately submitted resume for [Name]."
- NEVER include a certifications appendix, SDVOSB certificates, NAICS codes list, or contract vehicle list as an appendix to the Technical Volume. These belong in the Certifications/Representations volume.
- NEVER include a compliance matrix as an appendix within the Technical Volume. The compliance matrix is a separate volume.
- The ONLY content in this volume should be the technical/management narrative addressing the evaluation factors and SOW requirements.

SOLICITATION TERMINOLOGY:
- Use the actual terminology from this solicitation. If the solicitation is a Task Order Request (TOR), say "per TOR requirements" — do NOT say "per Section L requirements."
- If the solicitation uses SOO (Statement of Objectives), reference "the SOO" not "the SOW" or "the PWS."
- If the solicitation sections are numbered (e.g., "TOR Section 3"), use those section numbers — do NOT default to UCF section references (Section L, Section M) unless the solicitation actually uses UCF format.

NO FABRICATED METRICS OR COMMITMENTS:
- Do NOT fabricate SLA thresholds (e.g., "99.99% uptime", "99.995% availability") unless those exact numbers appear in the solicitation, QASP, or source data. If SLA values are not provided, use [HUMAN INPUT REQUIRED: insert SLA threshold from solicitation/QASP].
- Do NOT fabricate percentage improvement claims (e.g., "reduces attack surface by 80%", "reduces tickets by 60%"). These are unverifiable and evaluators will flag them as unsupported. Instead, describe the capability qualitatively or cite a specific past performance metric.
- Quantify ONLY when you have source data to back the number (contract values, team sizes, years of experience, CPARS ratings). For everything else, describe the benefit without making up a number.

SEPARATE VOLUME CROSS-REFERENCES (MANDATORY):
- If the solicitation requires a separate PWS volume, add at least one cross-reference: "as detailed in our separately submitted PWS volume."
- If the solicitation requires a separate QASP, reference it when discussing SLAs: "per our Quality Assurance Surveillance Plan (submitted as a separate volume)."
- If the solicitation requires a separate SSP, reference it in cybersecurity sections: "as documented in our separately submitted System Security Plan."
- If the solicitation requires a separate POA&M, reference it and acknowledge open items: "our Plan of Action and Milestones (submitted separately) addresses [N] open items."
- Reference Key Personnel resumes and Letters of Commitment: "Resumes and Letters of Commitment for all key personnel are provided as separate attachments."
- Reference Major Subcontractor LOCs: "Letters of Commitment from [subcontractor names] are included as separate attachments."
- Reference Facility Clearance Letter: "Our Facility Clearance verification (CAGE [code]) is provided per solicitation requirements."

KEY PERSONNEL NAME AUTHORITY (CROSS-VOLUME CONSISTENCY):
- The "AUTHORITATIVE KEY PERSONNEL REGISTRY" block in the user prompt is the SINGLE SOURCE OF TRUTH for key personnel names. Use ONLY those names for lead roles (Program Manager, Lead Systems Engineer, Cybersecurity Lead, etc.) throughout this volume.
- Do NOT use names from the "personnel" database, resume documents, or any other source if they differ from the registry. The registry names must be identical across all proposal volumes.
- If a resume's header says "John Smith" but the registry lists "Jane Doe" for that role, use "Jane Doe" in the narrative.
- The "personnel" table contains the broader company workforce. These people may be referenced as team members, but NEVER as key personnel leads unless they appear in the registry.
- This rule exists because evaluators read all volumes as a single package. Different names for the same role across volumes is a compliance failure that raises questions about which team is actually being proposed.

ATTRIBUTION AND CONSISTENCY:
- When citing team size or certified staff counts, clearly attribute numbers to the correct entity. If the prime has 4 certified staff and a subcontractor has 50+, do NOT claim the prime "has 54 certified practitioners." State each entity's count separately.
- All numbers (user counts, FTE totals, site counts, network enclaves) must be internally consistent. If you list 6 networks in one section, do not say "five networks" in another.
- When referencing certifications, check the expiration date. Do NOT cite a certification as current if its expiration date is before the anticipated contract start. Flag expired certs with [HUMAN INPUT REQUIRED: certification may be expired].

COMPANY IDENTITY:
- The offeror is ${companyProfile.company_name}. All proposal content, key personnel, and commitments are made on behalf of ${companyProfile.company_name}.
- If resume or LOC documents reference a different company name, use ${companyProfile.company_name} in the proposal narrative. Do NOT propagate a different company name from source documents.
${complianceInstructions}
${buildBlockquoteInstruction()}`;

  // ─── Strategy brief — prepended before all data context ─────────────────
  const strategyBlock = buildStrategyBlock(data.strategy, volumeName);

  // ─── Volume-Specific User Prompt ─────────────────────────────────────────
  let volumeBody: string;

  switch (volumeType) {
    case 'technical':
      volumeBody = buildTechnicalPrompt(volumeName, volumeOrder, data, targetWordCount);
      break;
    case 'management':
      volumeBody = buildManagementPrompt(volumeName, volumeOrder, data, targetWordCount);
      break;
    case 'past_performance':
      volumeBody = buildPastPerformancePrompt(volumeName, volumeOrder, data, targetWordCount);
      break;
    case 'cost_price':
      volumeBody = buildCostPricePrompt(volumeName, volumeOrder, data, targetWordCount);
      break;
    default:
      volumeBody = buildDefaultPrompt(volumeName, volumeOrder, data, targetWordCount);
      break;
  }

  // ─── BOE / P2W context blocks — injected after volume body ──────────────
  const volumeTypeStr = volumeType as string;
  const boeBlock = buildBoeContextBlock(data.boeAssessment, volumeTypeStr);
  const p2wBlock = buildP2wRatesBlock(data.p2wAnalysis, volumeTypeStr);

  // ─── SME contributions — appended after volume body, before instructions ──
  const smeBlock = buildSmeContributionsBlock(data.smeContributions, volumeName);

  // Order: strategy → volume body → BOE → P2W → SME (highest authority last)
  const userPrompt = strategyBlock + volumeBody + boeBlock + p2wBlock + smeBlock;

  return {
    systemPrompt,
    userPrompt,
    targetWordCount,
  };
}

/**
 * Assemble the compliance matrix data from Section M evaluation factors.
 *
 * Maps each evaluation factor to the most relevant proposal volume by
 * matching factor name keywords to volume names using the same logic
 * as detectVolumeType().
 *
 * @param extractions - Phase 7 compliance extractions grouped by category
 * @param volumes     - Array of volume names in the generated draft (from draft_volumes)
 * @returns           Array of compliance matrix entries ready for the matrix generator
 */
export function assembleComplianceMatrixData(
  extractions: ComplianceExtractionsByCategory,
  volumes: Array<{ volume_name: string; volume_order: number; status: string }>
): ComplianceMatrixEntry[] {
  // Extract Section M evaluation factors
  const sectionMExtraction = extractions.section_m || [];
  if (sectionMExtraction.length === 0) {
    return [];
  }

  // Find the evaluation_factors field specifically (each extraction row is a separate field)
  const evalFactorsRow = sectionMExtraction.find(row => row.field_name === 'evaluation_factors');
  const evalFactors: SectionMFields['evaluation_factors'] =
    evalFactorsRow
      ? (Array.isArray(evalFactorsRow.field_value)
          ? evalFactorsRow.field_value
          : (evalFactorsRow.field_value as SectionMFields)?.evaluation_factors)
        || []
      : [];

  if (evalFactors.length === 0) {
    return [];
  }

  // Build a lookup from volume type to volume name for mapping
  const volumeTypeToName = new Map<string, string>();
  for (const vol of volumes) {
    const vType = detectVolumeType(vol.volume_name);
    if (!volumeTypeToName.has(vType)) {
      volumeTypeToName.set(vType, vol.volume_name);
    }
    // Always map the original name for direct lookup
    volumeTypeToName.set(vol.volume_name.toLowerCase(), vol.volume_name);
  }

  // Helper: find the best matching volume name for a given factor name
  function mapFactorToVolume(factorName: string): { volumeName: string; sections: string[] } {
    const factorLower = factorName.toLowerCase();

    // Try to match factor name to volume type keywords
    if (factorLower.includes('technical') || factorLower.includes('approach') || factorLower.includes('merit')) {
      const vName = volumeTypeToName.get('technical');
      if (vName) return { volumeName: vName, sections: ['Technical Approach', 'Staffing Plan', 'Risk Management'] };
    }

    if (factorLower.includes('management') || factorLower.includes('staffing') || factorLower.includes('transition') || factorLower.includes('key personnel') || factorLower.includes('personnel')) {
      const vName = volumeTypeToName.get('management');
      if (vName) return { volumeName: vName, sections: ['Organizational Structure', 'Key Personnel', 'Transition Plan', 'Quality Control Plan'] };
    }

    if (factorLower.includes('past performance') || factorLower.includes('past perf') || factorLower.includes('experience') || factorLower.includes('relevance')) {
      const vName = volumeTypeToName.get('past_performance');
      if (vName) return { volumeName: vName, sections: ['Reference 1', 'Reference 2', 'Reference 3', 'Relevance Summary'] };
    }

    if (factorLower.includes('cost') || factorLower.includes('price') || factorLower.includes('pricing')) {
      const vName = volumeTypeToName.get('cost_price');
      if (vName) return { volumeName: vName, sections: ['Basis of Estimate', 'Labor Categories', 'Price Narrative'] };
    }

    // Fallback: use the first volume in the list (usually Technical)
    const firstVolume = volumes.find(v => v.volume_order === 1);
    return {
      volumeName: firstVolume?.volume_name || 'Technical Approach',
      sections: ['Main Content'],
    };
  }

  // Build compliance matrix entries
  const matrixEntries: ComplianceMatrixEntry[] = evalFactors.map(factor => {
    const { volumeName, sections } = mapFactorToVolume(factor.name);

    return {
      factor: factor.name,
      subfactors: factor.subfactors?.map(sf => sf.name) || [],
      weight: factor.weight_description || null,
      mapped_volume: volumeName,
      mapped_sections: sections,
    };
  });

  return matrixEntries;
}

/**
 * Phase 3E — Dual past performance merge.
 *
 * Combines Tier 1 past performance records (from the company profile's
 * `past_performance` table) with Tier 2 RFP-specific overrides (from the
 * data call response's `past_performance` array).
 *
 * Deduplication rule: when a Tier 2 entry shares a `contract_number` with a
 * Tier 1 entry, the Tier 2 version wins (it is more specific to this RFP).
 * Tier 2 entries are placed first (highest priority); non-duplicate Tier 1
 * entries follow.
 *
 * Both arrays are typed as `unknown[]` because at call-site the caller may hold
 * heterogeneous DB rows. Use null-safe casting to read `contract_number`.
 *
 * @param tier1PP - Past performance records from the Tier 1 company profile table
 * @param tier2PP - Past performance entries from the Tier 2 data call response
 * @returns       Merged array: Tier 2 entries first, then non-duplicate Tier 1 entries
 */
export function mergePastPerformance(
  tier1PP: unknown[],
  tier2PP: unknown[]
): unknown[] {
  // Collect contract numbers present in Tier 2 for deduplication
  const tier2ContractNumbers = new Set<unknown>();
  for (const item of tier2PP) {
    const cn = (item as Record<string, unknown>).contract_number;
    if (cn != null) {
      tier2ContractNumbers.add(cn);
    }
  }

  // Keep only Tier 1 records whose contract_number does not appear in Tier 2
  const uniqueTier1 = tier1PP.filter((item) => {
    const cn = (item as Record<string, unknown>).contract_number;
    return cn == null || !tier2ContractNumbers.has(cn);
  });

  // Tier 2 first (RFP-specific, highest priority), then remaining Tier 1
  return [...tier2PP, ...uniqueTier1];
}
