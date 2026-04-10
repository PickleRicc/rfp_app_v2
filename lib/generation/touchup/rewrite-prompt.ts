/**
 * Touchup Rewrite Prompt Assembler
 * Phase 10: Full Volume Rewrite (Phase B)
 *
 * Builds the system + user prompt for rewriting an entire first-draft volume
 * to fill all gaps identified by Phase A scoring.
 */

import type { CompanyProfile } from '@/lib/supabase/company-types';
import type { DataCallResponse } from '@/lib/supabase/tier2-types';
import type {
  ComplianceExtractionsByCategory,
  SectionMFields,
  SowPwsFields,
  SecurityReqsFields,
} from '@/lib/supabase/compliance-types';
import type { GapAnalysis } from '@/lib/supabase/touchup-types';
import type { RfpChecklists } from '@/lib/generation/pipeline/soo-checklist-builder';
import { formatChecklistForPrompt } from '@/lib/generation/pipeline/soo-checklist-builder';
import type { SmeContribution } from '@/lib/supabase/tier2-types';
import type { SolicitationStrategy } from '@/lib/supabase/strategy-types';

export interface RewritePromptData {
  companyProfile: CompanyProfile;
  dataCallResponse: DataCallResponse;
  extractions: ComplianceExtractionsByCategory;
  personnel: unknown[];
  pastPerformance: unknown[];
  certifications: unknown[];
  contractVehicles: unknown[];
  naicsCodes: unknown[];
  pageLimit: number | null;
  serviceAreaApproaches?: unknown[];
  siteStaffing?: unknown[];
  technologySelections?: unknown[];
  dataCallFiles?: Array<{
    id: string;
    section: string;
    field_key: string;
    filename: string;
    extracted_text: string | null;
  }>;
  rfpChecklists?: RfpChecklists;
  strategy?: SolicitationStrategy | null;
  smeContributions?: SmeContribution[];
}

export interface RewritePromptResult {
  systemPrompt: string;
  userPrompt: string;
  targetWordCount: number;
}

const WORDS_PER_PAGE = 250;
const PAGE_UTILIZATION = 0.875;
const DEFAULT_TARGET = 2500;

function getExtractionFieldValue<T>(
  extractions: ComplianceExtractionsByCategory,
  category: keyof ComplianceExtractionsByCategory,
  fieldName: string
): T | undefined {
  const rows = extractions[category] || [];
  const row = rows.find(r => r.field_name === fieldName);
  return row?.field_value as T | undefined;
}

function buildPageLimitInstruction(targetWordCount: number, pageLimit: number | null): string {
  if (pageLimit) {
    const maxWords = pageLimit * WORDS_PER_PAGE;
    return `HARD PAGE LIMIT: STRICT ${pageLimit}-page limit. Government page limits are absolute.
- MAXIMUM: ${maxWords} words (${pageLimit} pages)
- TARGET: ${targetWordCount} words (87.5% utilization)
- Do NOT exceed ${maxWords} words. Prioritize highest-weighted evaluation factors if space is tight.`;
  }
  return `TARGET LENGTH: Approximately ${targetWordCount} words.`;
}

const TIER_PRIORITY: Record<string, number> = { fatal: 0, deficiency: 1, weakness: 2, enhancement: 3 };
const TIER_LABEL: Record<string, string> = { fatal: 'FATAL', deficiency: 'DEFICIENCY', weakness: 'WEAKNESS', enhancement: 'ENHANCEMENT' };

function tierTag(tier?: string): string {
  if (!tier) return '';
  return ` [${TIER_LABEL[tier] || tier.toUpperCase()}]`;
}

function sortByTier<T extends { severity_tier?: string }>(items: T[]): T[] {
  return [...items].sort((a, b) =>
    (TIER_PRIORITY[a.severity_tier || 'enhancement'] ?? 9) - (TIER_PRIORITY[b.severity_tier || 'enhancement'] ?? 9)
  );
}

function formatGapSummary(gapAnalysis: GapAnalysis, complianceScore?: number): string {
  const parts: string[] = [];

  if (complianceScore !== undefined) {
    parts.push(`CURRENT SCORE: ${complianceScore}/100`);
    parts.push(`TARGET: 80+ — prioritize FATAL and DEFICIENCY gaps first, then WEAKNESS, then ENHANCEMENT.\n`);
  }

  const missing = sortByTier(gapAnalysis.requirements_coverage.filter(r => r.status === 'missing'));
  const partial = sortByTier(gapAnalysis.requirements_coverage.filter(r => r.status === 'partial'));
  if (missing.length > 0) {
    parts.push('MISSING REQUIREMENTS (must be fully addressed in rewrite):');
    missing.forEach(r => {
      parts.push(`  - [${r.requirement_id}]${tierTag(r.severity_tier)} ${r.requirement_text}`);
      if (r.gap_description) parts.push(`    Gap: ${r.gap_description}`);
    });
  }
  if (partial.length > 0) {
    parts.push('\nPARTIALLY COVERED REQUIREMENTS (must be strengthened):');
    partial.forEach(r => {
      parts.push(`  - [${r.requirement_id}]${tierTag(r.severity_tier)} ${r.requirement_text}`);
      if (r.gap_description) parts.push(`    Gap: ${r.gap_description}`);
    });
  }

  const fabricated = sortByTier(gapAnalysis.data_verification.filter(d => d.source === 'fabricated'));
  if (fabricated.length > 0) {
    parts.push('\nFABRICATED CLAIMS (must be removed or corrected):');
    fabricated.forEach(d => {
      parts.push(`  - ${tierTag(d.severity_tier)} Claim: "${d.claim}"`);
      if (d.correction) parts.push(`    Correction: ${d.correction}`);
    });
  }

  const unverified = gapAnalysis.data_verification.filter(d => !d.verified && d.source !== 'fabricated');
  if (unverified.length > 0) {
    parts.push('\nUNVERIFIED CLAIMS (replace with [HUMAN INPUT REQUIRED] if no source data):');
    unverified.forEach(d => {
      parts.push(`  - Claim: "${d.claim}" (source: ${d.source})`);
    });
  }

  if (gapAnalysis.missing_content.length > 0) {
    parts.push('\nMISSING CONTENT (must be added):');
    gapAnalysis.missing_content.forEach(m => {
      parts.push(`  - ${m.topic}: ${m.recommended_action}`);
      parts.push(`    Data available: ${m.source_data_available ? 'YES — use the source data provided' : 'NO — use [HUMAN INPUT REQUIRED]'}`);
    });
  }

  const fillable = gapAnalysis.placeholder_items.filter(p => p.data_available);
  const unfillable = gapAnalysis.placeholder_items.filter(p => !p.data_available);
  if (fillable.length > 0) {
    parts.push('\nPLACEHOLDERS TO FILL (data exists — replace with actual values):');
    fillable.forEach(p => {
      parts.push(`  - ${p.placeholder_text}`);
      if (p.suggested_fill) parts.push(`    Fill with: ${p.suggested_fill}`);
    });
  }
  if (unfillable.length > 0) {
    parts.push('\nPLACEHOLDERS WITHOUT DATA (convert to [HUMAN INPUT REQUIRED]):');
    unfillable.forEach(p => {
      parts.push(`  - ${p.placeholder_text}`);
    });
  }

  if (gapAnalysis.compliance_language_issues.length > 0) {
    parts.push('\nCOMPLIANCE LANGUAGE ISSUES (fix in rewrite):');
    gapAnalysis.compliance_language_issues.forEach(c => {
      parts.push(`  - ${c.location}: ${c.issue}`);
      parts.push(`    Fix: ${c.suggestion}`);
    });
  }

  return parts.join('\n');
}

function buildRewritePersonnelDocs(
  files: RewritePromptData['dataCallFiles']
): string {
  if (!files || files.length === 0) return '';

  const resumeFiles = files.filter(f => f.field_key.includes('resume') && f.extracted_text);
  const locFiles = files.filter(f => f.field_key.includes('loc') && f.extracted_text);

  if (resumeFiles.length === 0 && locFiles.length === 0) return '';

  const parts: string[] = ['\n=== KEY PERSONNEL DOCUMENTS ==='];
  for (const f of resumeFiles) {
    parts.push(`\n--- Resume: ${f.filename} ---`);
    parts.push(f.extracted_text!);
  }
  for (const f of locFiles) {
    parts.push(`\n--- Letter of Commitment: ${f.filename} ---`);
    parts.push(f.extracted_text!);
  }
  return parts.join('\n');
}

function buildRewriterChecklistBlock(checklists: RfpChecklists | undefined): string {
  if (!checklists) return '';
  const formatted = formatChecklistForPrompt(checklists);
  if (!formatted.trim()) return '';

  const label = checklists.documentStyle === 'soo' ? 'SOO section' :
                checklists.documentStyle === 'pws' ? 'PWS paragraph' :
                checklists.documentStyle === 'sow' ? 'SOW task area' :
                'requirement section';
  const docLabel = checklists.documentStyle.toUpperCase() || 'RFP';

  return `=== MANDATORY REQUIREMENT CHECKLISTS (code-extracted from ${docLabel}) ===

${formatted}

PRE-REWRITE VERIFICATION (do this BEFORE rewriting):
1. SECTION CHECK: Verify the draft has a section for every ${label} listed above. If ANY are missing, ADD them with full content — do not just add stubs.
2. TECHNOLOGY CHECK: Verify every required technology appears in the draft. If the draft names a wrong technology (e.g., VMware when the ${docLabel} says Nutanix), REPLACE it with the correct technology.
3. CDRL CHECK: If the draft has a CDRL or deliverable table, REPLACE it with the ${docLabel}'s actual IDs and titles listed above. Do NOT just flag it — rewrite the table.
4. METRICS CHECK: If performance metrics are listed above, reference the exact numbers. Do NOT use [HUMAN INPUT REQUIRED] for metrics that appear in the checklist.
5. STUB FILLING: If any section contains only [HUMAN INPUT REQUIRED] tags or placeholder stubs, WRITE actual content using the source data provided. Stubs are NOT acceptable in the final output when source data exists.
`;
}

function buildConditionalInjections(
  extractions: ComplianceExtractionsByCategory,
  checklists: RfpChecklists | undefined
): string {
  const parts: string[] = [];

  const secReqRows = extractions.security_reqs || [];
  const dd254 = getExtractionFieldValue<boolean | string>(extractions, 'security_reqs', 'dd254_required');
  const clearanceLevels = getExtractionFieldValue<string[]>(extractions, 'security_reqs', 'clearance_levels');

  if (dd254 || (clearanceLevels && clearanceLevels.length > 0)) {
    const docLabel = checklists?.documentStyle?.toUpperCase() || 'RFP';
    parts.push(`CLASSIFIED SUPPORT REQUIREMENTS (from ${docLabel} security requirements):`);
    if (dd254) parts.push(`- DD254 required: ${dd254}`);
    if (clearanceLevels) parts.push(`- Clearance levels: ${clearanceLevels.join(', ')}`);
    parts.push('These MUST be explicitly addressed in the appropriate sections.\n');
  }

  const sowPwsRows = extractions.sow_pws || [];
  const modernizationGoals = getExtractionFieldValue<string[]>(extractions, 'sow_pws', 'modernization_goals');
  if (modernizationGoals && modernizationGoals.length > 0) {
    const docLabel = checklists?.documentStyle?.toUpperCase() || 'RFP';
    parts.push(`STRATEGIC/MODERNIZATION GOALS (from ${docLabel}):`);
    modernizationGoals.forEach((g, i) => parts.push(`  ${i + 1}. ${g}`));
    parts.push('Each goal MUST be addressed by number in the relevant section.\n');
  }

  if (checklists && checklists.sections.some(
    s => /3\.6\.\d/.test(s.sectionId) ||
      s.sectionName.toLowerCase().includes('operational') ||
      s.sectionName.toLowerCase().includes('non-operational')
  )) {
    const docLabel = checklists.documentStyle.toUpperCase() || 'RFP';
    parts.push(`PROJECT TYPE DISTINCTION:`);
    parts.push(`The ${docLabel} defines distinct project categories. Acknowledge each category and describe your approach for each type separately.\n`);
  }

  return parts.length > 0 ? '\n' + parts.join('\n') : '';
}

function buildRewriteStrategyBlock(strategy: SolicitationStrategy | null | undefined, volumeName: string): string {
  if (!strategy) return '';

  const parts: string[] = ['=== PROPOSAL STRATEGY (apply throughout rewrite) ==='];

  if (strategy.win_theme_priorities.length > 0) {
    parts.push('Win Theme Priorities (in order):');
    strategy.win_theme_priorities.forEach((t, i) => parts.push(`  ${i + 1}. ${t}`));
  }

  parts.push(`Risk Posture: ${strategy.risk_posture.toUpperCase()}`);

  const volStrategy = strategy.volume_strategies.find(
    v => v.volume_name.toLowerCase() === volumeName.toLowerCase()
  );
  if (volStrategy) {
    if (volStrategy.approach_notes) {
      parts.push(`\nVolume Approach Notes:\n${volStrategy.approach_notes}`);
    }
    if (volStrategy.emphasis_areas.length > 0) {
      parts.push(`Emphasis Areas: ${volStrategy.emphasis_areas.join(', ')}`);
    }
  }

  if (strategy.agency_intel) {
    parts.push(`\nAgency Intel:\n${strategy.agency_intel}`);
  }
  if (strategy.competitive_notes) {
    parts.push(`\nCompetitive Notes:\n${strategy.competitive_notes}`);
  }

  return parts.join('\n') + '\n\n';
}

function buildRewriteSmeBlock(smeContributions: SmeContribution[] | undefined, volumeName: string): string {
  if (!smeContributions || smeContributions.length === 0) return '';

  const volumeContributions = smeContributions.filter(
    c => c.approved && c.volume_name.toLowerCase() === volumeName.toLowerCase()
  );
  if (volumeContributions.length === 0) return '';

  const parts: string[] = ['\n=== SME CONTRIBUTIONS (authoritative — use verbatim where possible) ==='];
  volumeContributions.forEach(c => {
    parts.push(`\n[${c.topic}] — by ${c.contributor_name}${c.contributor_title ? `, ${c.contributor_title}` : ''}:`);
    parts.push(c.content);
  });
  return parts.join('\n');
}

export function assembleTouchupPrompt(
  volumeName: string,
  draftMarkdown: string,
  gapAnalysis: GapAnalysis,
  data: RewritePromptData,
  complianceScore?: number
): RewritePromptResult {
  const targetWordCount = data.pageLimit
    ? Math.round(data.pageLimit * WORDS_PER_PAGE * PAGE_UTILIZATION)
    : DEFAULT_TARGET;

  const evalFactors = getExtractionFieldValue<SectionMFields['evaluation_factors']>(
    data.extractions, 'section_m', 'evaluation_factors'
  );

  const evalFactorText = (evalFactors || []).map((f, i) => {
    const subs = (f.subfactors || []).map((s, j) => `    M.${i + 1}.${j + 1}: ${s.name}`).join('\n');
    return `  M.${i + 1}: ${f.name}${f.weight_description ? ` (${f.weight_description})` : ''}${subs ? '\n' + subs : ''}`;
  }).join('\n');

  const systemPrompt = `You are an expert government proposal writer with 20+ years of experience winning federal contracts. You write in a formal, compliance-focused style using action verbs and "shall/will" phrasing. Every claim is backed by specific evidence. You mirror the evaluation criteria language from the RFP.

You are writing for ${data.companyProfile.company_name} (${data.companyProfile.legal_name || data.companyProfile.company_name}).

You are performing a TOUCHUP REWRITE of a first-draft proposal volume. A compliance audit has identified specific gaps, fabrications, and weaknesses. Your job is to produce a COMPLETE rewritten volume that:

1. Fills EVERY gap identified in the compliance audit — no exceptions
2. Removes or corrects ALL fabricated claims — replace with verified data or [HUMAN INPUT REQUIRED]
3. Replaces [PLACEHOLDER] markers with actual data where source data is provided
4. Converts remaining unfillable placeholders to [HUMAN INPUT REQUIRED: specific description]
5. Preserves the overall structure, section ordering, and heading hierarchy of the first draft
6. REGRESSION PREVENTION: Do NOT remove, weaken, shorten, or generalize any existing strong sections. If a section is not flagged in the compliance audit, leave it substantially intact. The regression guard will compare your output section-by-section against the previous version and revert any section that regressed.
7. Uses formal compliance language: active voice, "shall/will" phrasing, quantified claims
8. Mirrors the EXACT language from Section M evaluation factors throughout
9. PRIORITIZE BY SEVERITY: Address FATAL and DEFICIENCY findings first (these are the biggest score drags). Then WEAKNESS. Only address ENHANCEMENT findings if space permits without weakening existing content.

CRITICAL RULES:
- DIAGRAM REFERENCES: If the first draft contains figure references like "[Figure: ...]" or "See Figure X", preserve them in the same locations in the rewrite. These mark where diagrams will be inserted in the final document. Do not remove, relocate, or add new figure references.
- Never fabricate specific facts — if data is not in the source materials, use [HUMAN INPUT REQUIRED: description]
- [HUMAN INPUT REQUIRED] is distinct from [PLACEHOLDER] — it means the AI has exhausted all source data
- Mirror Section M evaluation factor language word-for-word where possible
- Every claim must be traceable to the provided source data
- Output the COMPLETE volume as markdown (# for H1, ## for H2, etc.)
- Do NOT invent SLA metrics, resolution times, uptime percentages, or availability targets unless in source data
- Do NOT name tools or software not listed in the source data (tools_and_platforms, technology_selections, service_area_approaches)
- Do NOT name incumbent contractors unless provided in source data
- Do NOT fabricate CDRL turnaround times, deployment SLAs, or numeric commitments not in source data

DATA SOURCE PRIORITY:
- Prefer structured records (personnel JSON, past_performance JSON, certifications JSON) over narrative text
- If a narrative value (e.g., corporate overview, full_description) contradicts a structured record on dollar figures, dates, or descriptions, USE the structured record
- When describing Key Personnel, reference actual resume content and LOC documents if provided below

SEPARATE ATTACHMENTS:
- Do NOT generate inline content for separate evaluated attachments (PWS, QASP, SSP, POA&M, resumes, LOCs)
- Instead, add references where the volume should acknowledge them (e.g., "See Attachment X — Contractor PWS")
- These documents exist as separate volumes and will be generated/scored independently

CONSISTENCY:
- Use the exact user count from the SOW throughout (do not mix different numbers in different sections)
- Use strictly sequential section numbering — never duplicate a section number

KEY PERSONNEL NAME AUTHORITY:
- The "Tier 2 Key Personnel" list below is the SINGLE SOURCE OF TRUTH for key personnel names.
- Use ONLY those names for lead roles (Program Manager, Lead Systems Engineer, Cybersecurity Lead, etc.)
- Do NOT use names from resume documents or personnel database records if they differ from the key_personnel list.
- This rule exists because evaluators read all volumes as a single package — different names across volumes is a compliance failure.`;

  const pageLimitInstr = buildPageLimitInstruction(targetWordCount, data.pageLimit);
  const gapSummary = formatGapSummary(gapAnalysis, complianceScore);

  const strategyBlock = buildRewriteStrategyBlock(data.strategy, volumeName);
  const smeBlock = buildRewriteSmeBlock(data.smeContributions, volumeName);

  const userPrompt = `Rewrite this proposal volume to fill all compliance gaps.

${strategyBlock}=== VOLUME ===
${volumeName}

=== PAGE LIMIT ===
${pageLimitInstr}

=== SECTION M EVALUATION FACTORS (mirror this language) ===
${evalFactorText || 'No evaluation factors extracted.'}

=== COMPLIANCE AUDIT — ALL GAPS TO FIX ===
${gapSummary}

=== SOURCE DATA FOR GAP FILLING ===

Company: ${data.companyProfile.company_name}
Corporate Overview: ${data.companyProfile.corporate_overview || 'Not provided'}
Core Services: ${data.companyProfile.core_services_summary || 'Not provided'}
Management Approach: ${data.companyProfile.standard_management_approach || 'Not provided'}
Win Themes: ${(data.companyProfile.enterprise_win_themes || []).join('; ') || 'None'}
Key Differentiators: ${data.companyProfile.key_differentiators_summary || 'Not provided'}

Personnel Records (${data.personnel.length}):
${JSON.stringify(data.personnel.slice(0, 20), null, 1)}

Past Performance (${data.pastPerformance.length}):
${JSON.stringify(data.pastPerformance.slice(0, 10), null, 1)}

Certifications: ${JSON.stringify(data.certifications, null, 1)}
Contract Vehicles: ${JSON.stringify(data.contractVehicles, null, 1)}
NAICS Codes: ${JSON.stringify(data.naicsCodes, null, 1)}

Tier 2 Technical Approach: ${JSON.stringify(data.dataCallResponse.technical_approach || {}, null, 1)}
Tier 2 Key Personnel: ${JSON.stringify(data.dataCallResponse.key_personnel || [], null, 1)}
Tier 2 Past Performance: ${JSON.stringify(data.dataCallResponse.past_performance || [], null, 1)}
Tier 2 Opportunity Details: ${JSON.stringify(data.dataCallResponse.opportunity_details || {}, null, 1)}
Service Area Approaches: ${JSON.stringify(data.serviceAreaApproaches || [], null, 1)}
Site Staffing: ${JSON.stringify(data.siteStaffing || [], null, 1)}
Technology Selections: ${JSON.stringify(data.technologySelections || [], null, 1)}
Compliance Verification: ${JSON.stringify(data.dataCallResponse.compliance_verification || {}, null, 1)}
${buildRewritePersonnelDocs(data.dataCallFiles)}${smeBlock}
${buildRewriterChecklistBlock(data.rfpChecklists)}${buildConditionalInjections(data.extractions, data.rfpChecklists)}
=== FIRST DRAFT TO REWRITE ===
${draftMarkdown}

=== INSTRUCTIONS ===
Produce the COMPLETE rewritten volume as markdown. Include ALL sections from the first draft.
Address EVERY gap listed above. Do not skip any.
If requirement checklists are provided above, ensure every listed section has substantive coverage.
Output ONLY the rewritten volume content — no preamble, no explanation.`;

  return { systemPrompt, userPrompt, targetWordCount };
}
