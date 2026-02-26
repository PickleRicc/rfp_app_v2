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

import type { CompanyProfile } from '@/lib/supabase/company-types';
import type { DataCallResponse } from '@/lib/supabase/tier2-types';
import type {
  ComplianceExtractionsByCategory,
  SectionMFields,
  SowPwsFields,
  AdminDataFields,
} from '@/lib/supabase/compliance-types';

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
[PLACEHOLDER: describe what specific information is needed here]

This allows the reviewer to identify exactly what information must be supplied before the proposal is finalized.
Do NOT fabricate specific numbers, dates, contract values, personnel names, or other facts — use placeholders instead.
`;
}

// ===== VOLUME-SPECIFIC PROMPT BUILDERS =====

/**
 * Build user prompt for a Technical volume.
 * Covers technical approach, tools, staffing model, SOW task areas, and Section M technical factors.
 */
function buildTechnicalPrompt(
  volumeName: string,
  volumeOrder: number,
  data: VolumePromptData,
  targetWordCount: number
): string {
  const { companyProfile, dataCallResponse, extractions } = data;
  const { technical_approach, opportunity_details } = dataCallResponse;

  // SOW/PWS task areas from Phase 7 extraction
  const sowPwsExtraction = extractions.sow_pws || [];
  const sowPwsFields: SowPwsFields = sowPwsExtraction.length > 0
    ? (sowPwsExtraction[0].field_value as SowPwsFields) || {}
    : {};
  const taskAreas = sowPwsFields.task_areas || [];

  // Section M evaluation factors (technical-related)
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

  const taskAreaText = taskAreas.length > 0
    ? taskAreas.map(ta => `  - ${ta.name}: ${ta.description || 'See SOW for details'}`).join('\n')
    : '  [PLACEHOLDER: SOW task areas not extracted — review solicitation SOW/PWS section]';

  const technicalFactorText = technicalFactors.length > 0
    ? technicalFactors.map(f => {
        const subfactors = f.subfactors?.map(sf => `    - ${sf.name}: ${sf.description || ''}`).join('\n') || '';
        return `  - ${f.name}${f.weight_description ? ` (${f.weight_description})` : ''}${subfactors ? '\n' + subfactors : ''}`;
      }).join('\n')
    : '  [PLACEHOLDER: Technical evaluation factors not extracted from Section M]';

  return `You are writing the ${volumeName} (Volume ${volumeOrder}) for ${companyProfile.company_name}'s proposal response.

TARGET LENGTH: Approximately ${targetWordCount} words (${data.pageLimit ? `${data.pageLimit} page limit, targeting 87.5% utilization` : 'no page limit specified — use professional judgment'}).

COMPANY TECHNICAL CAPABILITIES:
- Core Services: ${companyProfile.core_services_summary || '[PLACEHOLDER: Core services summary not provided]'}
- Corporate Overview: ${companyProfile.corporate_overview || '[PLACEHOLDER: Corporate overview not provided]'}
- Key Differentiators: ${companyProfile.key_differentiators_summary || '[PLACEHOLDER: Key differentiators not provided]'}

OUR TECHNICAL APPROACH FOR THIS BID:
- Approach Summary: ${technical_approach?.approach_summary || '[PLACEHOLDER: Technical approach summary not provided in data call]'}
- Tools and Platforms: ${technical_approach?.tools_and_platforms || '[PLACEHOLDER: Tools and platforms not specified]'}
- Staffing Model: ${technical_approach?.staffing_model || '[PLACEHOLDER: Staffing model not described]'}
- Key Assumptions: ${technical_approach?.assumptions || '[PLACEHOLDER: Technical assumptions not documented]'}
- Risk Mitigations: ${technical_approach?.risks || '[PLACEHOLDER: Risk areas and mitigations not documented]'}
- Contract Type: ${opportunity_details?.contract_type || '[PLACEHOLDER: Contract type not specified]'}

SOW/PWS TASK AREAS TO ADDRESS:
${taskAreaText}

SECTION M TECHNICAL EVALUATION FACTORS (address each explicitly):
${technicalFactorText}

WRITING INSTRUCTIONS:
1. Open each major section with a win theme callout box (see below).
2. Address EVERY technical evaluation subfactor by mirroring the exact language from Section M.
3. Include a requirements traceability approach — show how your technical approach traces to each SOW task area.
4. Use specific evidence for every capability claim — reference contract experience, tools, or certifications.
5. Structure: Executive Summary → Technical Approach → Staffing Plan → Risk Management → Quality Management.
6. Use action verbs and "shall/will" phrasing throughout. Avoid vague language like "we believe" or "we will try."
7. Every claim must be backed by specific evidence from the company's experience.
${winThemeInstructions}
${buildSparseDataInstruction()}`;
}

/**
 * Build user prompt for a Management volume.
 * Covers organizational structure, key personnel, QCP, transition plan, risk management.
 */
function buildManagementPrompt(
  volumeName: string,
  volumeOrder: number,
  data: VolumePromptData,
  targetWordCount: number
): string {
  const { companyProfile, dataCallResponse } = data;
  const { key_personnel, opportunity_details } = dataCallResponse;

  const winThemeInstructions = buildWinThemeInstructions(
    companyProfile.enterprise_win_themes || []
  );

  const personnelText = key_personnel && key_personnel.length > 0
    ? key_personnel.map((kp, i) => `  ${i + 1}. ${kp.role}: ${kp.name}\n     Qualifications: ${kp.qualifications_summary || '[PLACEHOLDER: Qualifications summary not provided]'}`).join('\n\n')
    : '  [PLACEHOLDER: Key personnel not entered in data call — add proposed individuals with qualifications]';

  const teaming = opportunity_details?.prime_or_sub === 'teaming' && opportunity_details.teaming_partners?.length > 0
    ? `Teaming Partners: ${opportunity_details.teaming_partners.join(', ')}`
    : opportunity_details?.prime_or_sub === 'sub'
    ? `Performing as: Subcontractor`
    : `Performing as: Prime Contractor`;

  return `You are writing the ${volumeName} (Volume ${volumeOrder}) for ${companyProfile.company_name}'s proposal response.

TARGET LENGTH: Approximately ${targetWordCount} words (${data.pageLimit ? `${data.pageLimit} page limit, targeting 87.5% utilization` : 'no page limit specified — use professional judgment'}).

COMPANY MANAGEMENT APPROACH:
- Standard Management Approach: ${companyProfile.standard_management_approach || '[PLACEHOLDER: Standard management approach narrative not provided in Tier 1 profile]'}
- Corporate Overview: ${companyProfile.corporate_overview || '[PLACEHOLDER: Corporate overview not provided]'}
- ${teaming}

KEY PERSONNEL FOR THIS BID:
${personnelText}

WRITING INSTRUCTIONS:
1. Open each major section with a win theme callout box (see below).
2. Structure: Executive Summary → Organizational Structure → Key Personnel Bios → Staffing Plan → Transition Plan (Phase-In/Phase-Out) → Quality Control Plan → Risk Management Plan.
3. For each key personnel entry, include: role, name, relevant qualifications, years of experience, and how their experience directly supports this contract.
4. Transition Plan must address: Day 1 readiness, knowledge transfer process, incumbent staff retention strategy (if applicable), and timeline with milestones.
5. Quality Control Plan must address: QCP methodology, inspection points, corrective action procedures, and continuous improvement process.
6. Use the standard management approach narrative as the foundation — customize it for this specific opportunity.
7. Mirror Section M management evaluation factor language throughout.
${winThemeInstructions}
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
  const { past_performance } = dataCallResponse;

  // Section M past performance relevance criteria from Phase 7 extraction
  const ppExtraction = extractions.past_performance || [];
  const ppFields = ppExtraction.length > 0
    ? (ppExtraction[0].field_value as { recency_requirement?: string; relevance_criteria?: string[]; references_required?: number | string }) || {}
    : {};

  const winThemeInstructions = buildWinThemeInstructions(
    companyProfile.enterprise_win_themes || []
  );

  const refsText = past_performance && past_performance.length > 0
    ? past_performance.map((ref, i) => `  Reference ${i + 1}:
    - Project Name: ${ref.project_name}
    - Client Agency: ${ref.client_agency}
    - Contract Number: ${ref.contract_number}
    - Contract Value: ${ref.contract_value}
    - Period of Performance: ${ref.period_of_performance}
    - Relevance Summary: ${ref.relevance_summary}
    - POC: ${ref.contact_name} (${ref.contact_email}, ${ref.contact_phone})`).join('\n\n')
    : '  [PLACEHOLDER: Past performance references not entered in data call — add at least the required number of references]';

  return `You are writing the ${volumeName} (Volume ${volumeOrder}) for ${companyProfile.company_name}'s proposal response.

TARGET LENGTH: Approximately ${targetWordCount} words (${data.pageLimit ? `${data.pageLimit} page limit, targeting 87.5% utilization` : 'no page limit specified — use professional judgment'}).

RFP PAST PERFORMANCE REQUIREMENTS:
- References Required: ${ppFields.recency_requirement ? `Recency: ${ppFields.recency_requirement}` : '[PLACEHOLDER: Recency requirement not extracted]'}
- Relevance Criteria: ${ppFields.relevance_criteria?.join('; ') || '[PLACEHOLDER: Relevance criteria not extracted from Section M/past performance section]'}
- References Count Required: ${ppFields.references_required || '[PLACEHOLDER: Number of references required not extracted]'}

PAST PERFORMANCE REFERENCES FROM DATA CALL:
${refsText}

WRITING INSTRUCTIONS:
1. Create one section per past performance reference.
2. For each reference, structure the section as:
   a. Contract Overview (agency, contract number, value, period, role)
   b. Relevance to Current Requirement (mirror the RFP's relevance criteria language exactly)
   c. Scope Similarity (compare scope, magnitude, and complexity to the current requirement)
   d. Outcomes and Achievements (specific, measurable results — use numbers when possible)
   e. Client Reference Information
3. Use the recency and relevance definitions from Section M as the standard — justify each reference against those criteria.
4. For each reference, explicitly state why the scope/magnitude/complexity is relevant to this procurement.
5. Avoid generic language — every claim about performance quality must be specific and verifiable.
6. If CPARS ratings are available, reference them directly as evidence of performance quality.
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

  return `You are writing the ${volumeName} (Volume ${volumeOrder}) for ${companyProfile.company_name}'s proposal response.

TARGET LENGTH: Approximately ${targetWordCount} words (${data.pageLimit ? `${data.pageLimit} page limit, targeting 87.5% utilization` : 'no page limit specified — use professional judgment'}).

CONTRACT AND PRICING CONTEXT:
- Contract Type: ${opportunity_details?.contract_type || adminFields.contract_type || '[PLACEHOLDER: Contract type not specified]'}
- Period of Performance: ${adminFields.period_of_performance || '[PLACEHOLDER: Period of performance not extracted]'}
- Set-Aside: ${opportunity_details?.set_aside || '[PLACEHOLDER: Set-aside not specified]'}

CLIN STRUCTURE:
${clinText}

WRITING INSTRUCTIONS:
1. Write a Price Narrative / Basis of Estimate (BOE) — narrative text explaining the pricing methodology, NOT actual prices.
2. Structure: Pricing Approach Overview → Basis of Estimate Methodology → Labor Categories and Rates → Other Direct Costs → Fee/Profit Rationale.
3. Use [PLACEHOLDER: $X] for ALL dollar amounts, hourly rates, and percentages — the user will fill these in when completing the pricing spreadsheet in Microsoft Word.
4. Use [PLACEHOLDER: X hours] for labor hour estimates.
5. Use [PLACEHOLDER: X FTEs] for staffing levels.
6. Explain the rationale for the pricing approach without revealing the actual price — explain HOW prices were derived, not WHAT they are.
7. Reference the contract type (${opportunity_details?.contract_type || adminFields.contract_type || 'specified type'}) and explain how it influences the pricing structure.
8. Include a section on price reasonableness and how the company ensures competitive, fair pricing.
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

  return `You are writing the ${volumeName} (Volume ${volumeOrder}) for ${companyProfile.company_name}'s proposal response.

TARGET LENGTH: Approximately ${targetWordCount} words (${data.pageLimit ? `${data.pageLimit} page limit, targeting 87.5% utilization` : 'no page limit specified — use professional judgment'}).

AVAILABLE COMPANY DATA:
- Company Name: ${companyProfile.company_name}
- Core Services: ${companyProfile.core_services_summary || '[PLACEHOLDER: Core services not provided]'}
- Corporate Overview: ${companyProfile.corporate_overview || '[PLACEHOLDER: Corporate overview not provided]'}
- Key Differentiators: ${companyProfile.key_differentiators_summary || '[PLACEHOLDER: Key differentiators not provided]'}
- Standard Management Approach: ${companyProfile.standard_management_approach || '[PLACEHOLDER: Management approach not provided]'}

BID CONTEXT:
- Contract Type: ${opportunity_details?.contract_type || '[PLACEHOLDER: Contract type not specified]'}
- Set-Aside: ${opportunity_details?.set_aside || '[PLACEHOLDER: Set-aside not specified]'}
- Bid Role: ${opportunity_details?.prime_or_sub || '[PLACEHOLDER: Prime/sub role not specified]'}
- Technical Approach Summary: ${technical_approach?.approach_summary || '[PLACEHOLDER: Technical approach not provided]'}

WRITING INSTRUCTIONS:
1. Treat "${volumeName}" as the primary subject of this volume.
2. Follow all Section L instructions for this volume — address any explicit requirements verbatim.
3. Structure the content to directly address the RFP's requirements for this volume.
4. Apply formal government proposal writing style throughout.
5. Open each major section with a win theme callout box.
${winThemeInstructions}
${buildSparseDataInstruction()}`;
}

// ===== MAIN EXPORTED FUNCTIONS =====

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
  const systemPrompt = `You are an expert government proposal writer with 20+ years of experience winning federal contracts. You write in a formal, compliance-focused style using action verbs and "shall/will" phrasing. Every claim is backed by specific evidence. You mirror the evaluation criteria language from the RFP. You are writing for ${companyProfile.company_name} (${companyProfile.legal_name || companyProfile.company_name}).

Your proposals are indistinguishable from those written by top-tier government proposal shops. You understand the Federal Acquisition Regulation (FAR), color team reviews, and the SHIPLEY proposal development methodology. Your writing is persuasive, compliance-focused, and evaluator-friendly — structured so that a government Source Selection Board can easily score your proposal against the evaluation criteria.

Key rules:
1. Never fabricate specific facts — use [PLACEHOLDER: description] for any missing data
2. Mirror Section M evaluation factor language throughout the volume
3. Use active voice and action verbs at the start of sentences
4. Quantify claims whenever possible (percentages, years, dollar values, counts)
5. Structure content so evaluators can quickly find evidence for each criterion`;

  // ─── Volume-Specific User Prompt ─────────────────────────────────────────
  let userPrompt: string;

  switch (volumeType) {
    case 'technical':
      userPrompt = buildTechnicalPrompt(volumeName, volumeOrder, data, targetWordCount);
      break;
    case 'management':
      userPrompt = buildManagementPrompt(volumeName, volumeOrder, data, targetWordCount);
      break;
    case 'past_performance':
      userPrompt = buildPastPerformancePrompt(volumeName, volumeOrder, data, targetWordCount);
      break;
    case 'cost_price':
      userPrompt = buildCostPricePrompt(volumeName, volumeOrder, data, targetWordCount);
      break;
    default:
      userPrompt = buildDefaultPrompt(volumeName, volumeOrder, data, targetWordCount);
      break;
  }

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
