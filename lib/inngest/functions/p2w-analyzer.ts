/**
 * P2W (Price-to-Win) Analyzer — Inngest Function
 *
 * Triggered by: 'p2w.analyze'
 * Event payload: { solicitationId: string; companyId: string; boeAssessmentId: string }
 *
 * Steps:
 * 1. fetch-boe-and-context       — Load BOE assessment, extractions, company, solicitation
 * 2. resolve-geographic-region   — Map site locations to MSA location quotient
 * 3. lookup-bls-rates            — Map labor categories to BLS OES rates
 * 4. lookup-gsa-rates            — Parallel GSA eLibrary rate lookups (non-blocking)
 * 5. build-rate-table            — Build P2wRateBenchmarkRow[] with recommendations
 * 6. compute-totals              — Sum cost ranges, compare to IGCE if available
 * 7. generate-narrative          — Claude 300-400 word pricing analyst narrative
 * 8. finalize                    — Upsert p2w_analyses with status='completed'
 */

import { inngest } from '../client';
import { getServerClient } from '@/lib/supabase/client';
import { anthropic, MODEL } from '@/lib/anthropic/client';
import { lookupLaborCategory } from '@/lib/benchmarks/labor-category-mappings';
import { lookupGsaRates } from '@/lib/benchmarks/gsa-elibrary-client';
import blsData from '@/lib/benchmarks/bls-oes-data.json';
import type { BoeTableRow } from '@/lib/supabase/boe-types';
import type { P2wRateBenchmarkRow } from '@/lib/supabase/p2w-types';

// ===== HELPERS =====

/**
 * Parse an IGCE value string (e.g. "$12.5M", "$1,200,000", "1200000") to a number.
 * Returns null if unparseable.
 */
function parseIgceValue(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.trim();

  // Handle "M" suffix (millions)
  const mMatch = cleaned.match(/^\$?([\d,]+\.?\d*)\s*[Mm]$/);
  if (mMatch) {
    const num = parseFloat(mMatch[1].replace(/,/g, ''));
    return isNaN(num) ? null : num * 1_000_000;
  }

  // Handle plain dollar amounts
  const numStr = cleaned.replace(/[$,]/g, '');
  const num = parseFloat(numStr);
  return isNaN(num) ? null : num;
}

/**
 * Format a dollar amount compactly for narrative text.
 * E.g. 12500000 → "$12.5M"
 */
function formatDollars(amount: number): string {
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(1)}M`;
  }
  if (amount >= 1_000) {
    return `$${(amount / 1_000).toFixed(0)}K`;
  }
  return `$${amount.toFixed(0)}`;
}

// ===== INNGEST FUNCTION =====

export const p2wAnalyzer = inngest.createFunction(
  { id: 'p2w-analyzer' },
  { event: 'p2w.analyze' },
  async ({ event, step }) => {
    const { solicitationId, companyId, boeAssessmentId } = event.data as {
      solicitationId: string;
      companyId: string;
      boeAssessmentId: string;
    };

    // ─── Step 1: fetch-boe-and-context ─────────────────────────────────────────
    const context = await step.run('fetch-boe-and-context', async () => {
      const supabase = getServerClient();

      // Mark p2w_analyses as generating (upsert in case row doesn't exist yet)
      await supabase
        .from('p2w_analyses')
        .upsert(
          {
            solicitation_id: solicitationId,
            company_id: companyId,
            status: 'generating',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'solicitation_id,company_id' }
        );

      // Load BOE assessment
      const { data: boe, error: boeError } = await supabase
        .from('boe_assessments')
        .select('*')
        .eq('id', boeAssessmentId)
        .maybeSingle();

      if (boeError || !boe) {
        throw new Error(`BOE assessment not found: id=${boeAssessmentId}`);
      }

      if (boe.status !== 'completed') {
        throw new Error(`BOE assessment is not completed (status=${boe.status})`);
      }

      // Load compliance extractions for relevant categories
      const { data: extractionRows, error: extractionError } = await supabase
        .from('compliance_extractions')
        .select('category, field_name, field_value')
        .eq('solicitation_id', solicitationId)
        .in('category', ['cost_price', 'admin_data', 'operational_context']);

      if (extractionError) {
        throw new Error(`Failed to load extractions: ${extractionError.message}`);
      }

      // Group extractions by category
      const extractionsByCategory: Record<string, Array<{ field_name: string; field_value: unknown }>> = {
        cost_price: [],
        admin_data: [],
        operational_context: [],
      };
      for (const row of extractionRows ?? []) {
        if (extractionsByCategory[row.category]) {
          extractionsByCategory[row.category].push({
            field_name: row.field_name,
            field_value: row.field_value,
          });
        }
      }

      // Load company name
      const { data: company } = await supabase
        .from('company_profiles')
        .select('company_name')
        .eq('id', companyId)
        .maybeSingle();

      // Load solicitation title and agency
      const { data: solicitation } = await supabase
        .from('solicitations')
        .select('title, agency')
        .eq('id', solicitationId)
        .maybeSingle();

      // Load contract vehicles for rate context
      const { data: contractVehicles } = await supabase
        .from('contract_vehicles')
        .select('vehicle_name, ceiling_value')
        .eq('company_id', companyId);

      return {
        boe,
        extractionsByCategory,
        company,
        solicitation,
        contractVehicles: contractVehicles ?? [],
      };
    });

    // ─── Step 2: resolve-geographic-region ──────────────────────────────────────
    const { regionLabel, locationQuotient } = await step.run('resolve-geographic-region', async () => {
      const DEFAULT_REGION = 'Washington-Arlington-Alexandria DC-VA-MD-WV';
      const DEFAULT_LQ = blsData.msa_location_quotients[DEFAULT_REGION as keyof typeof blsData.msa_location_quotients] ?? 1.22;

      const msaKeys = Object.keys(blsData.msa_location_quotients);
      const opCtxRows = context.extractionsByCategory.operational_context;

      // Try to find a site from 'sites' or 'primary_location' fields
      const siteValue =
        opCtxRows.find(r => r.field_name === 'sites')?.field_value ??
        opCtxRows.find(r => r.field_name === 'primary_location')?.field_value;

      if (siteValue) {
        const siteStr = typeof siteValue === 'string'
          ? siteValue
          : JSON.stringify(siteValue);
        const siteLower = siteStr.toLowerCase();

        for (const msaKey of msaKeys) {
          if (siteLower.includes(msaKey.toLowerCase()) || msaKey.toLowerCase().includes(siteLower.split(/[,\s]/)[0])) {
            const lq = blsData.msa_location_quotients[msaKey as keyof typeof blsData.msa_location_quotients];
            return { regionLabel: msaKey, locationQuotient: lq };
          }
        }
      }

      return { regionLabel: DEFAULT_REGION, locationQuotient: DEFAULT_LQ };
    });

    // ─── Step 3: lookup-bls-rates ───────────────────────────────────────────────
    const blsRateMap = await step.run('lookup-bls-rates', async () => {
      const boeTable: BoeTableRow[] = (context.boe.boe_table as BoeTableRow[]) ?? [];
      const uniqueCategories = [...new Set(boeTable.map(r => r.labor_category))];

      const result: Record<string, {
        median: number;
        p75: number;
        adjusted_median: number;
        adjusted_p75: number;
        soc_code: string;
        bls_title: string;
      }> = {};

      for (const category of uniqueCategories) {
        const mapping = lookupLaborCategory(category);
        if (!mapping) continue;

        const blsEntry = (blsData.national_rates as Record<string, {
          soc_code: string;
          median_hourly: number;
          p75_hourly: number;
          p90_hourly: number;
        }>)[mapping.bls_title];

        if (!blsEntry) continue;

        result[category] = {
          median: blsEntry.median_hourly,
          p75: blsEntry.p75_hourly,
          adjusted_median: blsEntry.median_hourly * locationQuotient,
          adjusted_p75: blsEntry.p75_hourly * locationQuotient,
          soc_code: mapping.soc_code,
          bls_title: mapping.bls_title,
        };
      }

      return result;
    });

    // ─── Step 4: lookup-gsa-rates ───────────────────────────────────────────────
    const gsaRateMap = await step.run('lookup-gsa-rates', async () => {
      try {
        const boeTable: BoeTableRow[] = (context.boe.boe_table as BoeTableRow[]) ?? [];
        const uniqueCategories = [...new Set(boeTable.map(r => r.labor_category))];

        const results = await Promise.all(
          uniqueCategories.map(async (category) => ({
            category,
            result: await lookupGsaRates(category),
          }))
        );

        const map: Record<string, typeof results[0]['result']> = {};
        for (const { category, result } of results) {
          map[category] = result;
        }
        return map;
      } catch {
        return {} as Record<string, null>;
      }
    });

    // ─── Step 5: build-rate-table ───────────────────────────────────────────────
    const rateTable = await step.run('build-rate-table', async () => {
      const boeTable: BoeTableRow[] = (context.boe.boe_table as BoeTableRow[]) ?? [];
      const costPriceRows = context.extractionsByCategory.cost_price;

      // Parse IGCE breakdown map
      const igceBreakdownRow = costPriceRows.find(r => r.field_name === 'igce_breakdown');
      const igceBreakdown = igceBreakdownRow?.field_value as Record<string, number> | null ?? null;

      const rows: P2wRateBenchmarkRow[] = [];

      for (const boeRow of boeTable) {
        const bls = blsRateMap[boeRow.labor_category] ?? null;
        const gsa = gsaRateMap[boeRow.labor_category] ?? null;

        const blsMedian = bls?.adjusted_median ?? null;
        const blsP75 = bls?.adjusted_p75 ?? null;
        const gsaLow = gsa?.rate_low ?? null;
        const gsaHigh = gsa?.rate_high ?? null;
        const gsaMid = (gsaLow !== null && gsaHigh !== null) ? (gsaLow + gsaHigh) / 2 : null;

        // Gov estimate from IGCE breakdown
        let govEstimateRate: number | null = null;
        if (igceBreakdown) {
          // Try exact match, then case-insensitive substring match
          const igceKey = Object.keys(igceBreakdown).find(
            k => k.toLowerCase() === boeRow.labor_category.toLowerCase() ||
                 boeRow.labor_category.toLowerCase().includes(k.toLowerCase()) ||
                 k.toLowerCase().includes(boeRow.labor_category.toLowerCase())
          );
          if (igceKey !== undefined) {
            govEstimateRate = igceBreakdown[igceKey];
          }
        }

        // Collect available benchmarks for min/max
        const availableBenchmarks = [
          blsMedian,
          blsP75,
          gsaLow,
          gsaHigh,
          govEstimateRate,
        ].filter((v): v is number => v !== null);

        // Compute recommended_low = min * 0.95 (or fallback to 0 if no data)
        const recommendedLow = availableBenchmarks.length > 0
          ? Math.min(...availableBenchmarks) * 0.95
          : 0;

        // Compute recommended_target as weighted average of available sources
        // BLS adjusted median: weight 0.5, GSA mid: weight 0.3, gov estimate: weight 0.2
        let totalWeight = 0;
        let weightedSum = 0;

        if (blsMedian !== null) { weightedSum += blsMedian * 0.5; totalWeight += 0.5; }
        if (gsaMid !== null) { weightedSum += gsaMid * 0.3; totalWeight += 0.3; }
        if (govEstimateRate !== null) { weightedSum += govEstimateRate * 0.2; totalWeight += 0.2; }

        const recommendedTarget = totalWeight > 0
          ? weightedSum / totalWeight
          : (availableBenchmarks.length > 0 ? availableBenchmarks.reduce((a, b) => a + b, 0) / availableBenchmarks.length : 0);

        // Compute recommended_high = max * 1.05
        const recommendedHigh = availableBenchmarks.length > 0
          ? Math.max(...availableBenchmarks) * 1.05
          : 0;

        // Total costs (base year: rate × hours × FTE)
        const totalCostLow = recommendedLow * boeRow.annual_hours_per_fte * boeRow.fte_count;
        const totalCostTarget = recommendedTarget * boeRow.annual_hours_per_fte * boeRow.fte_count;
        const totalCostHigh = recommendedHigh * boeRow.annual_hours_per_fte * boeRow.fte_count;

        // Data sources used
        const dataSources: string[] = [];
        if (bls !== null) dataSources.push('BLS OES');
        if (gsaMid !== null) dataSources.push('GSA eLibrary');
        if (govEstimateRate !== null) dataSources.push('IGCE');

        // Rate confidence
        const rateConfidence: 'high' | 'medium' | 'low' =
          (bls !== null && gsaMid !== null) ? 'high' :
          (bls !== null) ? 'medium' : 'low';

        rows.push({
          labor_category: boeRow.labor_category,
          boe_fte: boeRow.fte_count,
          boe_annual_hours: boeRow.annual_hours_per_fte,
          proposed_hourly_rate: null,
          bls_median_hourly: blsMedian,
          bls_75th_percentile: blsP75,
          gsa_benchmark_low: gsaLow,
          gsa_benchmark_high: gsaHigh,
          gov_estimate_rate: govEstimateRate,
          recommended_low: recommendedLow,
          recommended_target: recommendedTarget,
          recommended_high: recommendedHigh,
          total_cost_low: totalCostLow,
          total_cost_target: totalCostTarget,
          total_cost_high: totalCostHigh,
          data_sources_used: dataSources,
          rate_confidence: rateConfidence,
          bls_soc_code: bls?.soc_code,
          geographic_adjustment_applied: locationQuotient !== 1.0,
        });
      }

      return rows;
    });

    // ─── Step 6: compute-totals ─────────────────────────────────────────────────
    const totals = await step.run('compute-totals', async () => {
      const totalCostLow = rateTable.reduce((sum, r) => sum + r.total_cost_low, 0);
      const totalCostTarget = rateTable.reduce((sum, r) => sum + r.total_cost_target, 0);
      const totalCostHigh = rateTable.reduce((sum, r) => sum + r.total_cost_high, 0);

      const costPriceRows = context.extractionsByCategory.cost_price;
      const igceRawRow = costPriceRows.find(r => r.field_name === 'igce_value');
      const igceValueParsed = parseIgceValue(
        igceRawRow?.field_value != null ? String(igceRawRow.field_value) : null
      );

      let igceComparisonNote: string | null = null;
      if (igceValueParsed !== null && igceValueParsed > 0) {
        const deltaPct = ((totalCostTarget - igceValueParsed) / igceValueParsed) * 100;
        const direction = deltaPct >= 0 ? 'above' : 'below';
        igceComparisonNote =
          `Independent estimate of ${formatDollars(totalCostTarget)} is ${Math.abs(deltaPct).toFixed(1)}% ${direction} the Government's IGCE of ${formatDollars(igceValueParsed)}.`;
      }

      return { totalCostLow, totalCostTarget, totalCostHigh, igceValueParsed, igceComparisonNote };
    });

    // ─── Step 7: generate-narrative ─────────────────────────────────────────────
    const narrativeMarkdown = await step.run('generate-narrative', async () => {
      const solicitationTitle = context.solicitation?.title ?? 'Untitled Solicitation';
      const agency = context.solicitation?.agency ?? 'Agency';
      const companyName = context.company?.company_name ?? 'Company';

      // Summarize rate table for prompt
      const rateSummaryLines = rateTable.map(r => {
        const parts = [
          `- **${r.labor_category}** (${r.boe_fte} FTE × ${r.boe_annual_hours} hrs):`,
          `  Recommended range: $${r.recommended_low.toFixed(2)}/hr – $${r.recommended_high.toFixed(2)}/hr`,
          `  Target: $${r.recommended_target.toFixed(2)}/hr`,
          `  Confidence: ${r.rate_confidence}`,
          `  Sources: ${r.data_sources_used.join(', ') || 'none'}`,
        ];
        if (r.bls_median_hourly !== null) {
          parts.push(`  BLS median (adjusted): $${r.bls_median_hourly.toFixed(2)}/hr`);
        }
        if (r.gsa_benchmark_low !== null && r.gsa_benchmark_high !== null) {
          parts.push(`  GSA range: $${r.gsa_benchmark_low.toFixed(2)}/hr – $${r.gsa_benchmark_high.toFixed(2)}/hr`);
        }
        return parts.join('\n');
      }).join('\n\n');

      const totalSummary = [
        `Total cost range: ${formatDollars(totals.totalCostLow)} – ${formatDollars(totals.totalCostHigh)}`,
        `Target total: ${formatDollars(totals.totalCostTarget)}`,
        totals.igceComparisonNote ? `IGCE comparison: ${totals.igceComparisonNote}` : null,
      ].filter(Boolean).join('\n');

      const userPrompt = `You are preparing a Price-to-Win analysis for ${companyName} on the following opportunity:

**Solicitation:** ${solicitationTitle}
**Agency:** ${agency}
**Geographic Region:** ${regionLabel} (location quotient: ${locationQuotient.toFixed(2)})

## Labor Category Rate Analysis

${rateSummaryLines}

## Cost Summary

${totalSummary}

---

Write a 300-400 word Price-to-Win rate analysis narrative for INTERNAL USE ONLY by the proposal team. This is NOT submitted to the government.

Include:
1. A brief opening summarizing the competitive pricing landscape for this opportunity
2. Specific rate recommendations per labor category with brief rationale (reference specific data sources)
3. Flag any labor categories where the company should be especially cautious about pricing too high (risk of losing) or too low (risk of unallowable costs or unsustainability)
4. Commentary on the IGCE comparison if available
5. A closing recommendation on the overall pricing posture (aggressive/moderate/conservative)

Format as clean markdown with headings. Do NOT include any information that suggests this was AI-generated.`;

      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 1024,
        temperature: 0.3,
        system: 'You are a federal proposal pricing analyst. Write a Price-to-Win rate analysis narrative for INTERNAL USE ONLY by the proposal team. This is NOT submitted to the government.',
        messages: [{ role: 'user', content: userPrompt }],
      });

      const textBlock = response.content.find(b => b.type === 'text');
      return textBlock?.text ?? '# P2W Narrative\n\nNarrative generation failed — no text returned.';
    });

    // ─── Step 8: finalize ────────────────────────────────────────────────────────
    const finalRow = await step.run('finalize', async () => {
      const supabase = getServerClient();

      // Determine GSA vintage from any result
      const anyGsaResult = Object.values(gsaRateMap).find(r => r !== null);
      const gsaDataVintage = anyGsaResult?.vintage ?? null;

      // Extract NAICS code from admin_data extractions
      const adminDataRows = context.extractionsByCategory.admin_data;
      const naicsRow = adminDataRows.find(r => r.field_name === 'naics_code' || r.field_name === 'naics');
      const naicsCode = naicsRow?.field_value != null ? String(naicsRow.field_value) : null;

      const { data, error } = await supabase
        .from('p2w_analyses')
        .upsert(
          {
            solicitation_id: solicitationId,
            company_id: companyId,
            boe_assessment_id: boeAssessmentId,
            status: 'completed',
            rate_table: rateTable,
            total_cost_low: totals.totalCostLow,
            total_cost_target: totals.totalCostTarget,
            total_cost_high: totals.totalCostHigh,
            igce_value: totals.igceValueParsed,
            igce_comparison_note: totals.igceComparisonNote,
            narrative_markdown: narrativeMarkdown,
            bls_data_vintage: blsData.vintage,
            gsa_data_vintage: gsaDataVintage,
            geographic_region: regionLabel,
            naics_code: naicsCode,
            error_message: null,
            generated_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'solicitation_id,company_id' }
        )
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to finalize P2W analysis: ${error.message}`);
      }

      return data;
    });

    return { p2wAnalysisId: finalRow.id, status: 'completed' };
  }
);
