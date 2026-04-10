/**
 * BOE Generator — Inngest Function
 *
 * Triggered by: 'boe.generate'
 * Event payload: { solicitationId: string; companyId: string }
 *
 * Generates a Basis of Estimate (BOE) for the Cost/Price volume:
 * 1. fetch-data                 — Load compliance extractions, data call, company, solicitation
 * 2. parse-performance-periods  — Parse PoP structure into typed periods
 * 3. generate-boe-table         — Per-service-area Claude call → BoeTableRow[]
 * 4. generate-government-comparison — Compare to gov staffing table if present
 * 5. generate-narrative         — Claude narrative markdown
 * 6. build-diagram-specs        — Table spec, bar chart, gantt
 * 7. finalize                   — Upsert boe_assessments with completed status
 */

import { inngest } from '../client';
import { getServerClient } from '@/lib/supabase/client';
import { anthropic, MODEL } from '@/lib/anthropic/client';
import { parseClaudeJSON } from '@/lib/anthropic/json-extractor';
import {
  assembleBoeTablePrompt,
  assembleBoeNarrativePrompt,
} from '@/lib/generation/boe/prompt-assembler';
import type {
  BoeTableRow,
  GovStaffingComparison,
  ParsedPerformancePeriod,
  BoePromptData,
} from '@/lib/supabase/boe-types';
import type {
  ComplianceExtractionsByCategory,
  ExtractionCategory,
} from '@/lib/supabase/compliance-types';
import { logPipelineEvent } from '@/lib/logging/pipeline-logger';

// ===== CONSTANTS =====

/** BOE-relevant extraction categories */
const BOE_EXTRACTION_CATEGORIES: ExtractionCategory[] = [
  'sow_pws',
  'cost_price',
  'admin_data',
  'operational_context',
  'key_personnel',
  'security_reqs',
];

/** All categories (needed to initialise the by-category map) */
const ALL_EXTRACTION_CATEGORIES: ExtractionCategory[] = [
  'section_l',
  'section_m',
  'admin_data',
  'rating_scales',
  'sow_pws',
  'cost_price',
  'past_performance',
  'key_personnel',
  'security_reqs',
  'operational_context',
  'technology_reqs',
];

/** Standard federal IT labor categories used as a fallback */
const STANDARD_FEDERAL_IT_LABOR_CATEGORIES = [
  'Program Manager',
  'Senior Systems Engineer',
  'Systems Administrator',
  'Network Engineer',
  'Cybersecurity Analyst',
  'Help Desk Technician',
  'Business Analyst',
  'Quality Assurance Analyst',
  'Technical Writer',
  'Database Administrator',
];

// ===== INNGEST FUNCTION =====

export const boeGenerator = inngest.createFunction(
  { id: 'boe-generator' },
  { event: 'boe.generate' },
  async ({ event, step }) => {
    const { solicitationId, companyId } = event.data as {
      solicitationId: string;
      companyId: string;
    };

    // ─── Step 1: fetch-data ───────────────────────────────────────────────────
    const fetchedData = await step.run('fetch-data', async () => {
      const supabase = getServerClient();

      try {
        // Upsert boe_assessments to 'generating' (create if not exists)
        await supabase
          .from('boe_assessments')
          .upsert(
            {
              solicitation_id: solicitationId,
              company_id: companyId,
              status: 'generating',
              error_message: null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'solicitation_id,company_id' }
          );

        // Load compliance extractions for the BOE-relevant categories
        const { data: extractionRows } = await supabase
          .from('compliance_extractions')
          .select('category, field_name, field_value')
          .eq('solicitation_id', solicitationId)
          .in('category', BOE_EXTRACTION_CATEGORIES);

        // Build extractionsByCategory map
        const extractionsByCategory = {} as ComplianceExtractionsByCategory;
        for (const cat of ALL_EXTRACTION_CATEGORIES) {
          extractionsByCategory[cat] = [];
        }
        for (const row of extractionRows ?? []) {
          const cat = row.category as ExtractionCategory;
          if (extractionsByCategory[cat]) {
            extractionsByCategory[cat].push(row as never);
          }
        }

        // Load data_call_responses for site_staffing and service_area_approaches
        const { data: dataCallResponse } = await supabase
          .from('data_call_responses')
          .select('id, site_staffing, service_area_approaches')
          .eq('solicitation_id', solicitationId)
          .eq('company_id', companyId)
          .maybeSingle();

        // Load company profile for company name
        const { data: companyProfile } = await supabase
          .from('company_profiles')
          .select('id, company_name')
          .eq('id', companyId)
          .maybeSingle();

        // Load personnel for proposed roles (available labor categories)
        const { data: personnel } = await supabase
          .from('personnel')
          .select('id, full_name, proposed_roles')
          .eq('company_id', companyId);

        // Load solicitation for title and agency name
        const { data: solicitation } = await supabase
          .from('solicitations')
          .select('id, title, agency_name')
          .eq('id', solicitationId)
          .maybeSingle();

        return {
          extractionsByCategory,
          dataCallResponse: dataCallResponse ?? null,
          companyProfile: companyProfile ?? null,
          personnel: personnel ?? [],
          solicitation: solicitation ?? null,
        };
      } catch (err) {
        // Mark as failed then rethrow
        await supabase
          .from('boe_assessments')
          .upsert(
            {
              solicitation_id: solicitationId,
              company_id: companyId,
              status: 'failed',
              error_message: err instanceof Error ? err.message : String(err),
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'solicitation_id,company_id' }
          );
        throw err;
      }
    });

    const { extractionsByCategory, dataCallResponse, companyProfile, personnel, solicitation } = fetchedData;

    // ─── Step 2: parse-performance-periods ───────────────────────────────────
    const performancePeriods = await step.run('parse-performance-periods', async () => {
      const supabase = getServerClient();

      try {
        const adminRows = extractionsByCategory.admin_data ?? [];

        // Try structured field first
        const structuredRow = adminRows.find(
          (r) => r.field_name === 'period_of_performance_structured'
        );
        if (structuredRow?.field_value) {
          const structured = structuredRow.field_value as ParsedPerformancePeriod[];
          if (Array.isArray(structured) && structured.length > 0) {
            return structured;
          }
        }

        // Try parsing the string period_of_performance field via Claude
        const popRow = adminRows.find(
          (r) => r.field_name === 'period_of_performance'
        );
        const popString = popRow?.field_value as string | null;

        if (popString) {
          const claudeResponse = await anthropic.messages.create({
            model: MODEL,
            max_tokens: 1024,
            temperature: 0,
            system: `You parse government contract period of performance text into structured JSON. Return only a JSON array.`,
            messages: [
              {
                role: 'user',
                content: `Parse this period of performance text into a JSON array of performance periods.

TEXT: "${popString}"

Return a JSON array where each element matches:
{
  "label": "<e.g. Base Year, Option Year 1>",
  "type": "<base|option>",
  "duration_months": <number>,
  "annual_hours": 1920,
  "start_date": "<YYYY-MM-DD or null>",
  "end_date": "<YYYY-MM-DD or null>"
}

Return ONLY the JSON array.`,
              },
            ],
          });

          const raw = claudeResponse.content
            .filter((b) => b.type === 'text')
            .map((b) => (b as { type: 'text'; text: string }).text)
            .join('');

          try {
            const parsed = parseClaudeJSON<ParsedPerformancePeriod[]>(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
              return parsed;
            }
          } catch {
            // Fall through to default
          }
        }

        // Fallback: single base year
        return [
          {
            label: 'Base Year',
            type: 'base' as const,
            duration_months: 12,
            annual_hours: 1920,
          },
        ];
      } catch (err) {
        await supabase
          .from('boe_assessments')
          .upsert(
            {
              solicitation_id: solicitationId,
              company_id: companyId,
              status: 'failed',
              error_message: err instanceof Error ? err.message : String(err),
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'solicitation_id,company_id' }
          );
        throw err;
      }
    });

    // ─── Step 3: generate-boe-table ───────────────────────────────────────────
    const boeTable = await step.run('generate-boe-table', async () => {
      const supabase = getServerClient();

      try {
        const sowRows = extractionsByCategory.sow_pws ?? [];
        const adminRows = extractionsByCategory.admin_data ?? [];
        const operationalRows = extractionsByCategory.operational_context ?? [];
        const securityRows = extractionsByCategory.security_reqs ?? [];

        // Read service area index from sow_pws
        const serviceAreaIndexRow = sowRows.find(
          (r) => r.field_name === 'service_area_index'
        );
        const serviceAreas = (serviceAreaIndexRow?.field_value as Array<{
          code: string;
          name: string;
          description?: string;
          sub_requirements?: Array<{ id: string; description: string; deliverables?: string[] }>;
          staffing_indicators?: Array<{ indicator: string; value: string | number; source_paragraph?: string }>;
        }>) ?? [];

        // Derive available labor categories from personnel proposed_roles
        const personnelLaborCategories: string[] = [];
        for (const person of personnel) {
          const roles = (person as { proposed_roles?: Array<{ role_title: string }> }).proposed_roles ?? [];
          for (const role of roles) {
            if (role.role_title && !personnelLaborCategories.includes(role.role_title)) {
              personnelLaborCategories.push(role.role_title);
            }
          }
        }
        const availableLaborCategories =
          personnelLaborCategories.length > 0
            ? personnelLaborCategories
            : STANDARD_FEDERAL_IT_LABOR_CATEGORIES;

        // Determine contract type from admin_data
        const contractTypeRow = adminRows.find((r) => r.field_name === 'contract_type');
        const contractType = (contractTypeRow?.field_value as string) ?? null;

        // Determine security environment from security_reqs
        const clearanceLevelsRow = securityRows.find(
          (r) => r.field_name === 'clearance_levels'
        );
        const securityEnvironment: string[] = Array.isArray(
          clearanceLevelsRow?.field_value
        )
          ? (clearanceLevelsRow!.field_value as string[])
          : [];

        // Determine site count
        const sitesRow = operationalRows.find((r) => r.field_name === 'sites');
        const sitesArray = Array.isArray(sitesRow?.field_value)
          ? (sitesRow!.field_value as unknown[])
          : [];
        const siteCountFromOp = sitesArray.length;
        const siteCountFromDataCall = Array.isArray(dataCallResponse?.site_staffing)
          ? (dataCallResponse!.site_staffing as unknown[]).length
          : 0;
        const siteCount = siteCountFromOp || siteCountFromDataCall || 1;

        // If no service areas found, create a single default entry from SOW description
        const effectiveServiceAreas =
          serviceAreas.length > 0
            ? serviceAreas
            : [
                {
                  code: 'SA-01',
                  name: 'General Services',
                  description:
                    'General contract services as described in the SOW/PWS.',
                  sub_requirements: [],
                  staffing_indicators: [],
                },
              ];

        const allRows: BoeTableRow[] = [];

        for (const sa of effectiveServiceAreas) {
          const boePromptData: BoePromptData = {
            serviceAreaCode: sa.code,
            serviceAreaName: sa.name,
            description: sa.description ?? '',
            subRequirements: sa.sub_requirements ?? [],
            staffingIndicators: sa.staffing_indicators ?? [],
            availableLaborCategories,
            performancePeriods,
            siteCount,
            contractType,
            securityEnvironment,
          };

          const { systemPrompt, userPrompt } = assembleBoeTablePrompt(boePromptData);

          const claudeResponse = await anthropic.messages.create({
            model: MODEL,
            max_tokens: 4096,
            temperature: 0.2,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
          });

          const raw = claudeResponse.content
            .filter((b) => b.type === 'text')
            .map((b) => (b as { type: 'text'; text: string }).text)
            .join('');

          try {
            const rows = parseClaudeJSON<BoeTableRow[]>(raw);
            if (Array.isArray(rows)) {
              allRows.push(...rows);
            }
          } catch (parseErr) {
            console.warn(
              `[boe-generator] Failed to parse BOE rows for ${sa.code}:`,
              parseErr
            );
          }
        }

        return allRows;
      } catch (err) {
        await supabase
          .from('boe_assessments')
          .upsert(
            {
              solicitation_id: solicitationId,
              company_id: companyId,
              status: 'failed',
              error_message: err instanceof Error ? err.message : String(err),
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'solicitation_id,company_id' }
          );
        throw err;
      }
    });

    // ─── Step 4: generate-government-comparison ───────────────────────────────
    const govComparison = await step.run('generate-government-comparison', async () => {
      const supabase = getServerClient();

      try {
        const costRows = extractionsByCategory.cost_price ?? [];
        const govTableRow = costRows.find(
          (r) => r.field_name === 'government_staffing_table'
        );
        const govTable = govTableRow?.field_value as Array<{
          labor_category: string;
          fte: number;
        }> | null;

        if (!govTable || !Array.isArray(govTable) || govTable.length === 0) {
          return null;
        }

        const comparison: GovStaffingComparison[] = [];

        // Build a map of proposed FTE by labor category (case-insensitive)
        const proposedByCategory: Record<string, number> = {};
        for (const row of boeTable) {
          const key = row.labor_category.toLowerCase();
          proposedByCategory[key] = (proposedByCategory[key] ?? 0) + row.fte_count;
        }

        // Process government table rows
        const processedCategories = new Set<string>();
        for (const govRow of govTable) {
          const key = govRow.labor_category.toLowerCase();
          processedCategories.add(key);
          const proposedFte = proposedByCategory[key] ?? 0;
          const delta = proposedFte - govRow.fte;
          const deltaPct = govRow.fte !== 0 ? (delta / govRow.fte) * 100 : 0;
          const agrees = Math.abs(deltaPct) <= 15;

          let flagReason: string | undefined;
          if (!agrees) {
            if (delta > 0) {
              flagReason = `Offeror proposes ${Math.abs(delta).toFixed(1)} more FTE than government estimate — additional staff required for 24/7 coverage, surge capacity, or multi-site delivery.`;
            } else {
              flagReason = `Offeror proposes ${Math.abs(delta).toFixed(1)} fewer FTE than government estimate — efficiency gains through automation and centralized delivery reduce staffing requirements.`;
            }
          }

          comparison.push({
            labor_category: govRow.labor_category,
            gov_fte: govRow.fte,
            proposed_fte: proposedFte,
            delta,
            delta_pct: deltaPct,
            agrees,
            flag_reason: flagReason,
          });
        }

        // Add BOE labor categories not in government table
        for (const row of boeTable) {
          const key = row.labor_category.toLowerCase();
          if (!processedCategories.has(key)) {
            processedCategories.add(key);
            const proposedFte = proposedByCategory[key] ?? 0;
            comparison.push({
              labor_category: row.labor_category,
              gov_fte: null,
              proposed_fte: proposedFte,
              delta: proposedFte,
              delta_pct: 0,
              agrees: false,
              flag_reason: `Labor category not included in government staffing table — offeror identified this role as required based on SOW task analysis.`,
            });
          }
        }

        return comparison;
      } catch (err) {
        await supabase
          .from('boe_assessments')
          .upsert(
            {
              solicitation_id: solicitationId,
              company_id: companyId,
              status: 'failed',
              error_message: err instanceof Error ? err.message : String(err),
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'solicitation_id,company_id' }
          );
        throw err;
      }
    });

    // ─── Step 5: generate-narrative ───────────────────────────────────────────
    const narrativeMarkdown = await step.run('generate-narrative', async () => {
      const supabase = getServerClient();

      try {
        const solicitationTitle = solicitation?.title ?? 'Contract';
        const agencyName =
          (solicitation as { agency_name?: string } | null)?.agency_name ?? 'Federal Agency';

        const { systemPrompt, userPrompt } = assembleBoeNarrativePrompt(
          boeTable,
          govComparison,
          performancePeriods,
          solicitationTitle,
          agencyName
        );

        const claudeResponse = await anthropic.messages.create({
          model: MODEL,
          max_tokens: 4096,
          temperature: 0.3,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        });

        const narrative = claudeResponse.content
          .filter((b) => b.type === 'text')
          .map((b) => (b as { type: 'text'; text: string }).text)
          .join('\n');

        return narrative;
      } catch (err) {
        await supabase
          .from('boe_assessments')
          .upsert(
            {
              solicitation_id: solicitationId,
              company_id: companyId,
              status: 'failed',
              error_message: err instanceof Error ? err.message : String(err),
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'solicitation_id,company_id' }
          );
        throw err;
      }
    });

    // ─── Step 6: build-diagram-specs ─────────────────────────────────────────
    const diagramSpecs = await step.run('build-diagram-specs', async () => {
      const supabase = getServerClient();

      try {
        const specs: unknown[] = [];

        // 1. Data table spec for the BOE table
        specs.push({
          type: 'data-table',
          title: 'Basis of Estimate — Staffing Summary',
          columns: [
            'Task Area',
            'Labor Category',
            'FTE',
            'Annual Hours',
            'Rationale',
          ],
          rows: boeTable.map((r) => [
            `${r.task_area_code} — ${r.task_area_name}`,
            r.labor_category,
            r.fte_count.toFixed(1),
            r.total_annual_hours.toString(),
            r.rationale,
          ]),
        });

        // 2. Bar chart spec for FTE by labor category
        const fteByCategory: Record<string, number> = {};
        for (const row of boeTable) {
          fteByCategory[row.labor_category] =
            (fteByCategory[row.labor_category] ?? 0) + row.fte_count;
        }
        specs.push({
          type: 'bar-chart',
          title: 'Proposed FTE by Labor Category',
          xLabel: 'Labor Category',
          yLabel: 'FTE',
          data: Object.entries(fteByCategory).map(([cat, fte]) => ({
            label: cat,
            value: fte,
          })),
        });

        // 3. Gantt spec for performance periods (only when more than 1 period)
        if (performancePeriods.length > 1) {
          specs.push({
            type: 'gantt',
            title: 'Contract Performance Periods',
            rows: performancePeriods.map((p) => ({
              label: p.label,
              duration_months: p.duration_months,
              start_date: p.start_date ?? null,
              end_date: p.end_date ?? null,
            })),
          });
        }

        return specs as unknown[];
      } catch (err) {
        await supabase
          .from('boe_assessments')
          .upsert(
            {
              solicitation_id: solicitationId,
              company_id: companyId,
              status: 'failed',
              error_message: err instanceof Error ? err.message : String(err),
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'solicitation_id,company_id' }
          );
        throw err;
      }
    });

    // ─── Step 7: finalize ─────────────────────────────────────────────────────
    await step.run('finalize', async () => {
      const supabase = getServerClient();

      try {
        const totalFteProposed = boeTable.reduce((sum, r) => sum + r.fte_count, 0);

        const totalFteGovernment: number | null =
          govComparison !== null
            ? govComparison
                .filter((c) => c.gov_fte !== null)
                .reduce((sum, c) => sum + (c.gov_fte as number), 0)
            : null;

        const varianceFlag =
          totalFteGovernment !== null &&
          Math.abs(
            (totalFteProposed - totalFteGovernment) / totalFteGovernment
          ) > 0.2;

        // Determine overall SOW confidence
        const confidenceCounts = { high: 0, medium: 0, low: 0 };
        for (const row of boeTable) {
          confidenceCounts[row.confidence]++;
        }
        const sowConfidence: 'high' | 'medium' | 'low' =
          confidenceCounts.low > boeTable.length * 0.3
            ? 'low'
            : confidenceCounts.medium > boeTable.length * 0.4
            ? 'medium'
            : 'high';

        const extractionFieldCount =
          (extractionsByCategory.sow_pws?.length ?? 0) +
          (extractionsByCategory.cost_price?.length ?? 0) +
          (extractionsByCategory.admin_data?.length ?? 0);

        const now = new Date().toISOString();

        await supabase
          .from('boe_assessments')
          .upsert(
            {
              solicitation_id: solicitationId,
              company_id: companyId,
              status: 'completed',
              boe_table: boeTable,
              narrative_markdown: narrativeMarkdown,
              government_comparison: govComparison,
              performance_periods: performancePeriods,
              diagram_specs: diagramSpecs,
              total_fte_proposed: totalFteProposed,
              total_fte_government: totalFteGovernment,
              variance_flag: varianceFlag,
              sow_confidence: sowConfidence,
              extraction_field_count: extractionFieldCount,
              error_message: null,
              generated_at: now,
              updated_at: now,
            },
            { onConflict: 'solicitation_id,company_id' }
          );

        await logPipelineEvent(solicitationId, 'boe-generator', 'completed', {
          total_fte_proposed: totalFteProposed,
          total_fte_government: totalFteGovernment,
          variance_flag: varianceFlag,
          boe_row_count: boeTable.length,
          periods_count: performancePeriods.length,
          comparison_count: govComparison?.length ?? 0,
        });
      } catch (err) {
        await supabase
          .from('boe_assessments')
          .upsert(
            {
              solicitation_id: solicitationId,
              company_id: companyId,
              status: 'failed',
              error_message: err instanceof Error ? err.message : String(err),
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'solicitation_id,company_id' }
          );
        throw err;
      }
    });
  }
);
