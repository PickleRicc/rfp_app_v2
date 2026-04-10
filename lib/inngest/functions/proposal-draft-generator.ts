/**
 * Proposal Draft Generator — Inngest Function
 * Phase 9 Plan 02: Draft Generation Pipeline
 *
 * Triggered by: 'proposal.draft.generate'
 * Event payload: { solicitationId: string, companyId: string, draftId: string }
 *
 * Generates one DOCX per proposal volume defined in the Section L volume structure.
 * Each volume is generated in its own Inngest step for independent error isolation.
 *
 * Steps:
 * 1. fetch-all-data              — Load Tier 1 (company_profiles), Tier 2 (data_call_responses),
 *                                   compliance extractions, and draft_volumes rows
 * 2..N. generate-volume-{order}  — Per-volume: prompt assembly → Claude → DOCX → storage
 * N+1. generate-compliance-matrix — Map Section M factors to generated volumes
 * N+2. finalize                  — Count completed/failed, update proposal_drafts status
 *
 * Error isolation:
 * A single volume failure does NOT prevent other volumes from generating.
 * Volumes update independently. Final status reflects overall outcome.
 *
 * Storage path pattern:
 *   drafts/{companyId}/{solicitationId}/{volume_order}_{sanitized_name}.docx
 *
 * Per CONTEXT.md decisions:
 * - Word count heuristic: 250 words/page (single-spaced)
 * - Page limit targeting: 85-90% (using 87.5% midpoint via assembleVolumePrompt)
 * - Partial success (some volumes completed, some failed) → overall status='completed'
 * - Compliance matrix stored as content_markdown only (no DOCX) at volume_order=999
 */

import { inngest } from '../client';
import { getServerClient } from '@/lib/supabase/client';
import { anthropic, MODEL } from '@/lib/anthropic/client';
import {
  assembleVolumePrompt,
  assembleComplianceMatrixData,
  type VolumePromptData,
} from '@/lib/generation/draft/prompt-assembler';
import {
  generateProposalVolume,
  saveDocxToBuffer,
} from '@/lib/generation/docx/generator';
import { parseMarkdownToDocx } from '@/lib/generation/docx/markdown-parser';
import {
  validateComplianceLanguage,
} from '@/lib/generation/content/compliance-language';
import { buildColorPalette } from '@/lib/generation/docx/colors';
import { autoFillPlaceholders } from '@/lib/generation/pipeline/auto-fill-pass';
import { generateCostPriceWorkbook, extractLaborCategories } from '@/lib/generation/excel/cost-price-workbook';
import { runPostGenerationValidation } from '@/lib/generation/pipeline/cert-validator';
import { validateGeneratedContent, type ContentValidationData } from '@/lib/generation/pipeline/content-validator';
import {
  embedAiDiagrams,
  findDiagramInsertionPoint,
  findContentInsertionIndex,
} from '@/lib/generation/docx/diagram-embedder';
import {
  generateDiagramSpecs,
  extractRfpDiagramRequirements,
  extractStrategyDiagramRequests,
} from '@/lib/generation/exhibits/diagram-spec-generator';
import type { DiagramSpec } from '@/lib/generation/exhibits/diagram-types';
import type { CompanyProfile } from '@/lib/supabase/company-types';
import type { DataCallResponse } from '@/lib/supabase/tier2-types';
import type {
  ComplianceExtractionsByCategory,
  ExtractionCategory,
  SectionMFields,
} from '@/lib/supabase/compliance-types';
import type { DraftVolume } from '@/lib/supabase/draft-types';
import { logPipelineEvent } from '@/lib/logging/pipeline-logger';
import { buildRfpChecklists, filterChecklistForVolume } from '@/lib/generation/pipeline/soo-checklist-builder';

// ===== CONSTANTS =====

/** Words per page at single spacing — used for page estimate heuristic */
const WORDS_PER_PAGE = 250;

/** All valid extraction categories (used to build ComplianceExtractionsByCategory) */
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

// ===== HELPERS =====

/**
 * Log a processing event to the processing_logs table.
 * Silently swallows errors — logging should never block pipeline progress.
 */
async function logProcessingEvent(
  stage: string,
  status: 'started' | 'completed' | 'failed',
  metadata: Record<string, unknown>
): Promise<void> {
  try {
    const supabase = getServerClient();
    await supabase.from('processing_logs').insert({
      document_id: null, // Draft generation is not document-scoped
      stage,
      status,
      metadata,
    });
  } catch {
    // Non-blocking — logging failures don't affect pipeline
  }
}

/**
 * Sanitize a volume name for use in a Supabase storage file path.
 * Replaces spaces and non-alphanumeric characters with underscores, lowercases.
 * Example: "Technical Approach" → "technical_approach"
 */
function sanitizeStoragePath(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Derive a volumeType string for the DOCX generator from a volume name.
 * The generator uses 'technical', 'management', 'past_performance', 'price'.
 * This maps our volume names to those canonical types.
 */
function deriveVolumeTypeForGenerator(volumeName: string): string {
  const name = volumeName.toLowerCase();

  if (name.includes('technical') || name.includes('approach')) return 'technical';
  if (name.includes('management') || name.includes('staffing') || name.includes('transition')) return 'management';
  if (name.includes('past perf') || name.includes('past performance')) return 'past_performance';
  if (name.includes('cost') || name.includes('price')) return 'price';

  return 'technical'; // safe default — the generator handles unknown types gracefully
}

// markdownToContentStructure removed — replaced by parseMarkdownToDocx() from markdown-parser.ts
// which produces styled Paragraph/Table objects instead of plain strings.

/**
 * Calculate page_limit_status based on page estimate vs. page limit.
 * Matches the CHECK constraint and color-coding in CONTEXT.md.
 */
function calculatePageLimitStatus(
  pageEstimate: number,
  pageLimit: number | null
): 'under' | 'warning' | 'over' {
  if (!pageLimit) return 'under'; // No limit specified — always green

  if (pageEstimate < pageLimit * 0.85) return 'under';  // Below 85% — green
  if (pageEstimate <= pageLimit) return 'warning';       // 85-100% — yellow
  return 'over';                                          // Exceeds limit — red
}

/**
 * Generate a simple markdown compliance matrix table from the compliance matrix entries.
 * Format: Evaluation Factor | Weight | Volume | Subfactors | Status
 */
function generateComplianceMatrixMarkdown(
  matrixEntries: ReturnType<typeof assembleComplianceMatrixData>,
  completedVolumeNames: Set<string>,
  failedVolumeNames: Set<string>
): string {
  if (matrixEntries.length === 0) {
    return `# Compliance Matrix\n\nNo evaluation factors were extracted from Section M. Please review the solicitation's Section M directly to verify coverage.\n`;
  }

  const header = `# Compliance Matrix

This table maps each Section M evaluation factor to the proposal volume that addresses it.

| Evaluation Factor | Weight | Volume | Key Sections | Status |
|---|---|---|---|---|
`;

  const rows = matrixEntries.map(entry => {
    const subfactorList = entry.subfactors.length > 0
      ? entry.subfactors.slice(0, 3).join(', ')
      : '—';

    let status = 'Pending';
    if (completedVolumeNames.has(entry.mapped_volume)) {
      status = 'Addressed';
    } else if (failedVolumeNames.has(entry.mapped_volume)) {
      status = 'Gap (Volume Failed)';
    }

    const weight = entry.weight || '—';
    const sectionsPreview = entry.mapped_sections.slice(0, 2).join(', ');

    return `| ${entry.factor} | ${weight} | ${entry.mapped_volume} | ${sectionsPreview} | ${status} |`;
  }).join('\n');

  const footer = `\n\n---\n*Generated automatically from Section M extraction. Review each volume to verify complete coverage.*`;

  return header + rows + footer;
}

// ===== INNGEST FUNCTION =====

export const proposalDraftGenerator = inngest.createFunction(
  { id: 'proposal-draft-generator' },
  { event: 'proposal.draft.generate' },
  async ({ event, step }) => {
    const { solicitationId, companyId, draftId, strategyId, graphicsProfile } = event.data as {
      solicitationId: string;
      companyId: string;
      draftId: string;
      strategyId?: string;
      graphicsProfile?: 'minimal' | 'standard';
    };

    // ─── Step 1: Fetch all data sources ──────────────────────────────────────
    const {
      companyProfile, dataCallResponse, extractions, draftVolumes,
      solicitation, certifications, personnel, pastPerformance, naicsCodes, contractVehicles,
      dataCallFiles, strategy, smeContributions, boeAssessment, p2wAnalysis,
    } = await step.run(
      'fetch-all-data',
      async () => {
        const supabase = getServerClient();

        // Update proposal_drafts to 'generating' status
        await supabase
          .from('proposal_drafts')
          .update({
            status: 'generating',
            generation_started_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', draftId);

        // Tier 1: Fetch company profile
        const { data: company, error: companyError } = await supabase
          .from('company_profiles')
          .select('*')
          .eq('id', companyId)
          .single();

        if (companyError || !company) {
          throw new Error(`Company profile not found for companyId=${companyId}: ${companyError?.message}`);
        }

        // Tier 2: Fetch data call response
        const { data: dataCall, error: dataCallError } = await supabase
          .from('data_call_responses')
          .select('*')
          .eq('solicitation_id', solicitationId)
          .eq('company_id', companyId)
          .single();

        if (dataCallError || !dataCall) {
          throw new Error(`Data call response not found for solicitation=${solicitationId}: ${dataCallError?.message}`);
        }

        // Phase 7 extractions: fetch all categories and group by category
        const { data: extractionRows, error: extractionError } = await supabase
          .from('compliance_extractions')
          .select('category, field_name, field_label, field_value, confidence, is_user_override')
          .eq('solicitation_id', solicitationId)
          .eq('extraction_status', 'completed');

        if (extractionError) {
          throw new Error(`Failed to fetch compliance extractions: ${extractionError.message}`);
        }

        // Build ComplianceExtractionsByCategory structure
        const extractionsByCategory: ComplianceExtractionsByCategory = {} as ComplianceExtractionsByCategory;

        // Initialize all categories with empty arrays
        for (const cat of ALL_EXTRACTION_CATEGORIES) {
          extractionsByCategory[cat] = [];
        }

        // Populate from database rows
        for (const row of extractionRows || []) {
          const cat = row.category as ExtractionCategory;
          if (extractionsByCategory[cat]) {
            extractionsByCategory[cat].push({
              id: '',
              solicitation_id: solicitationId,
              category: cat,
              field_name: row.field_name,
              field_label: row.field_label || row.field_name,
              field_value: row.field_value,
              confidence: row.confidence,
              is_user_override: row.is_user_override,
              extraction_status: 'completed',
              created_at: '',
              updated_at: '',
            });
          }
        }

        // Fetch actual solicitation number for DOCX headers
        const { data: solicitation } = await supabase
          .from('solicitations')
          .select('solicitation_number, title, agency')
          .eq('id', solicitationId)
          .maybeSingle();

        // Fetch Tier 1 collections, strategy, SME contributions, BOE, and P2W in parallel
        const [
          { data: certifications },
          { data: personnel },
          { data: pastPerformance },
          { data: naicsCodes },
          { data: contractVehicles },
          { data: dataCallFiles },
          { data: strategyRow },
          { data: smeRows },
          { data: boeRow },
          { data: p2wRow },
        ] = await Promise.all([
          supabase.from('certifications').select('*').eq('company_id', companyId),
          supabase.from('personnel').select('*').eq('company_id', companyId),
          supabase.from('past_performance').select('*').eq('company_id', companyId),
          supabase.from('naics_codes').select('*').eq('company_id', companyId),
          supabase.from('contract_vehicles').select('*').eq('company_id', companyId),
          supabase.from('data_call_files')
            .select('id, section, field_key, filename, extracted_text')
            .eq('data_call_response_id', (dataCall as DataCallResponse).id)
            .not('extracted_text', 'is', null),
          // Strategy: load by strategyId if provided, else fall back to solicitation lookup
          strategyId
            ? supabase.from('solicitation_strategies').select('*').eq('id', strategyId).maybeSingle()
            : supabase.from('solicitation_strategies').select('*').eq('solicitation_id', solicitationId).eq('company_id', companyId).maybeSingle(),
          // SME contributions: only approved entries injected into prompts
          supabase.from('sme_contributions')
            .select('*')
            .eq('solicitation_id', solicitationId)
            .eq('company_id', companyId)
            .eq('approved', true),
          // BOE assessment for staffing model context
          supabase.from('boe_assessments')
            .select('*')
            .eq('solicitation_id', solicitationId)
            .eq('company_id', companyId)
            .maybeSingle(),
          // P2W analysis for competitive rate benchmarks
          supabase.from('p2w_analyses')
            .select('*')
            .eq('solicitation_id', solicitationId)
            .eq('company_id', companyId)
            .maybeSingle(),
        ]);

        // Fetch draft_volumes ordered by volume_order
        const { data: volumes, error: volumesError } = await supabase
          .from('draft_volumes')
          .select('*')
          .eq('draft_id', draftId)
          .order('volume_order', { ascending: true });

        if (volumesError) {
          throw new Error(`Failed to fetch draft volumes: ${volumesError.message}`);
        }

        // Log start event
        await logProcessingEvent('draft-generator', 'started', {
          solicitation_id: solicitationId,
          company_id: companyId,
          draft_id: draftId,
          volume_count: volumes?.length || 0,
        });

        // Pipeline-scoped logging
        await logPipelineEvent(solicitationId, 'fetch-all-data', 'completed', {
          output_summary: {
            volume_count: volumes?.length || 0,
            extraction_categories: Object.entries(extractionsByCategory)
              .filter(([, rows]) => rows.length > 0)
              .map(([cat, rows]) => `${cat}: ${rows.length} fields`),
            tier2_sections: {
              service_area_approaches: (dataCall as DataCallResponse).service_area_approaches?.length || 0,
              site_staffing: (dataCall as DataCallResponse).site_staffing?.length || 0,
              technology_selections: (dataCall as DataCallResponse).technology_selections?.length || 0,
            },
          },
        });

        return {
          companyProfile: company as CompanyProfile,
          dataCallResponse: dataCall as DataCallResponse,
          extractions: extractionsByCategory,
          draftVolumes: (volumes || []) as DraftVolume[],
          solicitation: solicitation as { solicitation_number: string; title: string; agency: string } | null,
          certifications: certifications || [],
          personnel: personnel || [],
          pastPerformance: pastPerformance || [],
          naicsCodes: naicsCodes || [],
          contractVehicles: contractVehicles || [],
          dataCallFiles: dataCallFiles || [],
          strategy: strategyRow ?? null,
          smeContributions: smeRows || [],
          boeAssessment: boeRow ?? null,
          p2wAnalysis: p2wRow ?? null,
        };
      }
    );

    // ─── Build RFP checklists once for all volumes ────────────────────────────
    const rfpChecklists = buildRfpChecklists(extractions);

    // ─── Build color palette once for all volumes ──────────────────────────────
    const colorPalette = buildColorPalette(
      companyProfile.primary_color,
      companyProfile.secondary_color
    );

    // ─── Steps 2..N: Generate each volume ────────────────────────────────────
    // Use a mutable array typed broadly enough to hold both success and failure shapes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const volumeResults: Array<any> = [];

    for (const volume of draftVolumes) {
      // Skip compliance matrix placeholder if it exists from a previous run
      if (volume.volume_order === 999) continue;

      const result = await step.run(`generate-volume-${volume.volume_order}`, async () => {
        const supabase = getServerClient();
        const now = new Date().toISOString();

        try {
          // Update volume status to 'generating'
          await supabase
            .from('draft_volumes')
            .update({
              status: 'generating',
              generation_started_at: now,
              updated_at: now,
            })
            .eq('id', volume.id);

          await logPipelineEvent(solicitationId, 'generate-volume', 'started', {
            volume_name: volume.volume_name,
            volume_order: volume.volume_order,
            page_limit: volume.page_limit,
          });

          // Derive volume type for checklist filtering
          const volumeTypeStr = deriveVolumeTypeForGenerator(volume.volume_name);
          const volumeChecklists = filterChecklistForVolume(rfpChecklists, volumeTypeStr, extractions);

          // Build the prompt data bundle with Tier 1 + Tier 2 v2 collections for richer prompts
          const promptData: VolumePromptData = {
            companyProfile,
            dataCallResponse,
            extractions,
            pageLimit: volume.page_limit,
            pageLimitSpacing: 'single', // Government RFP default
            personnel: personnel || [],
            pastPerformance: pastPerformance || [],
            certifications: certifications || [],
            contractVehicles: contractVehicles || [],
            naicsCodes: naicsCodes || [],
            serviceAreaApproaches: dataCallResponse.service_area_approaches || [],
            siteStaffing: dataCallResponse.site_staffing || [],
            technologySelections: dataCallResponse.technology_selections || [],
            dataCallFiles: dataCallFiles || [],
            rfpChecklists: volumeChecklists,
            strategy: strategy ?? undefined,
            smeContributions: smeContributions || [],
            boeAssessment: boeAssessment ?? null,
            p2wAnalysis: p2wAnalysis ?? null,
          };

          // Assemble volume-specific AI prompts
          const { systemPrompt, userPrompt, targetWordCount } = assembleVolumePrompt(
            volume.volume_name,
            volume.volume_order,
            promptData
          );

          // Scale max_tokens to page limit: ~1.5 tokens/word with 15% markdown overhead
          const maxTokens = volume.page_limit
            ? Math.min(32768, Math.max(8192, Math.round(volume.page_limit * 250 * 1.7)))
            : 32768;

          // Call Claude to generate content (streaming to avoid SDK timeout)
          const claudeResponse = await anthropic.messages
            .stream({
              model: MODEL,
              max_tokens: maxTokens,
              temperature: 0.3,
              system: systemPrompt,
              messages: [
                {
                  role: 'user',
                  content: userPrompt,
                },
              ],
            })
            .finalMessage();

          // Check for truncation
          if (claudeResponse.stop_reason === 'max_tokens') {
            console.warn(`[draft-generator] Volume "${volume.volume_name}" hit max_tokens limit (${maxTokens}). Output may be truncated.`);
          }

          // Extract markdown content from Claude response
          const rawMarkdown = claudeResponse.content
            .filter(block => block.type === 'text')
            .map(block => (block as { type: 'text'; text: string }).text)
            .join('\n');

          // Post-generation auto-fill: replace [PLACEHOLDER: ...] with available data
          const autoFillResult = autoFillPlaceholders(rawMarkdown, {
            companyProfile,
            dataCallResponse,
            extractions,
            certifications: certifications || [],
            pastPerformance: pastPerformance || [],
          });
          const contentMarkdown = autoFillResult.filledMarkdown;
          if (autoFillResult.fillCount > 0) {
            console.log(
              `[draft-generator] Auto-filled ${autoFillResult.fillCount} placeholders in "${volume.volume_name}" (${autoFillResult.remainingPlaceholders} remaining)`
            );
            await logPipelineEvent(solicitationId, 'auto-fill', 'completed', {
              volume_name: volume.volume_name,
              placeholders_filled: autoFillResult.fillCount,
              placeholders_remaining: autoFillResult.remainingPlaceholders,
            });
          }

          // Calculate word count and page estimate
          const wordCount = contentMarkdown.split(/\s+/).filter(w => w.length > 0).length;
          const pageEstimate = Math.round((wordCount / WORDS_PER_PAGE) * 10) / 10;
          const pageLimitStatus = calculatePageLimitStatus(pageEstimate, volume.page_limit);

          // Page limit post-check (Gap 9)
          if (volume.page_limit && pageEstimate > volume.page_limit) {
            console.warn(
              `[draft-generator] Volume "${volume.volume_name}" exceeds page limit: ` +
              `${pageEstimate} pages vs ${volume.page_limit} limit`
            );
          }

          // Compliance language validation (Gap 8)
          const complianceCheck = validateComplianceLanguage(
            contentMarkdown,
            companyProfile.company_name,
            []
          );
          if (!complianceCheck.valid) {
            console.warn(`[draft-generator] Compliance issues in "${volume.volume_name}":`, complianceCheck.issues);
          }

          // Post-generation: cert expiry + availability validation
          const postGenValidation = runPostGenerationValidation(
            (personnel || []) as { full_name: string; availability?: string; certifications?: { name: string; expiration_date?: string | null }[]; proposed_roles?: { role_title: string; is_key_personnel?: boolean }[] }[],
            (certifications || []) as { certification_type: string; expiration_date?: string | null }[]
          );
          if (postGenValidation.certWarnings.length > 0 || postGenValidation.availabilityWarnings.length > 0) {
            console.warn(`[draft-generator] Cert expiry warnings for "${volume.volume_name}":`,
              postGenValidation.certWarnings.map(w => `${w.holder}: ${w.certName} ${w.severity} (${w.expirationDate})`));
            if (postGenValidation.availabilityWarnings.length > 0) {
              console.warn(`[draft-generator] Availability warnings for "${volume.volume_name}":`,
                postGenValidation.availabilityWarnings.map(w => w.warning));
            }
            await logPipelineEvent(
              solicitationId,
              'cert-validation',
              postGenValidation.hasBlockingIssues ? 'warning' : 'completed',
              {
                volume_name: volume.volume_name,
                has_blocking_issues: postGenValidation.hasBlockingIssues,
                cert_warnings: postGenValidation.certWarnings.map(w => ({
                  holder: w.holder,
                  cert: w.certName,
                  severity: w.severity,
                  expiration: w.expirationDate,
                  days_until_expiry: w.daysUntilExpiry,
                })),
                availability_warnings: postGenValidation.availabilityWarnings.map(w => w.warning),
              }
            );
          }

          // Layer 1: Post-generation content validation (anti-hallucination hard checks)
          const cvData: ContentValidationData = {
            keyPersonnel: (dataCallResponse.key_personnel || []) as { name: string; role: string }[],
            personnel: (personnel || []) as ContentValidationData['personnel'],
            pastPerformance: (pastPerformance || []) as ContentValidationData['pastPerformance'],
            complianceVerification: dataCallResponse.compliance_verification as unknown as Record<string, unknown> | null,
            technologySelections: (dataCallResponse.technology_selections || []) as ContentValidationData['technologySelections'],
            serviceAreaApproaches: (dataCallResponse.service_area_approaches || []) as ContentValidationData['serviceAreaApproaches'],
            dataCallResponse,
            rfpChecklists: volumeChecklists,
            volumeType: volumeTypeStr,
          };
          const contentValidation = validateGeneratedContent(contentMarkdown, cvData);
          let validatedMarkdown = contentValidation.correctedMarkdown;

          // Merge cert-validator blocking status into content validation warnings
          if (postGenValidation.hasBlockingIssues) {
            for (const cw of postGenValidation.certWarnings.filter(c => c.severity === 'expired')) {
              contentValidation.warnings.push({
                check: 'expired_cert',
                severity: 'error',
                message: `[cert-validator] ${cw.holder}: ${cw.certName} expired ${cw.expirationDate}`,
              });
            }
          }

          if (contentValidation.warnings.length > 0) {
            console.warn(`[draft-generator] Content validation for "${volume.volume_name}": ${contentValidation.warnings.length} warnings, ${contentValidation.autoCorrections} auto-corrections`);
            for (const w of contentValidation.warnings.filter(w => w.severity === 'error')) {
              console.warn(`  [${w.check}] ${w.message}`);
            }
            await logPipelineEvent(
              solicitationId,
              'content-validation',
              contentValidation.warnings.some(w => w.severity === 'error') ? 'warning' : 'completed',
              {
                volume_name: volume.volume_name,
                total_warnings: contentValidation.warnings.length,
                auto_corrections: contentValidation.autoCorrections,
                warnings_by_type: contentValidation.warnings.reduce((acc, w) => {
                  acc[w.check] = (acc[w.check] || 0) + 1;
                  return acc;
                }, {} as Record<string, number>),
                error_details: contentValidation.warnings
                  .filter(w => w.severity === 'error')
                  .map(w => `[${w.check}] ${w.message}`),
                warning_details: contentValidation.warnings
                  .filter(w => w.severity === 'warning')
                  .map(w => `[${w.check}] ${w.message}`),
              }
            );
          } else {
            await logPipelineEvent(solicitationId, 'content-validation', 'completed', {
              volume_name: volume.volume_name,
              result: 'All content validated — no issues detected',
              auto_corrections: 0,
            });
          }

          // Recalculate word count if auto-corrections were applied
          if (contentValidation.autoCorrections > 0) {
            const updatedWordCount = validatedMarkdown.split(/\s+/).filter(w => w.length > 0).length;
            console.log(`[draft-generator] Content validator applied ${contentValidation.autoCorrections} auto-corrections to "${volume.volume_name}" (words: ${wordCount} → ${updatedWordCount})`);
          }

          // Parse markdown into styled DOCX elements (headings, bullets, tables, callouts)
          const contentStructure = parseMarkdownToDocx(validatedMarkdown, colorPalette);

          // Derive volume type for the DOCX generator
          const volumeType = deriveVolumeTypeForGenerator(volume.volume_name);

          // Generate and embed AI diagrams for 'standard' graphics profile
          // Uses SVG templates — no Chromium, no CLI, works on Vercel serverless
          let diagramSpecs = null;
          if (graphicsProfile === 'standard' && contentStructure.sections) {
            try {
              // Build context for spec generator from available pipeline data
              const personnelContext = (personnel || [])
                .filter((p: any) => p.proposed_roles?.some((r: any) => r.is_key_personnel))
                .map((p: any) => {
                  const role = p.proposed_roles?.find((r: any) => r.is_key_personnel);
                  return {
                    role: role?.role_title || 'Staff',
                    name: p.full_name || undefined,
                    clearance: p.clearance_level || undefined,
                  };
                });

              const serviceAreas = (dataCallResponse.service_area_approaches || [])
                .map((s: any) => s.service_area_name || s.area || '')
                .filter(Boolean);

              const technologies = (dataCallResponse.technology_selections || [])
                .map((t: any) => t.technology_name || t.name || '')
                .filter(Boolean);

              const specResult = await generateDiagramSpecs({
                volumeMarkdown: validatedMarkdown,
                volumeName: volume.volume_name,
                volumeType,
                context: {
                  companyName: companyProfile.company_name,
                  personnel: personnelContext,
                  serviceAreas,
                  technologies,
                },
                requiredFromRfp: extractRfpDiagramRequirements(extractions, volume.volume_name),
                requiredFromStrategy: extractStrategyDiagramRequests(strategy, volume.volume_name),
                maxDiagrams: 3,
              }).catch((err: Error) => {
                console.warn(`[draft-generator] Diagram spec generation failed for "${volume.volume_name}":`, err.message);
                return { specs: [], success: false };
              });

              if (specResult.specs.length > 0) {
                let allDiagramSpecs: DiagramSpec[] = specResult.specs;

                // For cost/price volumes, prepend BOE diagram specs — they are required, not AI-suggested
                if (volumeType === 'price' && boeAssessment?.diagram_specs) {
                  const boeSpecs = boeAssessment.diagram_specs as DiagramSpec[];
                  allDiagramSpecs = [...boeSpecs, ...allDiagramSpecs];
                }

                diagramSpecs = allDiagramSpecs;
                const embeddedDiagrams = await embedAiDiagrams(allDiagramSpecs, colorPalette);
                for (const diagram of embeddedDiagrams) {
                  const sectionIdx = findDiagramInsertionPoint(
                    diagram.placement?.sectionKeywords || [],
                    diagram.id,
                    contentStructure.sections
                  );
                  if (sectionIdx < contentStructure.sections.length) {
                    const section = contentStructure.sections[sectionIdx];
                    // Find precise subsection position instead of appending at end
                    const contentIdx = findContentInsertionIndex(
                      section,
                      diagram.placement?.sectionKeywords || [],
                      diagram.id
                    );
                    section.content.splice(contentIdx, 0, ...diagram.elements);
                  }
                }
                console.log(`[draft-generator] Embedded ${embeddedDiagrams.length} AI diagram(s) in "${volume.volume_name}"`);
              }
            } catch (diagramErr) {
              console.warn(`[draft-generator] Diagram embedding failed for "${volume.volume_name}":`, diagramErr);
              // Non-fatal — volume generates without diagrams
            }
          }

          // Build companyData from Tier 1 collections for appendices
          const companyData = {
            profile: companyProfile,
            valuePropositions: (companyProfile.enterprise_win_themes || []).map((t: string) => ({ statement: t })),
            personnel: personnel || [],
            certifications: certifications || [],
            pastPerformance: pastPerformance || [],
            naicsCodes: naicsCodes || [],
            contractVehicles: contractVehicles || [],
          };

          // Build document context with real solicitation number (Gap 1)
          const documentContext = {
            solicitation_number: solicitation?.solicitation_number || 'TBD',
            metadata: {
              contracting_officer: 'Contracting Officer',
              agency: solicitation?.agency || 'Agency',
              solicitation_number: solicitation?.solicitation_number || 'TBD',
            },
          };

          // Build requirements from Section M for in-document compliance matrix (Gap 6)
          const sectionMExtraction = extractions.section_m || [];
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

          // Build section mappings from generated content sections
          const sectionMappings = (contentStructure.sections || []).map((section: { title: string }) => ({
            sectionName: section.title,
            requirements: requirements.map(r => r.id),
          }));

          // Generate DOCX with all v2 data wired through
          const docxDocument = await generateProposalVolume(
            volumeType,
            contentStructure,
            companyProfile,
            [],              // No exhibits in v2.0 draft — user adds exhibits in Word
            companyData,     // Populated from Tier 1 collections
            documentContext, // Real solicitation number + agency
            requirements,    // Section M evaluation factors for compliance matrix
            sectionMappings, // Content sections mapped to requirements
            colorPalette,    // Company-branded color palette
            volume.volume_name // Actual volume name for cover page and header
          );

          // Save to buffer
          const docxBuffer = await saveDocxToBuffer(docxDocument);

          // Upload DOCX to Supabase storage
          const sanitizedName = sanitizeStoragePath(volume.volume_name);
          const storagePath = `drafts/${companyId}/${solicitationId}/${volume.volume_order}_${sanitizedName}.docx`;

          const { error: uploadError } = await supabase.storage
            .from('proposal-drafts')
            .upload(storagePath, docxBuffer, {
              contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              upsert: true, // Overwrite on regeneration
            });

          if (uploadError) {
            // Storage upload failed — store content_markdown only, mark as partial
            console.warn(`DOCX upload failed for volume ${volume.volume_name}:`, uploadError.message);
          }

          const filePath = uploadError ? null : storagePath;

          // Generate Cost/Price Excel workbook for cost_price volumes
          let excelFilePath: string | null = null;
          if (volumeType === 'price') {
            try {
              const siteStaffing = dataCallResponse.site_staffing || [];
              const laborCategories = extractLaborCategories(personnel || []);
              const opCtxRows = extractions.operational_context || [];
              const agencyNameExtracted = opCtxRows.find(r => r.field_name === 'agency_name')?.field_value as string || '';
              const adminRows = extractions.admin_data || [];
              const solNumber = adminRows.find(r => r.field_name === 'solicitation_number')?.field_value as string || '';
              const opDetails = (dataCallResponse.opportunity_details || {}) as Record<string, unknown>;

              const excelBuffer = await generateCostPriceWorkbook({
                companyName: companyProfile.company_name,
                solicitationNumber: solNumber,
                agencyName: agencyNameExtracted,
                contractType: (opDetails.contract_type as string) || 'TBD',
                periodOfPerformance: '1 Base Year + 4 Option Years',
                siteStaffing: siteStaffing as { site_name: string; proposed_fte_count: string | number }[],
                laborCategories,
                clinStructure: [],
                boeAssessment: boeAssessment ?? null,
              });

              const excelPath = `drafts/${companyId}/${solicitationId}/${volume.volume_order}_${sanitizedName}.xlsx`;
              const { error: xlUploadError } = await supabase.storage
                .from('proposal-drafts')
                .upload(excelPath, excelBuffer, {
                  contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                  upsert: true,
                });

              if (!xlUploadError) {
                excelFilePath = excelPath;
                console.log(`[draft-generator] Excel workbook generated for "${volume.volume_name}"`);
              } else {
                console.warn(`[draft-generator] Excel upload failed for "${volume.volume_name}":`, xlUploadError.message);
              }
            } catch (xlErr) {
              console.warn(`[draft-generator] Excel generation failed for "${volume.volume_name}":`, xlErr);
            }
          }

          // Save in two steps to avoid payload size issues on large volumes:
          // Step A: Save the large content separately
          await supabase.from('draft_volumes').update({
            content_markdown: validatedMarkdown,
          }).eq('id', volume.id);

          // Step B: Save metadata + status (small payload, reliable)
          await supabase.from('draft_volumes').update({
            status: 'completed',
            word_count: wordCount,
            page_estimate: pageEstimate,
            page_limit_status: pageLimitStatus,
            file_path: filePath,
            excel_file_path: excelFilePath,
            diagram_specs: diagramSpecs ?? null,
            validation_warnings: contentValidation.warnings.length > 0
              ? contentValidation.warnings as unknown as Record<string, unknown>[]
              : null,
            generation_completed_at: new Date().toISOString(),
            error_message: uploadError ? `DOCX upload failed: ${uploadError.message}` : null,
            updated_at: new Date().toISOString(),
          }).eq('id', volume.id);

          console.log(`[draft-generator] Volume "${volume.volume_name}" completed: ${wordCount} words, ${pageEstimate} pages, status=${pageLimitStatus}`);

          await logPipelineEvent(solicitationId, 'generate-volume', 'completed', {
            volume_name: volume.volume_name,
            volume_order: volume.volume_order,
            word_count: wordCount,
            page_estimate: pageEstimate,
            page_limit: volume.page_limit,
            page_limit_status: pageLimitStatus,
            auto_fill: {
              filled: autoFillResult.fillCount,
              remaining: autoFillResult.remainingPlaceholders,
            },
            content_validation: {
              warnings: contentValidation.warnings.length,
              auto_corrections: contentValidation.autoCorrections,
              errors: contentValidation.warnings.filter(w => w.severity === 'error').length,
            },
            docx_uploaded: !!filePath,
          });

          return {
            volumeId: volume.id,
            volumeName: volume.volume_name,
            volumeOrder: volume.volume_order,
            status: 'completed' as const,
            wordCount,
            pageEstimate,
            filePath,
          };
        } catch (err) {
          // Error isolation: volume failure does NOT propagate to kill other steps
          const errMsg = err instanceof Error ? err.message : String(err);
          console.error(`[draft-generator] Volume "${volume.volume_name}" failed:`, errMsg);

          await logPipelineEvent(solicitationId, 'generate-volume', 'failed', {
            volume_name: volume.volume_name,
            volume_order: volume.volume_order,
            error: errMsg,
            error_type: err instanceof Error ? err.constructor.name : 'Unknown',
          });

          await supabase
            .from('draft_volumes')
            .update({
              status: 'failed',
              error_message: errMsg,
              generation_completed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', volume.id);

          return {
            volumeId: volume.id,
            volumeName: volume.volume_name,
            volumeOrder: volume.volume_order,
            status: 'failed' as const,
            error: errMsg,
          };
        }
      });

      volumeResults.push(result);
    }

    // ─── Step N+1: Generate compliance matrix ────────────────────────────────
    await step.run('generate-compliance-matrix', async () => {
      const supabase = getServerClient();

      try {
        // Build sets of completed/failed volume names for status mapping
        const completedVolumeNames = new Set(
          volumeResults
            .filter(r => r.status === 'completed')
            .map(r => r.volumeName)
        );
        const failedVolumeNames = new Set(
          volumeResults
            .filter(r => r.status === 'failed')
            .map(r => r.volumeName)
        );

        // Build volume list for the matrix mapper
        const volumeList = draftVolumes
          .filter(v => v.volume_order !== 999)
          .map(v => ({
            volume_name: v.volume_name,
            volume_order: v.volume_order,
            status: v.status,
          }));

        // Assemble compliance matrix data from Section M extractions
        const matrixEntries = assembleComplianceMatrixData(extractions, volumeList);

        // Generate markdown compliance matrix table
        const matrixMarkdown = generateComplianceMatrixMarkdown(
          matrixEntries,
          completedVolumeNames,
          failedVolumeNames
        );

        const now = new Date().toISOString();

        // Check if a compliance matrix volume already exists (from a previous run)
        const { data: existingMatrix } = await supabase
          .from('draft_volumes')
          .select('id')
          .eq('draft_id', draftId)
          .eq('volume_order', 999)
          .maybeSingle();

        if (existingMatrix) {
          // Update existing compliance matrix row
          await supabase
            .from('draft_volumes')
            .update({
              status: 'completed',
              content_markdown: matrixMarkdown,
              word_count: matrixMarkdown.split(/\s+/).filter(w => w.length > 0).length,
              generation_completed_at: now,
              updated_at: now,
            })
            .eq('id', existingMatrix.id);
        } else {
          // Insert new compliance matrix row at volume_order=999
          await supabase.from('draft_volumes').insert({
            draft_id: draftId,
            volume_name: 'Compliance Matrix',
            volume_order: 999,
            status: 'completed',
            content_markdown: matrixMarkdown,
            word_count: matrixMarkdown.split(/\s+/).filter(w => w.length > 0).length,
            page_limit: null,
            page_limit_status: null,
            file_path: null, // Compliance matrix is markdown-only — no DOCX
            generation_completed_at: now,
            created_at: now,
            updated_at: now,
          });
        }

        console.log(`[draft-generator] Compliance matrix generated: ${matrixEntries.length} factors mapped`);

        return { factorCount: matrixEntries.length };
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error('[draft-generator] Compliance matrix generation failed:', errMsg);
        // Non-fatal — compliance matrix failure does not affect volume completion
        return { factorCount: 0, error: errMsg };
      }
    });

    // ─── Step N+2: Finalize ───────────────────────────────────────────────────
    const summary = await step.run('finalize', async () => {
      const supabase = getServerClient();
      const now = new Date().toISOString();

      const completedCount = volumeResults.filter(r => r.status === 'completed').length;
      const failedCount = volumeResults.filter(r => r.status === 'failed').length;
      const totalCount = volumeResults.length;

      let finalStatus: 'completed' | 'failed';
      let errorMessage: string | null = null;

      if (totalCount === 0 || completedCount > 0) {
        // All volumes completed, or at least some completed (partial success)
        // Per plan: "If any failed but some completed: still set status='completed'"
        finalStatus = 'completed';
      } else {
        // ALL volumes failed
        finalStatus = 'failed';
        const failedNames = volumeResults
          .filter(r => r.status === 'failed')
          .map(r => `${r.volumeName}: ${r.error}`)
          .join('; ');
        errorMessage = `All ${failedCount} volumes failed to generate. Errors: ${failedNames}`;
      }

      await supabase
        .from('proposal_drafts')
        .update({
          status: finalStatus,
          generation_completed_at: now,
          error_message: errorMessage,
          updated_at: now,
        })
        .eq('id', draftId);

      const draftSummaryMeta = {
        solicitation_id: solicitationId,
        company_id: companyId,
        draft_id: draftId,
        total_volumes: totalCount,
        completed_volumes: completedCount,
        failed_volumes: failedCount,
        final_status: finalStatus,
        volume_details: volumeResults.map((r: Record<string, unknown>) => ({
          name: r.volumeName,
          status: r.status,
          wordCount: r.wordCount || null,
          pageEstimate: r.pageEstimate || null,
        })),
      };

      await logProcessingEvent(
        'draft-generator',
        finalStatus === 'completed' ? 'completed' : 'failed',
        draftSummaryMeta
      );

      // Pipeline-scoped logging
      await logPipelineEvent(
        solicitationId,
        'draft-generator',
        finalStatus === 'completed' ? 'completed' : 'failed',
        { output_summary: draftSummaryMeta }
      );

      console.log(`[draft-generator] Finalized: ${completedCount}/${totalCount} volumes completed, status=${finalStatus}`);

      return {
        status: finalStatus,
        completedCount,
        failedCount,
        totalCount,
      };
    });

    return {
      solicitationId,
      companyId,
      draftId,
      summary,
    };
  }
);
