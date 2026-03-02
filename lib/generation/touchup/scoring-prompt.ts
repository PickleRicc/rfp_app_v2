/**
 * Touchup Scoring Prompt Assembler
 * Phase 10: Compliance Scoring (Phase A)
 *
 * Builds the system + user prompt for scoring a first-draft volume against
 * all source data and RFP requirements. The AI outputs structured JSON
 * matching the GapAnalysis interface.
 */

import type { CompanyProfile } from '@/lib/supabase/company-types';
import type { DataCallResponse } from '@/lib/supabase/tier2-types';
import type {
  ComplianceExtractionsByCategory,
  SectionMFields,
  SowPwsFields,
  SectionLFields,
  AdminDataFields,
  PastPerformanceFields,
  KeyPersonnelFields,
  SecurityReqsFields,
  OperationalContextFields,
  TechnologyReqsFields,
} from '@/lib/supabase/compliance-types';
import type { RfpChecklists } from '@/lib/generation/pipeline/soo-checklist-builder';
import { formatChecklistForPrompt } from '@/lib/generation/pipeline/soo-checklist-builder';

export interface DataCallFileRef {
  id: string;
  section: string;
  field_key: string;
  filename: string;
  extracted_text: string | null;
}

export interface ScoringPromptData {
  companyProfile: CompanyProfile;
  dataCallResponse: DataCallResponse;
  extractions: ComplianceExtractionsByCategory;
  personnel: unknown[];
  pastPerformance: unknown[];
  certifications: unknown[];
  contractVehicles: unknown[];
  naicsCodes: unknown[];
  serviceAreaApproaches?: unknown[];
  siteStaffing?: unknown[];
  technologySelections?: unknown[];
  dataCallFiles?: DataCallFileRef[];
  rfpChecklists?: RfpChecklists;
}

export interface ScoringPromptResult {
  systemPrompt: string;
  userPrompt: string;
}

function getExtractionFieldValue<T>(
  extractions: ComplianceExtractionsByCategory,
  category: keyof ComplianceExtractionsByCategory,
  fieldName: string
): T | undefined {
  const rows = extractions[category] || [];
  const row = rows.find(r => r.field_name === fieldName);
  return row?.field_value as T | undefined;
}

function buildSectionMRequirements(extractions: ComplianceExtractionsByCategory): string {
  const evalFactors = getExtractionFieldValue<SectionMFields['evaluation_factors']>(
    extractions, 'section_m', 'evaluation_factors'
  );

  if (!evalFactors || evalFactors.length === 0) {
    return 'No Section M evaluation factors were extracted.';
  }

  const lines: string[] = [];
  evalFactors.forEach((factor, fi) => {
    lines.push(`M.${fi + 1}: ${factor.name}${factor.weight_description ? ` (Weight: ${factor.weight_description})` : ''}`);
    (factor.subfactors || []).forEach((sf, si) => {
      lines.push(`  M.${fi + 1}.${si + 1}: ${sf.name}${sf.description ? ` — ${sf.description}` : ''}`);
    });
  });

  return lines.join('\n');
}

function buildSowPwsRequirements(extractions: ComplianceExtractionsByCategory): string {
  const taskAreas = getExtractionFieldValue<SowPwsFields['task_areas']>(
    extractions, 'sow_pws', 'task_areas'
  );
  const deliverables = getExtractionFieldValue<SowPwsFields['deliverables']>(
    extractions, 'sow_pws', 'deliverables'
  );
  const scopeSummary = getExtractionFieldValue<string>(
    extractions, 'sow_pws', 'scope_summary'
  );

  const parts: string[] = [];
  if (scopeSummary) parts.push(`Scope: ${scopeSummary}`);
  if (taskAreas && taskAreas.length > 0) {
    parts.push('Task Areas:');
    taskAreas.forEach(ta => {
      parts.push(`  - ${ta.name}${ta.description ? `: ${ta.description}` : ''}`);
    });
  }
  if (deliverables && deliverables.length > 0) {
    parts.push('Deliverables:');
    deliverables.forEach(d => {
      parts.push(`  - ${d.name}${d.frequency ? ` (${d.frequency})` : ''}`);
    });
  }

  return parts.length > 0 ? parts.join('\n') : 'No SOW/PWS data extracted.';
}

function buildSectionLRequirements(extractions: ComplianceExtractionsByCategory): string {
  const volumeStructure = getExtractionFieldValue<SectionLFields['volume_structure']>(
    extractions, 'section_l', 'volume_structure'
  );
  const formattingRules = getExtractionFieldValue<SectionLFields['formatting_rules']>(
    extractions, 'section_l', 'formatting_rules'
  );
  const requiredAttachments = getExtractionFieldValue<string[]>(
    extractions, 'section_l', 'required_attachments'
  );

  const parts: string[] = [];
  if (volumeStructure?.volumes) {
    parts.push('Volume Structure:');
    volumeStructure.volumes.forEach(v => {
      parts.push(`  - ${v.name}${v.page_limit ? ` (${v.page_limit} page limit)` : ''}`);
    });
  }
  if (formattingRules) {
    const rules: string[] = [];
    if (formattingRules.font) rules.push(`Font: ${formattingRules.font}`);
    if (formattingRules.font_size) rules.push(`Size: ${formattingRules.font_size}`);
    if (formattingRules.margins) rules.push(`Margins: ${formattingRules.margins}`);
    if (formattingRules.spacing) rules.push(`Spacing: ${formattingRules.spacing}`);
    if (rules.length > 0) parts.push(`Formatting: ${rules.join(', ')}`);
  }
  if (requiredAttachments && requiredAttachments.length > 0) {
    parts.push(`Required Attachments: ${requiredAttachments.join(', ')}`);
  }

  return parts.length > 0 ? parts.join('\n') : 'No Section L data extracted.';
}

function buildSeparateAttachmentsContext(extractions: ComplianceExtractionsByCategory): string {
  const volumeStructure = getExtractionFieldValue<SectionLFields['volume_structure']>(
    extractions, 'section_l', 'volume_structure'
  );
  const requiredAttachments = getExtractionFieldValue<string[]>(
    extractions, 'section_l', 'required_attachments'
  );

  const parts: string[] = ['The following items exist as SEPARATE volumes or attachments in this proposal:'];

  if (volumeStructure?.volumes && volumeStructure.volumes.length > 0) {
    parts.push('\nOther proposal volumes (scored independently):');
    for (const v of volumeStructure.volumes) {
      parts.push(`  - ${v.name}${v.page_limit ? ` (${v.page_limit} pages)` : ''}`);
    }
  }

  if (requiredAttachments && requiredAttachments.length > 0) {
    parts.push('\nRequired separate attachments:');
    for (const att of requiredAttachments) {
      parts.push(`  - ${att}`);
    }
  }

  parts.push('\nDo NOT flag any of the above as "missing content" within the volume being scored.');
  parts.push('Instead, check whether the volume REFERENCES them where appropriate.');

  return parts.join('\n');
}

function buildOperationalContextBlock(extractions: ComplianceExtractionsByCategory): string {
  const opCtxRows = extractions.operational_context || [];
  if (opCtxRows.length === 0) return '';

  const fields: Record<string, unknown> = {};
  for (const row of opCtxRows) {
    if (row.field_value != null) {
      fields[row.field_name] = row.field_value;
    }
  }

  if (Object.keys(fields).length === 0) return '';

  const parts: string[] = ['=== RFP OPERATIONAL CONTEXT (authoritative — extracted from solicitation documents) ==='];
  if (fields.agency_name) parts.push(`Agency: ${fields.agency_name}`);
  if (fields.agency_abbreviation) parts.push(`Abbreviation: ${fields.agency_abbreviation}`);
  if (fields.user_count) parts.push(`User Population: ${fields.user_count}`);
  if (fields.contract_scope_summary) parts.push(`Scope: ${fields.contract_scope_summary}`);
  if (fields.incumbent_contractor) parts.push(`Incumbent: ${fields.incumbent_contractor}`);
  if (Array.isArray(fields.sites) && fields.sites.length > 0) {
    parts.push(`Sites (${(fields.sites as { name: string; location?: string }[]).length}):`);
    for (const site of fields.sites as { name: string; location?: string }[]) {
      parts.push(`  - ${site.name}${site.location ? ` (${site.location})` : ''}`);
    }
  }
  if (Array.isArray(fields.networks) && fields.networks.length > 0) {
    parts.push(`Networks: ${(fields.networks as { name: string }[]).map(n => n.name).join(', ')}`);
  }

  parts.push('');
  parts.push('IMPORTANT: Values in this section are extracted directly from the RFP/SOW documents.');
  parts.push('When the draft volume uses a different value (e.g., different user count, different site name),');
  parts.push('flag it as a data mismatch — the RFP value is authoritative for scope facts.');

  return parts.join('\n');
}

function buildDataCallFilesContext(files: DataCallFileRef[] | undefined): string {
  if (!files || files.length === 0) return '';

  const resumeFiles = files.filter(f => f.field_key.includes('resume') && f.extracted_text);
  const locFiles = files.filter(f => f.field_key.includes('loc') && f.extracted_text);

  if (resumeFiles.length === 0 && locFiles.length === 0) return '';

  const parts: string[] = ['=== KEY PERSONNEL DOCUMENTS ==='];

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

function buildVolumeStructureContext(extractions: ComplianceExtractionsByCategory): string {
  const volumeStructure = getExtractionFieldValue<SectionLFields['volume_structure']>(
    extractions, 'section_l', 'volume_structure'
  );

  if (!volumeStructure?.volumes || volumeStructure.volumes.length === 0) {
    return 'No volume structure extracted. Use the volume name to infer which evaluation factors belong to it.';
  }

  const lines: string[] = ['The RFP defines these volumes (each has its own scope):'];
  volumeStructure.volumes.forEach(v => {
    const parts = [v.name];
    if (v.page_limit) parts.push(`(${v.page_limit} page limit)`);
    lines.push(`  - ${parts.join(' ')}`);
  });
  lines.push('');
  lines.push('Each volume should ONLY be scored against requirements that fall within its scope.');
  lines.push('Requirements from other volumes should be IGNORED when scoring this volume.');

  return lines.join('\n');
}

function buildScorerChecklistBlock(checklists: RfpChecklists | undefined): string {
  if (!checklists) return '';
  const formatted = formatChecklistForPrompt(checklists);
  if (!formatted.trim()) return '';

  const label = checklists.documentStyle === 'soo' ? 'SOO section' :
                checklists.documentStyle === 'pws' ? 'PWS paragraph' :
                checklists.documentStyle === 'sow' ? 'SOW task area' :
                'requirement section';

  return `=== MANDATORY VERIFICATION CHECKLISTS (code-extracted from RFP) ===

${formatted}

CRITICAL SCORING RULES FOR CHECKLIST VERIFICATION:
1. SECTION COVERAGE: Before scoring anything else, check every ${label} in the list above against the draft.
   For each missing ${label}: add a requirements_coverage entry with status "missing" and severity_tier "fatal".
   A missing requirement section is ALWAYS fatal.
   A section containing ONLY [HUMAN INPUT REQUIRED] stubs with fewer than 50 words of actual prose counts as MISSING, not covered.

2. TECHNOLOGY VERIFICATION: For each required technology NOT mentioned in the draft, add a data_verification
   entry with source "fabricated" (by omission). If the draft names a technology NOT on the checklist for the
   same function as a required technology (e.g., VMware when the RFP says Nutanix), this is severity_tier "fatal".

3. CDRL VERIFICATION: If the checklist defines CDRLs and the draft has a different count or different IDs,
   add a data_verification entry with severity_tier "deficiency".

4. PERFORMANCE METRICS: Each metric listed above should be referenced in the draft.
   Missing metrics are severity_tier "weakness".

`;
}

export function assembleScorePrompt(
  volumeName: string,
  draftMarkdown: string,
  data: ScoringPromptData
): ScoringPromptResult {
  const systemPrompt = `You are a government proposal compliance reviewer and quality auditor with 20+ years of experience evaluating federal proposals for Source Selection Evaluation Boards.

Your task is to score a SINGLE proposal volume draft against the requirements RELEVANT TO THAT SPECIFIC VOLUME.

VOLUME SCOPING — THIS IS CRITICAL:
- You are scoring ONE volume of a multi-volume proposal.
- The RFP defines a volume structure where each volume maps to specific evaluation factors.
- ONLY score requirements that belong to the volume being evaluated.
- Do NOT flag requirements from OTHER volumes as missing. For example:
  - If scoring a Technical volume (Factor 1), do NOT flag Management (Factor 2), Past Performance (Factor 3), or Cost/Price (Factor 4) requirements as missing.
  - If scoring a Management volume (Factor 2), do NOT flag Technical, Past Performance, or Cost requirements.
- For SOW/PWS task areas: only flag ones that are relevant to the volume's scope.
- For Section L attachments: only flag attachments that would be included in THIS specific volume.
- The volume name and the Section L volume structure (provided below) tell you exactly which evaluation factors and content belong in this volume.

You must be thorough, precise, and honest. You are checking AI-to-check-AI — your role is a guardrail to catch gaps, fabrications, and missed requirements WITHIN THIS VOLUME'S SCOPE.

SEPARATE ATTACHMENTS AND OTHER PROPOSAL VOLUMES:
- The RFP requires several SEPARATE documents (PWS, QASP, SSP, POA&M, resumes, LOCs) that are NOT part of this volume's body content.
- These items exist as their own volumes in this proposal and will be scored independently.
- Do NOT flag them as "missing content" in this volume.
- Instead, check whether this volume REFERENCES them (e.g., "see Attachment X", "as detailed in the QASP").
- If a relevant attachment is not referenced at all, flag it as "partial" coverage (not "missing").
- Items that are clearly other-volume content (e.g., Past Performance, Cost/Price, Management) must NEVER be flagged as missing from a Technical volume.

SCORING RULES:
- Flag ANY claim that cannot be traced to the provided source data as "fabricated" or "unverifiable"
- Check each Section M evaluation factor/subfactor that BELONGS TO THIS VOLUME for coverage
- Check SOW/PWS task areas that are RELEVANT TO THIS VOLUME'S SCOPE
- Identify [PLACEHOLDER] markers and determine if the data exists in the source to fill them
- Check compliance language patterns: "shall/will" phrasing, active voice, requirement mirroring
- Be specific about WHERE in the draft issues occur (cite section headings)
- Structured data records (past_performance JSON, personnel JSON, certifications JSON) are the AUTHORITATIVE source. When narrative text (corporate_overview, full_description) contradicts structured records on dollar figures, dates, or descriptions, flag the narrative-sourced claim as FABRICATED with the correct value from the structured record.
- Check certification expiration dates against today's date. If a certification is expired or expires before the anticipated contract start date, flag it as a compliance risk, not as a fabrication.
- KEY PERSONNEL NAME CONSISTENCY: The "Key Personnel" array in the bid-specific data is the AUTHORITATIVE source for key personnel names. If the draft uses different names for the same roles, flag each instance as FABRICATED with the correct name from the key_personnel list. This is a critical cross-volume compliance issue.

COMPLIANCE SEVERITY TIERS — assign one tier per finding:
- FATAL: Would cause rejection before evaluation (page limit exceeded, missing required volume, wrong format, non-responsive to mandatory requirement). Auto-caps score at 30.
- DEFICIENCY: Scored as Significant Weakness (missing eval factor section, key personnel name mismatch across volumes, missing SOW task area). -15 to -25.
- WEAKNESS: Scored as Weakness (missing SOO sub-objective, SLA without basis, partial CPARS). -5 to -10.
- ENHANCEMENT: Missed opportunity, no eval impact (omitted favorable CPARS dimension, no win theme). -2 to -5.

FABRICATION CLASSIFICATION — assign one type per data_verification finding:
- INCORRECT: Tool had correct data but used wrong value (e.g., "18 years" when record says 14)
- INCOMPLETE: Tool had data but omitted part of it (e.g., 3 of 5 CPARS dimensions)
- HALLUCINATED: Claim appears in NO source data at all
- If source data confirms the claim is correct, do NOT include it in data_verification at all

PLACEHOLDER CLASSIFICATION — assign one type per placeholder_items finding:
- AUTO_FILLABLE: Source data exists for this field — this is a tool bug
- LEGITIMATE: Genuinely requires human input (UEI, CO contact info, business decisions)

DATA SOURCE HIERARCHY (when sources conflict):
- Requirement facts (user counts, SLAs, site locations, page limits): RFP extraction wins. Look for these in the "RFP OPERATIONAL CONTEXT" and "SOW/PWS" sections.
- Company facts (names, CAGE, certs, PP, rates): Company intake data wins (Tier 1 + Tier 2 sections).
- Cross-references (CDRL IDs, section numbers): Must match RFP exactly.
- Mixed facts (staffing levels, labor categories): Company form, but flag conflict for human review.

SOURCE ATTRIBUTION — CRITICAL:
When flagging a data mismatch, you MUST correctly identify which data source each value comes from:
- "RFP says X" means the value is in the RFP extraction sections (SOW/PWS, Section L, Section M, Operational Context).
- "Company data says X" means the value is in Tier 1 (Company Data) or Tier 2 (Bid-Specific Data) sections.
- Do NOT say "SOW states X" if the value only appears in the company's bid-specific technical_approach or opportunity_details.
- Do NOT confuse the company's self-reported technical approach with RFP requirements.
- If a claim appears in the draft but in NO source data at all (not RFP, not company), classify it as HALLUCINATED.
- In the "correction" field, always specify which source section the correct value comes from (e.g., "Per RFP Operational Context: approximately 3,500 users" or "Per company personnel record: 14 years federal experience").

DEDUPLICATION:
- If the same data issue causes findings in BOTH data_verification AND placeholder_items, include it in ONLY the more severe category (fabrication > placeholder).
- If the same bug manifests in multiple sections, report it ONCE with a locations array in the details. Do NOT create separate entries for each occurrence.
- Assign a root_cause_id to each data_verification finding (short slug like "rodriguez-cissp-expiry" or "missing-cage-code") for grouping.

OUTPUT SIZE RULES — keep JSON compact to avoid truncation:
- In "data_verification": only include claims that are fabricated, unverifiable, or incorrect. Omit verified-correct claims.
- In "compliance_language_issues": limit to the top 15 most impactful issues.
- Keep all string values concise (1-2 sentences max per field).
- Do NOT pretty-print or add unnecessary whitespace inside the JSON.

Output ONLY valid JSON matching the schema below. No markdown, no explanation outside the JSON.`;

  const sectionMReqs = buildSectionMRequirements(data.extractions);
  const sowPwsReqs = buildSowPwsRequirements(data.extractions);
  const sectionLReqs = buildSectionLRequirements(data.extractions);

  const ppReqs = getExtractionFieldValue<PastPerformanceFields>(
    data.extractions, 'past_performance', 'references_required'
  );
  const keyPersonnelReqs = getExtractionFieldValue<KeyPersonnelFields>(
    data.extractions, 'key_personnel', 'positions'
  );
  const securityReqs = getExtractionFieldValue<SecurityReqsFields>(
    data.extractions, 'security_reqs', 'clearance_levels'
  );
  const opContext = getExtractionFieldValue<OperationalContextFields>(
    data.extractions, 'operational_context', 'agency_name'
  );

  const volumeStructure = buildVolumeStructureContext(data.extractions);
  const separateAttachments = buildSeparateAttachmentsContext(data.extractions);
  const personnelDocs = buildDataCallFilesContext(data.dataCallFiles);
  const opContextBlock = buildOperationalContextBlock(data.extractions);

  const userPrompt = `Score the following proposal volume draft for compliance and accuracy.

=== VOLUME BEING SCORED ===
Volume: ${volumeName}

IMPORTANT: Only evaluate requirements relevant to "${volumeName}". Do NOT score requirements that belong to other volumes.

=== SECTION L — VOLUME STRUCTURE (use this to determine what belongs in each volume) ===
${volumeStructure}

=== OTHER PROPOSAL VOLUMES AND ATTACHMENTS ===
${separateAttachments}

=== SECTION M — ALL EVALUATION FACTORS (only score the ones relevant to "${volumeName}") ===
${sectionMReqs}

=== SOW/PWS — TASK AREAS & DELIVERABLES (only score areas relevant to this volume's scope) ===
${sowPwsReqs}

${opContextBlock}

=== SECTION L — SUBMISSION REQUIREMENTS ===
${sectionLReqs}

=== COMPANY DATA (Tier 1 — verify claims against this) ===
Company: ${data.companyProfile.company_name} (${data.companyProfile.legal_name || 'N/A'})
Corporate Overview: ${data.companyProfile.corporate_overview || 'Not provided'}
Core Services: ${data.companyProfile.core_services_summary || 'Not provided'}
Win Themes: ${(data.companyProfile.enterprise_win_themes || []).join('; ') || 'None'}
Key Differentiators: ${data.companyProfile.key_differentiators_summary || 'Not provided'}

Personnel (${data.personnel.length} records):
${JSON.stringify(data.personnel.slice(0, 20), null, 1)}

Past Performance (${data.pastPerformance.length} records):
${JSON.stringify(data.pastPerformance.slice(0, 10), null, 1)}

Certifications (${data.certifications.length} records):
${JSON.stringify(data.certifications, null, 1)}

Contract Vehicles (${data.contractVehicles.length} records):
${JSON.stringify(data.contractVehicles, null, 1)}

NAICS Codes: ${JSON.stringify(data.naicsCodes, null, 1)}

=== BID-SPECIFIC DATA (Tier 2 — verify claims against this) ===
Opportunity Details: ${JSON.stringify(data.dataCallResponse.opportunity_details || {}, null, 1)}
Technical Approach: ${JSON.stringify(data.dataCallResponse.technical_approach || {}, null, 1)}
Key Personnel: ${JSON.stringify(data.dataCallResponse.key_personnel || [], null, 1)}
Past Performance Refs: ${JSON.stringify(data.dataCallResponse.past_performance || [], null, 1)}
Service Area Approaches: ${JSON.stringify(data.serviceAreaApproaches || [], null, 1)}
Site Staffing: ${JSON.stringify(data.siteStaffing || [], null, 1)}
Technology Selections: ${JSON.stringify(data.technologySelections || [], null, 1)}
Compliance Verification: ${JSON.stringify(data.dataCallResponse.compliance_verification || {}, null, 1)}
${personnelDocs ? `\n${personnelDocs}\n` : ''}
${buildScorerChecklistBlock(data.rfpChecklists)}
=== DRAFT CONTENT TO SCORE ===
${draftMarkdown}

=== REQUIRED OUTPUT FORMAT (JSON only — keep compact, no pretty-printing) ===
{
  "compliance_score": <0-100 integer>,
  "requirements_coverage": [
    {"requirement_id": "<e.g., M.1, M.1.2, SOW.TaskArea.1>", "requirement_text": "<brief>", "status": "<covered | partial | missing>", "evidence_location": "<section heading or null>", "gap_description": "<1-2 sentence or null>", "severity_tier": "<fatal | deficiency | weakness | enhancement>"}
  ],
  "data_verification": [
    ONLY include fabricated, unverifiable, or incorrect claims (deduplicated by root_cause_id):
    {"claim": "<specific claim>", "source": "<fabricated | unverifiable>", "verified": false, "correction": "<correct value or null>", "fabrication_type": "<incorrect | incomplete | hallucinated>", "severity_tier": "<fatal | deficiency | weakness | enhancement>", "root_cause_id": "<short-slug>"}
  ],
  "missing_content": [
    {"topic": "<missing topic>", "source_data_available": <true | false>, "recommended_action": "<brief action>"}
  ],
  "placeholder_items": [
    {"placeholder_text": "<the placeholder text>", "data_available": <true | false>, "suggested_fill": "<value or null>", "placeholder_type": "<auto_fillable | legitimate>"}
  ],
  "compliance_language_issues": [
    Top 15 most impactful only:
    {"location": "<section heading>", "issue": "<brief issue>", "suggestion": "<brief fix>"}
  ]
}`;

  return { systemPrompt, userPrompt };
}
