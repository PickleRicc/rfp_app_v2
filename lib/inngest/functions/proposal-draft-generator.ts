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
import type { CompanyProfile } from '@/lib/supabase/company-types';
import type { DataCallResponse } from '@/lib/supabase/tier2-types';
import type {
  ComplianceExtractionsByCategory,
  ExtractionCategory,
} from '@/lib/supabase/compliance-types';
import type { DraftVolume } from '@/lib/supabase/draft-types';

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

/**
 * Convert markdown content string to the section structure expected by generateProposalVolume().
 * The existing generator expects: { sections: Array<{ title: string; content: string }> }
 *
 * Strategy: parse H1/H2 headings as section boundaries.
 * Content between headings becomes a single string for each section.
 */
function markdownToContentStructure(markdownContent: string): { sections: Array<{ title: string; content: string }> } {
  const lines = markdownContent.split('\n');
  const sections: Array<{ title: string; content: string }> = [];

  let currentTitle = 'Introduction';
  let currentLines: string[] = [];

  for (const line of lines) {
    const h1Match = line.match(/^# (.+)$/);
    const h2Match = line.match(/^## (.+)$/);
    const heading = h1Match || h2Match;

    if (heading) {
      // Save the previous section if it has content
      if (currentLines.length > 0) {
        const content = currentLines.join('\n').trim();
        if (content) {
          sections.push({ title: currentTitle, content });
        }
      }

      currentTitle = heading[1].trim();
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }

  // Save the final section
  if (currentLines.length > 0) {
    const content = currentLines.join('\n').trim();
    if (content) {
      sections.push({ title: currentTitle, content });
    }
  }

  // If no sections were found (flat content with no headings), treat entire content as one section
  if (sections.length === 0) {
    sections.push({ title: 'Main Content', content: markdownContent.trim() });
  }

  return { sections };
}

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
    const { solicitationId, companyId, draftId } = event.data as {
      solicitationId: string;
      companyId: string;
      draftId: string;
    };

    // ─── Step 1: Fetch all data sources ──────────────────────────────────────
    const { companyProfile, dataCallResponse, extractions, draftVolumes } = await step.run(
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

        return {
          companyProfile: company as CompanyProfile,
          dataCallResponse: dataCall as DataCallResponse,
          extractions: extractionsByCategory,
          draftVolumes: (volumes || []) as DraftVolume[],
        };
      }
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

          // Build the prompt data bundle
          const promptData: VolumePromptData = {
            companyProfile,
            dataCallResponse,
            extractions,
            pageLimit: volume.page_limit,
            pageLimitSpacing: 'single', // Government RFP default
          };

          // Assemble volume-specific AI prompts
          const { systemPrompt, userPrompt, targetWordCount } = assembleVolumePrompt(
            volume.volume_name,
            volume.volume_order,
            promptData
          );

          // Call Claude to generate content
          const claudeResponse = await anthropic.messages.create({
            model: MODEL,
            max_tokens: 8192,
            temperature: 0.3,
            system: systemPrompt,
            messages: [
              {
                role: 'user',
                content: userPrompt,
              },
            ],
          });

          // Extract markdown content from Claude response
          const contentMarkdown = claudeResponse.content
            .filter(block => block.type === 'text')
            .map(block => (block as { type: 'text'; text: string }).text)
            .join('\n');

          // Calculate word count and page estimate
          const wordCount = contentMarkdown.split(/\s+/).filter(w => w.length > 0).length;
          const pageEstimate = Math.round((wordCount / WORDS_PER_PAGE) * 10) / 10;
          const pageLimitStatus = calculatePageLimitStatus(pageEstimate, volume.page_limit);

          // Convert markdown to content structure expected by the DOCX generator
          const contentStructure = markdownToContentStructure(contentMarkdown);

          // Derive volume type for the DOCX generator
          const volumeType = deriveVolumeTypeForGenerator(volume.volume_name);

          // Generate DOCX using the existing v1.0 generator
          const docxDocument = await generateProposalVolume(
            volumeType,
            contentStructure,
            companyProfile,
            [], // No exhibits in v2.0 draft — user adds exhibits in Word
            null, // No legacy companyData (v2.0 uses companyProfile directly)
            { solicitation_number: solicitationId }, // Minimal document context for header
            [], // No requirements mapping (compliance matrix is a separate volume)
            []  // No section mappings
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

          // Update draft_volumes with all results
          await supabase
            .from('draft_volumes')
            .update({
              status: 'completed',
              word_count: wordCount,
              page_estimate: pageEstimate,
              page_limit_status: pageLimitStatus,
              file_path: filePath,
              content_markdown: contentMarkdown,
              generation_completed_at: new Date().toISOString(),
              error_message: uploadError ? `DOCX upload failed: ${uploadError.message}` : null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', volume.id);

          console.log(`[draft-generator] Volume "${volume.volume_name}" completed: ${wordCount} words, ${pageEstimate} pages, status=${pageLimitStatus}`);

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

      await logProcessingEvent(
        'draft-generator',
        finalStatus === 'completed' ? 'completed' : 'failed',
        {
          solicitation_id: solicitationId,
          company_id: companyId,
          draft_id: draftId,
          total_volumes: totalCount,
          completed_volumes: completedCount,
          failed_volumes: failedCount,
          final_status: finalStatus,
        }
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
