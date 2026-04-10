/**
 * BOE Prompt Assembler
 * Builds prompts for Basis of Estimate generation.
 * Two prompts: per-task-area BOE table rows + overall narrative.
 */

import type { BoePromptData, BoeTableRow, GovStaffingComparison, ParsedPerformancePeriod } from '@/lib/supabase/boe-types';

export interface BoeTablePromptResult {
  systemPrompt: string;
  userPrompt: string;
}

export interface BoeNarrativePromptResult {
  systemPrompt: string;
  userPrompt: string;
}

export function assembleBoeTablePrompt(data: BoePromptData): BoeTablePromptResult {
  const systemPrompt = `You are a senior federal proposal pricing analyst with 15+ years of experience developing Basis of Estimate (BOE) staffing models for government IT contracts. You derive independent, defensible staffing models from SOW/PWS requirements — you never simply restate what the government provides.

Your output must be valid JSON matching the schema provided. Every FTE estimate must cite specific SOW paragraph references and provide written rationale grounded in the task requirements.

RULES:
- Derive estimates from the SOW task requirements, not from any government-provided staffing table
- Use only labor categories from the provided list
- Annual hours per FTE = 1,920 (52 weeks × 40 hours, minus 10 federal holidays)
- Part-time roles (< 0.5 FTE) are acceptable when justified
- Multi-site contracts: FTE scales with site count unless centralized delivery is justified
- Confidence = 'high' when SOW is explicit about scope; 'medium' when implied; 'low' when minimal detail
- Always cite specific paragraph references (e.g., "PWS §3.2.1", "SOW Task 4.2")`;

  const userPrompt = `Analyze this SOW task area and generate BOE staffing rows.

TASK AREA: ${data.serviceAreaCode} — ${data.serviceAreaName}
DESCRIPTION: ${data.description}

SUB-REQUIREMENTS:
${data.subRequirements.map(r => `  ${r.id}: ${r.description}${r.deliverables?.length ? '\n    Deliverables: ' + r.deliverables.join(', ') : ''}`).join('\n')}

STAFFING INDICATORS FROM SOW:
${data.staffingIndicators.length > 0
  ? data.staffingIndicators.map(s => `  ${s.indicator}: ${s.value}${s.source_paragraph ? ` (${s.source_paragraph})` : ''}`).join('\n')
  : '  None explicitly stated — derive from task scope.'}

AVAILABLE LABOR CATEGORIES (use only these):
${data.availableLaborCategories.map(c => `  - ${c}`).join('\n')}

PERFORMANCE PERIODS:
${data.performancePeriods.map(p => `  ${p.label}: ${p.duration_months} months, ${p.annual_hours} annual hours/FTE`).join('\n')}

SITE COUNT: ${data.siteCount}
CONTRACT TYPE: ${data.contractType || 'Not specified'}
SECURITY ENVIRONMENT: ${data.securityEnvironment.length > 0 ? data.securityEnvironment.join(', ') : 'Standard (unclassified)'}

Return a JSON array of BOE rows. Each row must follow this exact schema:
{
  "task_area_code": "${data.serviceAreaCode}",
  "task_area_name": "${data.serviceAreaName}",
  "labor_category": "<one of the available categories above>",
  "fte_count": <number, e.g. 2.0 or 0.5>,
  "annual_hours_per_fte": 1920,
  "total_annual_hours": <fte_count * annual_hours_per_fte>,
  "rationale": "<specific justification citing SOW paragraph>",
  "sow_paragraph_refs": ["<§X.X>"],
  "confidence": "<high|medium|low>"
}

Return ONLY the JSON array — no preamble, no explanation.`;

  return { systemPrompt, userPrompt };
}

export function assembleBoeNarrativePrompt(
  boeRows: BoeTableRow[],
  comparison: GovStaffingComparison[] | null,
  periods: ParsedPerformancePeriod[],
  contractName: string,
  agencyName: string
): BoeNarrativePromptResult {
  const totalFte = boeRows.reduce((sum, r) => sum + r.fte_count, 0);
  const byCategory: Record<string, number> = {};
  for (const row of boeRows) {
    byCategory[row.labor_category] = (byCategory[row.labor_category] || 0) + row.fte_count;
  }

  const systemPrompt = `You are an expert federal proposal writer. Write a Basis of Estimate narrative section suitable for inclusion in a government proposal Cost/Price volume. The narrative must be formal, specific, and defensible — every staffing decision must be grounded in SOW requirements.

RULES:
- Write in third person ("The offeror proposes...", "This BOE reflects...")
- Cite specific SOW paragraph references throughout
- Address the government staffing comparison directly if divergences exist — explain why the independent estimate is more accurate
- Format as markdown with ## section headers
- Do NOT include the BOE table itself — the table will be inserted separately as a formatted exhibit
- Length: 400-600 words`;

  const divergences = comparison?.filter(c => !c.agrees) || [];

  const userPrompt = `Write a Basis of Estimate narrative for this staffing model.

CONTRACT: ${contractName}
AGENCY: ${agencyName}

PERFORMANCE PERIODS:
${periods.map(p => `  ${p.label}: ${p.duration_months} months`).join('\n')}

STAFFING SUMMARY:
Total FTE Proposed: ${totalFte.toFixed(1)}
By Labor Category:
${Object.entries(byCategory).map(([cat, fte]) => `  ${cat}: ${fte.toFixed(1)} FTE`).join('\n')}

SAMPLE ROW RATIONALES (for context):
${boeRows.slice(0, 5).map(r => `  ${r.task_area_name} / ${r.labor_category}: ${r.rationale}`).join('\n')}

${divergences.length > 0 ? `GOVERNMENT STAFFING TABLE DIVERGENCES (must address):
${divergences.map(d => `  ${d.labor_category}: Gov proposed ${d.gov_fte ?? 'N/A'} FTE, independent estimate = ${d.proposed_fte} FTE (${d.delta > 0 ? '+' : ''}${d.delta_pct.toFixed(0)}%). ${d.flag_reason || ''}`).join('\n')}` : 'NOTE: No government staffing table was provided — this is a fully independent estimate.'}

Write the BOE narrative section now. Output markdown only.`;

  return { systemPrompt, userPrompt };
}
