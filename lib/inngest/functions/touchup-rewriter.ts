/**
 * Touchup Rewriter — Per-Volume Inngest Function
 *
 * Triggered by: 'proposal.touchup.rewrite'
 * Payload: { solicitationId, companyId, draftId, touchupId, touchupVolumeId }
 *
 * Rewrites a single volume using the gap analysis from scoring, then runs
 * regression guard to keep the best version of each section. Generates DOCX.
 *
 * Uses Claude Sonnet 4.6 via streaming transport:
 *   Rewrite:          messages.stream() — 32768 max_tokens, temp 0.3
 *   Regression Guard: messages.stream() — 8192 max_tokens, temp 0.1
 *
 * On success: sets touchup_volume status to 'completed' with content + DOCX.
 * On failure: sets touchup_volume status to 'failed' with error_message.
 */

import { inngest } from '../client';
import { getServerClient } from '@/lib/supabase/client';
import { anthropic, MODEL } from '@/lib/anthropic/client';
import { parseClaudeJSON } from '@/lib/anthropic/json-extractor';
import { assembleTouchupPrompt, type RewritePromptData } from '@/lib/generation/touchup/rewrite-prompt';
import {
  splitMarkdownIntoSections,
  alignSections,
  assembleRegressionGuardPrompt,
  applyRegressionGuard,
  type RegressionGuardScores,
} from '@/lib/generation/touchup/regression-guard-prompt';
import {
  generateProposalVolume,
  saveDocxToBuffer,
} from '@/lib/generation/docx/generator';
import { parseMarkdownToDocx } from '@/lib/generation/docx/markdown-parser';
import { buildColorPalette } from '@/lib/generation/docx/colors';
import {
  embedAiDiagrams,
  findDiagramInsertionPoint,
  findContentInsertionIndex,
} from '@/lib/generation/docx/diagram-embedder';
import type { DiagramSpec } from '@/lib/generation/exhibits/diagram-types';
import { snapshotVersion } from '@/lib/supabase/touchup-version-helper';
import { logPipelineEvent } from '@/lib/logging/pipeline-logger';
import type { CompanyProfile } from '@/lib/supabase/company-types';
import type { DataCallResponse } from '@/lib/supabase/tier2-types';
import type {
  ComplianceExtractionsByCategory,
  ExtractionCategory,
  SectionMFields,
} from '@/lib/supabase/compliance-types';
import type { GapAnalysis } from '@/lib/supabase/touchup-types';
import { validateGeneratedContent, type ContentValidationData } from '@/lib/generation/pipeline/content-validator';
import { buildRfpChecklists, filterChecklistForVolume } from '@/lib/generation/pipeline/soo-checklist-builder';

const WORDS_PER_PAGE = 250;

const ALL_EXTRACTION_CATEGORIES: ExtractionCategory[] = [
  'section_l', 'section_m', 'admin_data', 'rating_scales', 'sow_pws',
  'cost_price', 'past_performance', 'key_personnel', 'security_reqs',
  'operational_context', 'technology_reqs',
];

function sanitizeStoragePath(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function calculatePageLimitStatus(
  pageEstimate: number,
  pageLimit: number | null
): 'under' | 'warning' | 'over' {
  if (!pageLimit) return 'under';
  if (pageEstimate < pageLimit * 0.85) return 'under';
  if (pageEstimate <= pageLimit) return 'warning';
  return 'over';
}

function deriveVolumeTypeForGenerator(volumeName: string): string {
  const name = volumeName.toLowerCase();
  if (name.includes('technical') || name.includes('approach')) return 'technical';
  if (name.includes('management') || name.includes('staffing') || name.includes('transition')) return 'management';
  if (name.includes('past perf') || name.includes('past performance')) return 'past_performance';
  if (name.includes('cost') || name.includes('price')) return 'price';
  return 'technical';
}

export const touchupRewriter = inngest.createFunction(
  { id: 'touchup-rewriter' },
  { event: 'proposal.touchup.rewrite' },
  async ({ event, step }) => {
    const { solicitationId, companyId, touchupVolumeId } = event.data as {
      solicitationId: string;
      companyId: string;
      draftId: string;
      touchupId: string;
      touchupVolumeId: string;
    };

    await logPipelineEvent(solicitationId, 'touchup-rewrite-volume', 'started', {
      touchup_volume_id: touchupVolumeId,
    });

    // ─── Step 1: Fetch data + gap analysis ────────────────────────────────
    const fetchResult = await step.run('fetch-data', async () => {
      const supabase = getServerClient();

      const { data: touchupVol } = await supabase
        .from('touchup_volumes')
        .select('*')
        .eq('id', touchupVolumeId)
        .single();

      if (!touchupVol) throw new Error(`Touchup volume not found: ${touchupVolumeId}`);
      if (!touchupVol.gap_analysis) throw new Error(`No gap analysis for volume: ${touchupVol.volume_name}`);

      const { data: draftVol } = await supabase
        .from('draft_volumes')
        .select('content_markdown, page_limit, diagram_specs')
        .eq('id', touchupVol.original_volume_id)
        .single();

      if (!draftVol?.content_markdown) throw new Error(`Draft volume has no content: ${touchupVol.original_volume_id}`);

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

      const { data: solicitation } = await supabase
        .from('solicitations').select('solicitation_number, title, agency')
        .eq('id', solicitationId).maybeSingle();

      const [
        { data: certs }, { data: pers }, { data: pp },
        { data: naics }, { data: vehicles },
        { data: dataCallFiles },
        { data: strategyRow },
        { data: smeRows },
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
        supabase.from('solicitation_strategies').select('*')
          .eq('solicitation_id', solicitationId).eq('company_id', companyId).maybeSingle(),
        supabase.from('sme_contributions').select('*')
          .eq('solicitation_id', solicitationId).eq('company_id', companyId).eq('approved', true),
      ]);

      const previousRewriteMarkdown = touchupVol.content_markdown as string | null;
      const versionNumber = (touchupVol.version_number as number) || 1;

      return {
        volumeName: touchupVol.volume_name as string,
        volumeOrder: touchupVol.volume_order as number,
        versionNumber,
        draftMarkdown: draftVol.content_markdown as string,
        previousRewriteMarkdown,
        pageLimit: draftVol.page_limit as number | null,
        diagramSpecs: (draftVol as Record<string, unknown>).diagram_specs as unknown[] || [],
        gapAnalysis: touchupVol.gap_analysis as unknown as GapAnalysis,
        complianceScore: (touchupVol.compliance_score as number | null) ?? undefined,
        companyProfile: company as CompanyProfile,
        dataCallResponse: dataCall as DataCallResponse,
        extractions: extractionsByCategory,
        solicitation: solicitation as { solicitation_number: string; title: string; agency: string } | null,
        personnel: pers || [],
        pastPerformance: pp || [],
        certifications: certs || [],
        contractVehicles: vehicles || [],
        naicsCodes: naics || [],
        serviceAreaApproaches: (dataCall as DataCallResponse).service_area_approaches || [],
        siteStaffing: (dataCall as DataCallResponse).site_staffing || [],
        technologySelections: (dataCall as DataCallResponse).technology_selections || [],
        dataCallFiles: dataCallFiles || [],
        strategy: strategyRow ?? null,
        smeContributions: smeRows || [],
      };
    });

    await logPipelineEvent(solicitationId, 'touchup-rewriter-fetch', 'completed', {
      volume_name: fetchResult.volumeName,
      compliance_score: fetchResult.complianceScore,
      gap_analysis_present: !!fetchResult.gapAnalysis,
      gap_findings_count: {
        data_verification: fetchResult.gapAnalysis?.data_verification?.length || 0,
        requirements_coverage: fetchResult.gapAnalysis?.requirements_coverage?.length || 0,
        missing_content: fetchResult.gapAnalysis?.missing_content?.length || 0,
        placeholder_items: fetchResult.gapAnalysis?.placeholder_items?.length || 0,
      },
      has_previous_rewrite: !!fetchResult.previousRewriteMarkdown,
      content_length: fetchResult.draftMarkdown.length,
    });

    // ─── Step 2: Snapshot previous state before overwriting ────────────────
    const newVersion = await step.run('snapshot-previous', async () => {
      const supabase = getServerClient();
      return snapshotVersion(supabase, touchupVolumeId, 'rewritten');
    });

    // ─── Step 3: Rewrite the volume ───────────────────────────────────────
    const rewriteResult = await step.run('rewrite-volume', async () => {
      const supabase = getServerClient();
      const now = new Date().toISOString();

      await supabase.from('touchup_volumes').update({
        status: 'rewriting', rewriting_started_at: now, updated_at: now,
      }).eq('id', touchupVolumeId);

      try {
        // Build and filter RFP checklists for this volume
        const fullChecklists = buildRfpChecklists(fetchResult.extractions);
        const volNameLower = fetchResult.volumeName.toLowerCase();
        const volumeTypeStr = volNameLower.includes('technical') || volNameLower.includes('approach') ? 'technical' :
          volNameLower.includes('management') || volNameLower.includes('staffing') ? 'management' :
          volNameLower.includes('past perf') ? 'past_performance' :
          volNameLower.includes('cost') || volNameLower.includes('price') ? 'cost_price' : 'technical';
        const volumeChecklists = filterChecklistForVolume(fullChecklists, volumeTypeStr, fetchResult.extractions);

        const promptData: RewritePromptData = {
          companyProfile: fetchResult.companyProfile,
          dataCallResponse: fetchResult.dataCallResponse,
          extractions: fetchResult.extractions,
          personnel: fetchResult.personnel,
          pastPerformance: fetchResult.pastPerformance,
          certifications: fetchResult.certifications,
          contractVehicles: fetchResult.contractVehicles,
          naicsCodes: fetchResult.naicsCodes,
          pageLimit: fetchResult.pageLimit,
          serviceAreaApproaches: fetchResult.serviceAreaApproaches,
          siteStaffing: fetchResult.siteStaffing,
          technologySelections: fetchResult.technologySelections,
          dataCallFiles: fetchResult.dataCallFiles,
          rfpChecklists: volumeChecklists,
          strategy: fetchResult.strategy,
          smeContributions: fetchResult.smeContributions,
        };

        const { systemPrompt, userPrompt } = assembleTouchupPrompt(
          fetchResult.volumeName, fetchResult.draftMarkdown, fetchResult.gapAnalysis, promptData,
          fetchResult.complianceScore
        );

        const stream = anthropic.messages.stream({
          model: MODEL,
          max_tokens: 32768,
          temperature: 0.3,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        });
        const response = await stream.finalMessage();

        if (response.stop_reason === 'max_tokens') {
          console.warn(`[touchup-rewriter] Rewrite for "${fetchResult.volumeName}" hit max_tokens`);
        }

        const rewrittenMarkdown = response.content
          .filter(b => b.type === 'text')
          .map(b => (b as { type: 'text'; text: string }).text)
          .join('\n');

        if (!rewrittenMarkdown || rewrittenMarkdown.trim().length < 50) {
          throw new Error('Claude returned empty or insufficient rewrite content');
        }

        return { rewrittenMarkdown };
      } catch (err) {
        // Mark volume as failed so UI stops polling and shows retry
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`[touchup-rewriter] Rewrite step failed for "${fetchResult.volumeName}":`, errMsg);

        await supabase.from('touchup_volumes').update({
          status: 'failed',
          error_message: `Rewrite failed: ${errMsg}`,
          rewriting_completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', touchupVolumeId);

        await logPipelineEvent(solicitationId, 'touchup-rewrite-volume', 'failed', {
          volume_name: fetchResult.volumeName,
          error: errMsg,
          step: 'rewrite-volume',
        });

        throw err;
      }
    });

    // ─── Step 3b: Layer 3 — Post-rewrite content validation ────────────────
    // Build checklists for post-rewrite validation (same as used in rewrite-volume step)
    const postRewriteChecklists = (() => {
      const fullCl = buildRfpChecklists(fetchResult.extractions);
      const vnLower = fetchResult.volumeName.toLowerCase();
      const vType = vnLower.includes('technical') || vnLower.includes('approach') ? 'technical' :
        vnLower.includes('management') || vnLower.includes('staffing') ? 'management' :
        vnLower.includes('past perf') ? 'past_performance' :
        vnLower.includes('cost') || vnLower.includes('price') ? 'cost_price' : 'technical';
      return filterChecklistForVolume(fullCl, vType, fetchResult.extractions);
    })();

    const validatedRewrite = (() => {
      const cvData: ContentValidationData = {
        keyPersonnel: (fetchResult.dataCallResponse.key_personnel || []) as { name: string; role: string }[],
        personnel: fetchResult.personnel as ContentValidationData['personnel'],
        pastPerformance: fetchResult.pastPerformance as ContentValidationData['pastPerformance'],
        complianceVerification: fetchResult.dataCallResponse.compliance_verification as unknown as Record<string, unknown> | null,
        technologySelections: (fetchResult.dataCallResponse.technology_selections || []) as ContentValidationData['technologySelections'],
        serviceAreaApproaches: (fetchResult.dataCallResponse.service_area_approaches || []) as ContentValidationData['serviceAreaApproaches'],
        dataCallResponse: fetchResult.dataCallResponse,
        rfpChecklists: postRewriteChecklists,
        volumeType: fetchResult.volumeName,
      };
      const result = validateGeneratedContent(rewriteResult.rewrittenMarkdown, cvData);
      if (result.warnings.length > 0) {
        console.warn(`[touchup-rewriter] Post-rewrite validation for "${fetchResult.volumeName}": ${result.warnings.length} warnings, ${result.autoCorrections} auto-corrections`);
        logPipelineEvent(solicitationId, 'rewrite-validation', 'warning', {
          volume_name: fetchResult.volumeName,
          warning_count: result.warnings.length,
          auto_corrections: result.autoCorrections,
          warnings_by_check: result.warnings.reduce((acc, w) => {
            acc[w.check] = (acc[w.check] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
          error_warnings: result.warnings
            .filter(w => w.severity === 'error')
            .map(w => `[${w.check}] ${w.message}`),
        });
      } else {
        logPipelineEvent(solicitationId, 'rewrite-validation', 'completed', {
          volume_name: fetchResult.volumeName,
          result: 'Post-rewrite validation passed — no issues detected',
          auto_corrections: 0,
        });
      }
      return result;
    })();

    // ─── Step 4: Regression guard + DOCX generation ───────────────────────
    const guardResult = await step.run('regression-guard', async () => {
      const supabase = getServerClient();

      try {
        // Progressive regression guard (Blind Spot 4):
        // Compare against previous rewrite if one exists, otherwise original draft.
        const baselineMarkdown = fetchResult.previousRewriteMarkdown || fetchResult.draftMarkdown;
        const baselineLabel = fetchResult.previousRewriteMarkdown ? 'previous rewrite' : 'original draft';
        console.log(`[touchup-rewriter] Regression guard comparing against ${baselineLabel}`);

        const draft1Sections = splitMarkdownIntoSections(baselineMarkdown);
        const touchupSections = splitMarkdownIntoSections(validatedRewrite.correctedMarkdown);
        const pairs = alignSections(draft1Sections, touchupSections);
        const comparablePairs = pairs.filter(p => p.draft1 && p.touchup);

        let guardScores: RegressionGuardScores;

        if (comparablePairs.length > 0) {
          const { systemPrompt, userPrompt } = assembleRegressionGuardPrompt(
            fetchResult.volumeName, pairs
          );

          const stream = anthropic.messages.stream({
            model: MODEL,
            max_tokens: 8192,
            temperature: 0.1,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
          });
          const response = await stream.finalMessage();

          if (response.stop_reason === 'max_tokens') {
            console.warn(`[touchup-rewriter] Regression guard for "${fetchResult.volumeName}" hit max_tokens`);
          }

          const responseText = response.content
            .filter(b => b.type === 'text')
            .map(b => (b as { type: 'text'; text: string }).text)
            .join('\n');

          guardScores = parseClaudeJSON<RegressionGuardScores>(responseText);
        } else {
          guardScores = { section_scores: [] };
        }

        const { finalMarkdown, reversions } = applyRegressionGuard(pairs, guardScores);

        await logPipelineEvent(solicitationId, 'regression-guard', 'completed', {
          volume_name: fetchResult.volumeName,
          baseline: fetchResult.previousRewriteMarkdown ? 'previous rewrite' : 'original draft',
          sections_compared: comparablePairs.length,
          total_sections: pairs.length,
          reversions: reversions.length,
          reverted_sections: reversions.map(r =>
            `${r.section_title}: ${r.reason}`
          ),
          section_scores: guardScores.section_scores?.map(s => {
            const aTotal = s.version_a.compliance_coverage + s.version_a.data_accuracy + s.version_a.detail_specificity + s.version_a.compliance_language;
            const bTotal = s.version_b.compliance_coverage + s.version_b.data_accuracy + s.version_b.detail_specificity + s.version_b.compliance_language;
            return `${s.section_title}: baseline=${aTotal} vs rewrite=${bTotal}`;
          }) || [],
        });

        const wordCount = finalMarkdown.split(/\s+/).filter(w => w.length > 0).length;
        const pageEstimate = Math.round((wordCount / WORDS_PER_PAGE) * 10) / 10;
        const pageLimitStatus = calculatePageLimitStatus(pageEstimate, fetchResult.pageLimit);
        const humanInputCount = (finalMarkdown.match(/\[HUMAN INPUT REQUIRED/g) || []).length;

        // Generate DOCX
        const colorPalette = buildColorPalette(
          fetchResult.companyProfile.primary_color,
          fetchResult.companyProfile.secondary_color
        );
        const contentStructure = parseMarkdownToDocx(finalMarkdown, colorPalette);

        // Re-embed diagrams from the original draft volume
        if (fetchResult.diagramSpecs && fetchResult.diagramSpecs.length > 0 && contentStructure.sections) {
          try {
            const specs = fetchResult.diagramSpecs as DiagramSpec[];
            const embeddedDiagrams = await embedAiDiagrams(specs, colorPalette);
            for (const diagram of embeddedDiagrams) {
              const sectionIdx = findDiagramInsertionPoint(
                diagram.placement?.sectionKeywords || [],
                diagram.id,
                contentStructure.sections
              );
              if (sectionIdx < contentStructure.sections.length) {
                const section = contentStructure.sections[sectionIdx];
                const contentIdx = findContentInsertionIndex(
                  section,
                  diagram.placement?.sectionKeywords || [],
                  diagram.id
                );
                section.content.splice(contentIdx, 0, ...diagram.elements);
              }
            }
            console.log(`[touchup-rewriter] Re-embedded ${embeddedDiagrams.length} diagram(s) in "${fetchResult.volumeName}"`);
          } catch (diagramErr) {
            console.warn(`[touchup-rewriter] Diagram re-embedding failed for "${fetchResult.volumeName}":`, diagramErr);
            // Non-fatal — volume generates without diagrams
          }
        }

        const volumeType = deriveVolumeTypeForGenerator(fetchResult.volumeName);

        const sectionMExtraction = fetchResult.extractions.section_m || [];
        const sectionMFields = sectionMExtraction.length > 0
          ? (sectionMExtraction[0].field_value as SectionMFields) || {}
          : {};

        const requirements = (sectionMFields.evaluation_factors || []).flatMap((factor, fi) => {
          const items: Array<{ id: string; requirement_number: string; requirement_text: string; source_section: string }> = [];
          items.push({
            id: `factor-${fi}`,
            requirement_number: `M.${fi + 1}`,
            requirement_text: factor.name + (factor.weight_description ? ` (${factor.weight_description})` : ''),
            source_section: 'Section M',
          });
          (factor.subfactors || []).forEach((sf, si) => {
            items.push({
              id: `factor-${fi}-sub-${si}`,
              requirement_number: `M.${fi + 1}.${si + 1}`,
              requirement_text: sf.name + (sf.description ? `: ${sf.description}` : ''),
              source_section: 'Section M',
            });
          });
          return items;
        });

        const sectionMappings = (contentStructure.sections || []).map((section: { title: string }) => ({
          sectionName: section.title,
          requirements: requirements.map(r => r.id),
        }));

        const companyData = {
          profile: fetchResult.companyProfile,
          valuePropositions: (fetchResult.companyProfile.enterprise_win_themes || []).map((t: string) => ({ statement: t })),
          personnel: fetchResult.personnel || [],
          certifications: fetchResult.certifications || [],
          pastPerformance: fetchResult.pastPerformance || [],
          naicsCodes: fetchResult.naicsCodes || [],
          contractVehicles: fetchResult.contractVehicles || [],
        };

        const documentContext = {
          solicitation_number: fetchResult.solicitation?.solicitation_number || 'TBD',
          metadata: {
            contracting_officer: 'Contracting Officer',
            agency: fetchResult.solicitation?.agency || 'Agency',
            solicitation_number: fetchResult.solicitation?.solicitation_number || 'TBD',
          },
        };

        const docxDocument = await generateProposalVolume(
          volumeType, contentStructure, fetchResult.companyProfile,
          [], companyData, documentContext, requirements, sectionMappings, colorPalette
        );

        const docxBuffer = await saveDocxToBuffer(docxDocument);
        const sanitizedName = sanitizeStoragePath(fetchResult.volumeName);
        const versionTag = `v${newVersion}`;
        const storagePath = `touchups/${companyId}/${solicitationId}/${fetchResult.volumeOrder}_${versionTag}_${sanitizedName}.docx`;

        const { error: uploadError } = await supabase.storage
          .from('proposal-drafts')
          .upload(storagePath, docxBuffer, {
            contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            upsert: true,
          });

        const filePath = uploadError ? null : storagePath;
        if (uploadError) {
          console.warn(`[touchup-rewriter] DOCX upload failed for "${fetchResult.volumeName}":`, uploadError.message);
        }

        // Save in two steps to avoid payload size issues on large volumes:
        // Step A: Save the large content (markdown can be 100K+ chars)
        await supabase.from('touchup_volumes').update({
          content_markdown: finalMarkdown,
        }).eq('id', touchupVolumeId);

        // Step B: Save metadata + set status to completed (small payload, guaranteed to succeed)
        const { error: statusError } = await supabase.from('touchup_volumes').update({
          status: 'completed',
          file_path: filePath,
          word_count: wordCount,
          page_estimate: pageEstimate,
          page_limit_status: pageLimitStatus,
          human_input_count: humanInputCount,
          regression_reversions: reversions.length > 0 ? reversions as unknown as Record<string, unknown>[] : null,
          diagram_specs: fetchResult.diagramSpecs.length > 0 ? fetchResult.diagramSpecs : null,
          rewriting_completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', touchupVolumeId);

        // If status update fails, force it with minimal payload
        if (statusError) {
          console.error(`[touchup-rewriter] Status update failed for "${fetchResult.volumeName}": ${statusError.message}`);
          await supabase.from('touchup_volumes').update({
            status: 'completed',
            file_path: filePath,
            word_count: wordCount,
            rewriting_completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }).eq('id', touchupVolumeId);
        }

        console.log(`[touchup-rewriter] "${fetchResult.volumeName}" complete: ${wordCount} words, ${reversions.length} reversions, ${humanInputCount} human inputs`);

        await logPipelineEvent(solicitationId, 'touchup-rewrite-volume', 'completed', {
          volume_name: fetchResult.volumeName,
          version: `v${newVersion}`,
          word_count: wordCount,
          page_estimate: pageEstimate,
          page_limit: fetchResult.pageLimit,
          page_limit_status: pageLimitStatus,
          regression_reversions: reversions.length,
          human_input_tags: humanInputCount,
          post_rewrite_validation: {
            warnings: validatedRewrite.warnings.length,
            auto_corrections: validatedRewrite.autoCorrections,
          },
          docx_uploaded: !!filePath,
          file_path: filePath,
        });

        return { wordCount, pageEstimate, reversions: reversions.length, humanInputCount };
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`[touchup-rewriter] "${fetchResult.volumeName}" regression guard failed:`, errMsg);

        await logPipelineEvent(solicitationId, 'touchup-rewrite-volume', 'failed', {
          volume_name: fetchResult.volumeName,
          error: errMsg,
          error_type: err instanceof Error ? err.constructor.name : 'Unknown',
        });

        await supabase.from('touchup_volumes').update({
          status: 'failed',
          error_message: errMsg,
          rewriting_completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', touchupVolumeId);

        throw err;
      }
    });

    return {
      touchupVolumeId,
      volumeName: fetchResult.volumeName,
      ...guardResult,
    };
  }
);
