/**
 * Touchup Scorer — Per-Volume Inngest Function
 *
 * Triggered by: 'proposal.touchup.score'
 * Payload: { solicitationId, companyId, draftId, touchupId, touchupVolumeId }
 *
 * Scores a single first-draft volume against all source data and RFP requirements.
 * Uses Claude Sonnet 4.6 via streaming transport (messages.stream().finalMessage())
 * with max_tokens=32768, temperature=0.1.
 *
 * On success: sets touchup_volume status to 'scored' with gap_analysis populated.
 * On failure: sets touchup_volume status to 'failed' with error_message.
 */

import { inngest } from '../client';
import { getServerClient } from '@/lib/supabase/client';
import { anthropic, MODEL } from '@/lib/anthropic/client';
import { parseClaudeJSON } from '@/lib/anthropic/json-extractor';
import { assembleScorePrompt, type ScoringPromptData } from '@/lib/generation/touchup/scoring-prompt';
import { snapshotVersion } from '@/lib/supabase/touchup-version-helper';
import { logPipelineEvent } from '@/lib/logging/pipeline-logger';
import type { CompanyProfile } from '@/lib/supabase/company-types';
import type { DataCallResponse } from '@/lib/supabase/tier2-types';
import type {
  ComplianceExtractionsByCategory,
  ExtractionCategory,
} from '@/lib/supabase/compliance-types';
import type {
  GapAnalysis,
  DataVerification,
  HumanEffortEstimate,
  ComplianceTier,
} from '@/lib/supabase/touchup-types';
import { validateScorerOutput, type ScorerValidationContext } from '@/lib/generation/touchup/scorer-output-validator';
import { buildRfpChecklists, filterChecklistForVolume } from '@/lib/generation/pipeline/soo-checklist-builder';

// ─── Post-Processing: Human Effort Estimator ───────────────────────────

const EFFORT_MAP: Record<string, number> = {
  auto_fillable_placeholder: 0,
  legitimate_placeholder_quick: 0.25,
  find_and_replace: 0.5,
  missing_paragraph: 0.75,
  missing_section: 2,
  page_limit_compression: 2.5,
  name_reconciliation: 1.5,
  cross_volume_audit: 3,
};

function calculateHumanEffort(gap: GapAnalysis): HumanEffortEstimate {
  const categories: { category: string; hours: number; count: number }[] = [];

  const autoFillable = (gap.placeholder_items || []).filter(p => p.placeholder_type === 'auto_fillable');
  const legitimate = (gap.placeholder_items || []).filter(p => p.placeholder_type === 'legitimate');
  if (autoFillable.length > 0) categories.push({ category: 'Auto-fillable placeholders', hours: 0, count: autoFillable.length });
  if (legitimate.length > 0) categories.push({ category: 'Legitimate placeholders', hours: legitimate.length * EFFORT_MAP.legitimate_placeholder_quick, count: legitimate.length });

  const fabrications = (gap.data_verification || []).filter(d => !d.verified);
  const nameIssues = fabrications.filter(d => d.root_cause_id?.includes('name') || d.root_cause_id?.includes('personnel'));
  const otherFabrications = fabrications.filter(d => !nameIssues.includes(d));
  if (nameIssues.length > 0) categories.push({ category: 'Name reconciliation', hours: nameIssues.length * EFFORT_MAP.name_reconciliation, count: nameIssues.length });
  if (otherFabrications.length > 0) categories.push({ category: 'Data corrections', hours: otherFabrications.length * EFFORT_MAP.find_and_replace, count: otherFabrications.length });

  const missingContent = gap.missing_content || [];
  const missingParagraphs = missingContent.filter(m => m.source_data_available);
  const missingSections = missingContent.filter(m => !m.source_data_available);
  if (missingParagraphs.length > 0) categories.push({ category: 'Missing paragraphs (data available)', hours: missingParagraphs.length * EFFORT_MAP.missing_paragraph, count: missingParagraphs.length });
  if (missingSections.length > 0) categories.push({ category: 'Missing sections (human input needed)', hours: missingSections.length * EFFORT_MAP.missing_section, count: missingSections.length });

  const totalHours = categories.reduce((sum, c) => sum + c.hours, 0);
  const roundedTotal = Math.round(totalHours * 100) / 100;

  let passFail: HumanEffortEstimate['pass_fail'] = 'pass';
  let failReason: string | undefined;
  if (roundedTotal > 16) {
    passFail = 'fail_volume';
    failReason = `Estimated ${roundedTotal}h exceeds 16h volume threshold`;
  }

  return { total_hours: roundedTotal, by_category: categories, pass_fail: passFail, fail_reason: failReason };
}

// ─── Post-Processing: Score Cap Logic ──────────────────────────────────

function applyScoreCaps(score: number, gap: GapAnalysis): number {
  const allFindings = [
    ...(gap.requirements_coverage || []).map(r => r.severity_tier),
    ...(gap.data_verification || []).map(d => d.severity_tier),
  ].filter(Boolean) as ComplianceTier[];

  const fatalCount = allFindings.filter(t => t === 'fatal').length;
  const deficiencyCount = allFindings.filter(t => t === 'deficiency').length;

  if (fatalCount > 0) return Math.min(score, 30);
  if (deficiencyCount >= 3) return Math.min(score, 50);
  return score;
}

// ─── Post-Processing: Deduplication ────────────────────────────────────

function deduplicateFindings(gap: GapAnalysis): GapAnalysis {
  const dvItems = gap.data_verification || [];
  const phItems = gap.placeholder_items || [];

  const dedupedDv: DataVerification[] = [];
  const seenRootCauses = new Map<string, DataVerification>();

  for (const item of dvItems) {
    const key = item.root_cause_id || item.claim;
    const existing = seenRootCauses.get(key);
    if (existing) {
      const tierRank: Record<string, number> = { fatal: 0, deficiency: 1, weakness: 2, enhancement: 3 };
      const existingRank = tierRank[existing.severity_tier || 'enhancement'] ?? 3;
      const newRank = tierRank[item.severity_tier || 'enhancement'] ?? 3;
      if (newRank < existingRank) {
        const idx = dedupedDv.indexOf(existing);
        if (idx >= 0) dedupedDv[idx] = item;
        seenRootCauses.set(key, item);
      }
    } else {
      dedupedDv.push(item);
      seenRootCauses.set(key, item);
    }
  }

  const dvClaims = new Set(dedupedDv.map(d => d.claim.toLowerCase()));
  const dedupedPh = phItems.filter(p => !dvClaims.has(p.placeholder_text.toLowerCase()));

  return { ...gap, data_verification: dedupedDv, placeholder_items: dedupedPh };
}

const ALL_EXTRACTION_CATEGORIES: ExtractionCategory[] = [
  'section_l', 'section_m', 'admin_data', 'rating_scales', 'sow_pws',
  'cost_price', 'past_performance', 'key_personnel', 'security_reqs',
  'operational_context', 'technology_reqs',
];

export const touchupScorer = inngest.createFunction(
  { id: 'touchup-scorer' },
  { event: 'proposal.touchup.score' },
  async ({ event, step }) => {
    const rawData = event.data as {
      solicitationId: string;
      companyId: string;
      draftId: string;
      touchupId: string;
      touchupVolumeId: string;
      scoreVersion?: 'draft' | 'touchup';
      scoreVersionNumber?: string | number;
    };
    const { solicitationId, companyId, touchupVolumeId, scoreVersion = 'draft' } = rawData;
    const scoreVersionNumber = rawData.scoreVersionNumber ? Number(rawData.scoreVersionNumber) : undefined;

    await logPipelineEvent(solicitationId, 'touchup-score-volume', 'started', {
      touchup_volume_id: touchupVolumeId,
      score_version: scoreVersion,
      score_version_number: scoreVersionNumber ?? 'latest',
    });

    // ─── Step 1: Fetch all data needed for scoring ────────────────────────
    const fetchResult = await step.run('fetch-data', async () => {
      const supabase = getServerClient();

      const { data: touchupVol } = await supabase
        .from('touchup_volumes')
        .select('*, original_volume_id, volume_name, volume_order, status, content_markdown')
        .eq('id', touchupVolumeId)
        .single();

      if (!touchupVol) throw new Error(`Touchup volume not found: ${touchupVolumeId}`);
      if (touchupVol.status === 'scoring') {
        console.warn(`[touchup-scorer] Volume "${touchupVol.volume_name}" already scoring, proceeding (likely retry)`);
      }

      const { data: draftVol } = await supabase
        .from('draft_volumes')
        .select('content_markdown, page_limit')
        .eq('id', touchupVol.original_volume_id)
        .single();

      if (!draftVol?.content_markdown) throw new Error(`Draft volume has no content: ${touchupVol.original_volume_id}`);

      // Pick which content to score based on scoreVersion + scoreVersionNumber
      let contentToScore = draftVol.content_markdown as string;
      let scoringLabel = 'original draft';

      if (scoreVersion === 'touchup') {
        if (scoreVersionNumber && scoreVersionNumber < (touchupVol.version_number as number || 1)) {
          // Historical version — read from touchup_volume_versions
          const { data: histVersion } = await supabase
            .from('touchup_volume_versions')
            .select('content_markdown')
            .eq('touchup_volume_id', touchupVolumeId)
            .eq('version_number', scoreVersionNumber)
            .maybeSingle();

          if (histVersion?.content_markdown) {
            contentToScore = histVersion.content_markdown as string;
            scoringLabel = `v${scoreVersionNumber}`;
          } else {
            console.warn(`[touchup-scorer] No content for v${scoreVersionNumber}, falling back to latest touchup`);
            if (touchupVol.content_markdown) {
              contentToScore = touchupVol.content_markdown as string;
              scoringLabel = `v${touchupVol.version_number} (latest)`;
            }
          }
        } else if (touchupVol.content_markdown) {
          // Current/latest version
          contentToScore = touchupVol.content_markdown as string;
          scoringLabel = `v${touchupVol.version_number} (latest)`;
        } else {
          console.warn(`[touchup-scorer] No touchup content for "${touchupVol.volume_name}", falling back to original draft`);
        }
      }

      const { data: company, error: companyError } = await supabase
        .from('company_profiles').select('*').eq('id', companyId).single();
      if (companyError || !company) throw new Error(`Company not found: ${companyError?.message}`);

      const { data: dataCall, error: dataCallError } = await supabase
        .from('data_call_responses').select('*')
        .eq('solicitation_id', solicitationId).eq('company_id', companyId).single();
      if (dataCallError || !dataCall) throw new Error(`Data call not found: ${dataCallError?.message}`);

      const { data: extractionRows } = await supabase
        .from('compliance_extractions')
        .select('category, field_name, field_label, field_value, confidence, is_user_override')
        .eq('solicitation_id', solicitationId).eq('extraction_status', 'completed');

      const extractionsByCategory = {} as ComplianceExtractionsByCategory;
      for (const cat of ALL_EXTRACTION_CATEGORIES) {
        extractionsByCategory[cat] = [];
      }
      for (const row of extractionRows || []) {
        const cat = row.category as ExtractionCategory;
        if (extractionsByCategory[cat]) {
          extractionsByCategory[cat].push({
            id: '', solicitation_id: solicitationId, category: cat,
            field_name: row.field_name, field_label: row.field_label || row.field_name,
            field_value: row.field_value, confidence: row.confidence,
            is_user_override: row.is_user_override, extraction_status: 'completed',
            created_at: '', updated_at: '',
          });
        }
      }

      const [
        { data: certs }, { data: pers }, { data: pp },
        { data: naics }, { data: vehicles },
        { data: dataCallFiles },
      ] = await Promise.all([
        supabase.from('certifications').select('*').eq('company_id', companyId),
        supabase.from('personnel').select('*').eq('company_id', companyId),
        supabase.from('past_performance').select('*').eq('company_id', companyId),
        supabase.from('naics_codes').select('*').eq('company_id', companyId),
        supabase.from('contract_vehicles').select('*').eq('company_id', companyId),
        supabase.from('data_call_files')
          .select('id, section, field_key, filename, extracted_text')
          .eq('data_call_response_id', dataCall.id)
          .not('extracted_text', 'is', null),
      ]);

      console.log(`[touchup-scorer] Scoring "${touchupVol.volume_name}" using ${scoringLabel} version`);

      await logPipelineEvent(solicitationId, 'touchup-scorer-fetch', 'completed', {
        volume_name: touchupVol.volume_name,
        scoring_version: scoringLabel,
        content_length: contentToScore.length,
        content_word_count: contentToScore.split(/\s+/).length,
        data_sources: {
          personnel_count: (pers || []).length,
          past_performance_count: (pp || []).length,
          certifications_count: (certs || []).length,
          extraction_categories: Object.entries(extractionsByCategory)
            .filter(([, rows]) => rows.length > 0)
            .map(([cat, rows]) => `${cat}: ${rows.length}`)
            .join(', '),
          data_call_files: (dataCallFiles || []).length,
          service_area_approaches: (dataCall as DataCallResponse).service_area_approaches?.length || 0,
          technology_selections: (dataCall as DataCallResponse).technology_selections?.length || 0,
        },
      });

      return {
        volumeName: touchupVol.volume_name as string,
        volumeOrder: touchupVol.volume_order as number,
        draftMarkdown: contentToScore,
        scoringLabel,
        companyProfile: company as CompanyProfile,
        dataCallResponse: dataCall as DataCallResponse,
        extractions: extractionsByCategory,
        personnel: pers || [],
        pastPerformance: pp || [],
        certifications: certs || [],
        contractVehicles: vehicles || [],
        naicsCodes: naics || [],
        serviceAreaApproaches: (dataCall as DataCallResponse).service_area_approaches || [],
        siteStaffing: (dataCall as DataCallResponse).site_staffing || [],
        technologySelections: (dataCall as DataCallResponse).technology_selections || [],
        dataCallFiles: dataCallFiles || [],
      };
    });

    // ─── Step 2: Snapshot previous state before overwriting ────────────────
    await step.run('snapshot-previous', async () => {
      const supabase = getServerClient();
      await snapshotVersion(supabase, touchupVolumeId, 'scored', scoreVersion);
    });

    // ─── Step 3: Score the volume ─────────────────────────────────────────
    const scoreResult = await step.run('score-volume', async () => {
      const supabase = getServerClient();
      const now = new Date().toISOString();

      try {
        await supabase.from('touchup_volumes').update({
          status: 'scoring', scoring_started_at: now, updated_at: now,
        }).eq('id', touchupVolumeId);

        // Build and filter RFP checklists for this volume
        const fullChecklists = buildRfpChecklists(fetchResult.extractions);
        const volName = fetchResult.volumeName.toLowerCase();
        const volumeTypeStr = volName.includes('technical') || volName.includes('approach') ? 'technical' :
          volName.includes('management') || volName.includes('staffing') ? 'management' :
          volName.includes('past perf') ? 'past_performance' :
          volName.includes('cost') || volName.includes('price') ? 'cost_price' : 'technical';
        const volumeChecklists = filterChecklistForVolume(fullChecklists, volumeTypeStr, fetchResult.extractions);

        const promptData: ScoringPromptData = {
          companyProfile: fetchResult.companyProfile,
          dataCallResponse: fetchResult.dataCallResponse,
          extractions: fetchResult.extractions,
          personnel: fetchResult.personnel,
          pastPerformance: fetchResult.pastPerformance,
          certifications: fetchResult.certifications,
          contractVehicles: fetchResult.contractVehicles,
          naicsCodes: fetchResult.naicsCodes,
          serviceAreaApproaches: fetchResult.serviceAreaApproaches,
          siteStaffing: fetchResult.siteStaffing,
          technologySelections: fetchResult.technologySelections,
          dataCallFiles: fetchResult.dataCallFiles,
          rfpChecklists: volumeChecklists,
        };

        const { systemPrompt, userPrompt } = assembleScorePrompt(
          fetchResult.volumeName, fetchResult.draftMarkdown, promptData
        );

        const stream = anthropic.messages.stream({
          model: MODEL,
          max_tokens: 32768,
          temperature: 0.1,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        });
        const response = await stream.finalMessage();

        if (response.stop_reason === 'max_tokens') {
          console.warn(`[touchup-scorer] "${fetchResult.volumeName}" hit max_tokens — attempting repair`);
        }

        const responseText = response.content
          .filter(b => b.type === 'text')
          .map(b => (b as { type: 'text'; text: string }).text)
          .join('\n');

        const rawGapAnalysis = parseClaudeJSON<GapAnalysis & { compliance_score: number }>(responseText);

        // Post-processing pipeline: dedup → validate scorer output → effort → score cap
        const dedupedGap = deduplicateFindings(rawGapAnalysis);

        // Layer 2: Validate scorer findings against actual source data
        const validationCtx: ScorerValidationContext = {
          draftMarkdown: fetchResult.draftMarkdown,
          companyProfile: fetchResult.companyProfile,
          dataCallResponse: fetchResult.dataCallResponse,
          extractions: fetchResult.extractions,
          personnel: fetchResult.personnel,
          pastPerformance: fetchResult.pastPerformance,
          certifications: fetchResult.certifications,
          rfpChecklists: volumeChecklists,
          volumeType: volumeTypeStr,
        };
        const { validatedGap: checkedGap, dropped, summary: validationSummary } = validateScorerOutput(
          { ...dedupedGap, compliance_score: rawGapAnalysis.compliance_score },
          validationCtx
        );

        if (dropped.length > 0) {
          console.warn(`[touchup-scorer] Scorer validator: ${validationSummary}`);
          await logPipelineEvent(solicitationId, 'scorer-validation', 'warning', {
            volume_name: fetchResult.volumeName,
            dropped_count: dropped.length,
            dropped_findings: dropped.map(d => ({
              type: d.type,
              reason: d.reason,
            })),
            summary: validationSummary,
          });
        } else {
          await logPipelineEvent(solicitationId, 'scorer-validation', 'completed', {
            volume_name: fetchResult.volumeName,
            result: 'All scorer findings validated — no hallucinations detected',
          });
        }

        const effortEstimate = calculateHumanEffort(checkedGap);
        const gapAnalysis: GapAnalysis & { compliance_score: number } = {
          ...checkedGap,
          compliance_score: checkedGap.compliance_score,
          human_effort_estimate: effortEstimate,
        };

        const complianceScore = applyScoreCaps(gapAnalysis.compliance_score ?? 0, gapAnalysis);
        const fabricationFlags = gapAnalysis.data_verification?.filter(d => d.source === 'fabricated') || [];
        const placeholderCount = gapAnalysis.placeholder_items?.length || 0;

        const scorerValidation = dropped.length > 0
          ? { dropped_count: dropped.length, findings: dropped.map(d => ({ type: d.type, reason: d.reason })) }
          : null;

        await supabase.from('touchup_volumes').update({
          status: 'scored',
          compliance_score: complianceScore,
          gap_analysis: gapAnalysis as unknown as Record<string, unknown>,
          fabrication_flags: fabricationFlags as unknown as Record<string, unknown>[],
          placeholder_count: placeholderCount,
          scorer_validation: scorerValidation as unknown as Record<string, unknown> | null,
          scoring_completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', touchupVolumeId);

        console.log(`[touchup-scorer] "${fetchResult.volumeName}": ${complianceScore}/100 (raw: ${rawGapAnalysis.compliance_score}), effort: ${effortEstimate.total_hours}h, ${gapAnalysis.requirements_coverage?.filter(r => r.status === 'missing').length || 0} missing reqs, ${dropped.length} scorer findings dropped`);

        const missingReqs = gapAnalysis.requirements_coverage?.filter(r => r.status === 'missing') || [];
        const partialReqs = gapAnalysis.requirements_coverage?.filter(r => r.status === 'partial') || [];
        const fatalFindings = (gapAnalysis.data_verification || []).filter(d => d.severity_tier === 'fatal');
        const deficiencyFindings = (gapAnalysis.data_verification || []).filter(d => d.severity_tier === 'deficiency');

        await logPipelineEvent(solicitationId, 'touchup-score-volume', 'completed', {
          volume_name: fetchResult.volumeName,
          compliance_score: complianceScore,
          raw_score: rawGapAnalysis.compliance_score,
          score_capped: complianceScore !== rawGapAnalysis.compliance_score,
          findings_summary: {
            total_data_verification: (gapAnalysis.data_verification || []).length,
            fatal: fatalFindings.length,
            deficiency: deficiencyFindings.length,
            fabrication_flags: fabricationFlags.length,
            placeholder_count: placeholderCount,
            missing_requirements: missingReqs.length,
            partial_requirements: partialReqs.length,
            scorer_findings_dropped: dropped.length,
          },
          human_effort_estimate: {
            total_hours: effortEstimate.total_hours,
            pass_fail: effortEstimate.pass_fail,
            breakdown: effortEstimate.by_category,
          },
          fatal_items: fatalFindings.map(f => f.claim.slice(0, 120)),
          missing_requirement_ids: missingReqs.map(r => r.requirement_id),
        });

        return { complianceScore, gapAnalysis };
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`[touchup-scorer] "${fetchResult.volumeName}" failed:`, errMsg);

        await logPipelineEvent(solicitationId, 'touchup-score-volume', 'failed', {
          volume_name: fetchResult.volumeName,
          error: errMsg,
          error_type: err instanceof Error ? err.constructor.name : 'Unknown',
        });

        await supabase.from('touchup_volumes').update({
          status: 'failed',
          error_message: errMsg,
          scoring_completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', touchupVolumeId);

        throw err;
      }
    });

    return {
      touchupVolumeId,
      volumeName: fetchResult.volumeName,
      complianceScore: scoreResult.complianceScore,
    };
  }
);
