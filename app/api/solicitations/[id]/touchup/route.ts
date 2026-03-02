/**
 * GET  /api/solicitations/[id]/touchup — Touchup tab data
 * POST /api/solicitations/[id]/touchup — Score, rewrite, or generate matrix
 *
 * Actions (POST body.action):
 *   "score"           — Score selected volumes  { action: "score", volumeIds: string[] }
 *   "rewrite"         — Rewrite a scored volume { action: "rewrite", touchupVolumeId: string }
 *   "generate-matrix" — Build compliance matrix { action: "generate-matrix" }
 *
 * Both endpoints require:
 * - requireStaffOrResponse() auth
 * - X-Company-Id header
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';
import { requireStaffOrResponse } from '@/lib/auth';
import { inngest } from '@/lib/inngest/client';
import type {
  TouchupAnalysis,
  TouchupVolume,
  TouchupVolumeVersion,
  TouchupGetResponse,
  DraftVolumeForTouchup,
  ComputedAggregates,
  GapAnalysis,
} from '@/lib/supabase/touchup-types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeAggregates(volumes: TouchupVolume[]): ComputedAggregates {
  const realVolumes = volumes.filter(v => v.volume_order !== 999);
  const scored = realVolumes.filter(v => v.compliance_score != null);
  const rewritten = realVolumes.filter(v => v.status === 'completed');

  const avgScore = scored.length > 0
    ? Math.round(scored.reduce((s, v) => s + (v.compliance_score ?? 0), 0) / scored.length)
    : null;

  const totalGaps = scored.reduce((sum, v) => {
    const ga = v.gap_analysis;
    if (!ga) return sum;
    return sum
      + (ga.requirements_coverage?.filter(r => r.status !== 'covered').length || 0)
      + (ga.missing_content?.length || 0)
      + (ga.placeholder_items?.length || 0);
  }, 0);

  const humanInputs = rewritten.reduce((sum, v) => sum + (v.human_input_count ?? 0), 0);

  return {
    overall_compliance_score: avgScore,
    total_gaps: totalGaps,
    total_gaps_resolved: totalGaps - humanInputs,
    human_inputs_required: humanInputs,
    scored_count: scored.length,
    rewritten_count: rewritten.length,
    total_count: realVolumes.length,
  };
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffOrResponse();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id: solicitationId } = await params;
    const companyId = request.headers.get('X-Company-Id');

    if (!companyId) {
      return NextResponse.json({ error: 'X-Company-Id header is required' }, { status: 400 });
    }

    const supabase = getServerClient();

    const { data: solicitation } = await supabase
      .from('solicitations').select('id')
      .eq('id', solicitationId).eq('company_id', companyId).maybeSingle();

    if (!solicitation) {
      return NextResponse.json({ error: 'Solicitation not found' }, { status: 404 });
    }

    // Check if draft is completed
    const { data: draft } = await supabase
      .from('proposal_drafts')
      .select('id, status')
      .eq('solicitation_id', solicitationId).eq('company_id', companyId)
      .maybeSingle();

    if (!draft || draft.status !== 'completed') {
      const resp: TouchupGetResponse = {
        draftReady: false,
        touchup: null,
        volumes: [],
        draftVolumes: [],
        aggregates: null,
      };
      return NextResponse.json(resp);
    }

    // Fetch completed draft volumes (for volume selector)
    const { data: draftVolumes } = await supabase
      .from('draft_volumes')
      .select('id, volume_name, volume_order, page_limit, status')
      .eq('draft_id', draft.id)
      .neq('volume_order', 999)
      .eq('status', 'completed')
      .order('volume_order', { ascending: true });

    // Fetch touchup analysis
    const { data: touchup } = await supabase
      .from('touchup_analyses')
      .select('*')
      .eq('solicitation_id', solicitationId).eq('company_id', companyId)
      .maybeSingle();

    let touchupRecord = touchup as TouchupAnalysis | null;
    let touchupVolumes: TouchupVolume[] = [];

    if (touchupRecord) {
      const { data: vols } = await supabase
        .from('touchup_volumes')
        .select('*')
        .eq('touchup_id', touchupRecord.id)
        .order('volume_order', { ascending: true });

      touchupVolumes = (vols ?? []) as TouchupVolume[];

      // Stale session cleanup: if touchup exists but has zero real volumes,
      // the user likely regenerated their draft (cascade-deleted old volumes).
      const realVols = touchupVolumes.filter(v => v.volume_order !== 999);
      if (realVols.length === 0) {
        await supabase.from('touchup_analyses').delete().eq('id', touchupRecord.id);
        touchupRecord = null;
        touchupVolumes = [];
      }

      // Batch-fetch version history for all touchup volumes
      if (touchupVolumes.length > 0) {
        const volumeIds = touchupVolumes.map(v => v.id);
        const { data: allVersions } = await supabase
          .from('touchup_volume_versions')
          .select('*')
          .in('touchup_volume_id', volumeIds)
          .order('version_number', { ascending: false });

        const versionsByVolumeId = new Map<string, TouchupVolumeVersion[]>();
        for (const ver of (allVersions ?? []) as TouchupVolumeVersion[]) {
          const list = versionsByVolumeId.get(ver.touchup_volume_id) || [];
          list.push(ver);
          versionsByVolumeId.set(ver.touchup_volume_id, list);
        }

        for (const vol of touchupVolumes) {
          vol.versions = versionsByVolumeId.get(vol.id) || [];
        }
      }
    }

    const resp: TouchupGetResponse = {
      draftReady: true,
      touchup: touchupRecord,
      volumes: touchupVolumes,
      draftVolumes: (draftVolumes ?? []) as DraftVolumeForTouchup[],
      aggregates: touchupVolumes.length > 0 ? computeAggregates(touchupVolumes) : null,
    };

    return NextResponse.json(resp);
  } catch (error) {
    console.error('Touchup GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffOrResponse();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id: solicitationId } = await params;
    const companyId = request.headers.get('X-Company-Id');

    if (!companyId) {
      return NextResponse.json({ error: 'X-Company-Id header is required' }, { status: 400 });
    }

    const body = await request.json();
    const action = body.action as string;

    if (!action || !['score', 'rewrite', 'generate-matrix', 'score-package'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Use: score, rewrite, generate-matrix, score-package' }, { status: 400 });
    }

    const supabase = getServerClient();

    const { data: solicitation } = await supabase
      .from('solicitations').select('id')
      .eq('id', solicitationId).eq('company_id', companyId).maybeSingle();

    if (!solicitation) {
      return NextResponse.json({ error: 'Solicitation not found' }, { status: 404 });
    }

    // ─── ACTION: score ──────────────────────────────────────────────────
    if (action === 'score') {
      const volumeIds = body.volumeIds as string[];
      const scoreVersion = (body.scoreVersion as 'draft' | 'touchup') || 'draft';
      const scoreVersionNumber = body.scoreVersionNumber as number | undefined;
      if (!volumeIds || volumeIds.length === 0) {
        return NextResponse.json({ error: 'volumeIds array is required' }, { status: 400 });
      }

      const { data: draft } = await supabase
        .from('proposal_drafts')
        .select('id, status')
        .eq('solicitation_id', solicitationId).eq('company_id', companyId)
        .maybeSingle();

      if (!draft || draft.status !== 'completed') {
        return NextResponse.json({ error: 'First draft must be completed' }, { status: 400 });
      }

      // Verify all volumeIds are valid completed draft volumes
      const { data: draftVolumes } = await supabase
        .from('draft_volumes')
        .select('id, volume_name, volume_order, page_limit, status')
        .eq('draft_id', draft.id).in('id', volumeIds);

      const validVolumes = (draftVolumes || []).filter(v => v.status === 'completed');
      if (validVolumes.length === 0) {
        return NextResponse.json({ error: 'No valid completed draft volumes found' }, { status: 400 });
      }

      const now = new Date().toISOString();

      // Upsert touchup_analyses (one per draft)
      const { data: touchup, error: touchupError } = await supabase
        .from('touchup_analyses')
        .upsert(
          {
            draft_id: draft.id,
            solicitation_id: solicitationId,
            company_id: companyId,
            status: 'active',
            updated_at: now,
          },
          { onConflict: 'draft_id', ignoreDuplicates: false }
        )
        .select('*')
        .single();

      if (touchupError || !touchup) {
        console.error('Upsert touchup_analyses error:', touchupError);
        return NextResponse.json({ error: 'Failed to create touchup session' }, { status: 500 });
      }

      // For each selected volume: upsert touchup_volumes + send Inngest event
      const events: Array<{ name: string; data: Record<string, string> }> = [];
      const upsertedVolumes: TouchupVolume[] = [];

      for (const dv of validVolumes) {
        // Check if touchup_volume exists for this draft volume
        const { data: existing } = await supabase
          .from('touchup_volumes')
          .select('id, status')
          .eq('touchup_id', touchup.id)
          .eq('original_volume_id', dv.id)
          .maybeSingle();

        // Duplicate guard: skip volumes already being scored
        if (existing?.status === 'scoring') {
          continue;
        }

        let touchupVolumeId: string;

        if (existing) {
          // Re-scoring: only reset scoring-related fields, preserve rewrite data
          const { data: updated } = await supabase
            .from('touchup_volumes')
            .update({
              compliance_score: null,
              touchup_score: null,
              gap_analysis: null,
              fabrication_flags: null,
              placeholder_count: null,
              error_message: null,
              scoring_started_at: null,
              scoring_completed_at: null,
              updated_at: now,
            })
            .eq('id', existing.id)
            .select('*')
            .single();

          touchupVolumeId = existing.id;
          if (updated) upsertedVolumes.push(updated as TouchupVolume);
        } else {
          // New: create touchup_volume
          const { data: created } = await supabase
            .from('touchup_volumes')
            .insert({
              touchup_id: touchup.id,
              original_volume_id: dv.id,
              volume_name: dv.volume_name,
              volume_order: dv.volume_order,
              status: 'pending',
              page_limit: dv.page_limit,
              created_at: now,
              updated_at: now,
            })
            .select('*')
            .single();

          if (!created) continue;
          touchupVolumeId = created.id;
          upsertedVolumes.push(created as TouchupVolume);
        }

        events.push({
          name: 'proposal.touchup.score',
          data: {
            solicitationId,
            companyId,
            draftId: draft.id,
            touchupId: touchup.id,
            touchupVolumeId,
            scoreVersion,
            ...(scoreVersionNumber ? { scoreVersionNumber: String(scoreVersionNumber) } : {}),
          },
        });
      }

      if (events.length > 0) {
        await inngest.send(events);
      }

      return NextResponse.json({
        touchup: touchup as TouchupAnalysis,
        scoringStarted: events.length,
        message: `Scoring started for ${events.length} volume(s)`,
      });
    }

    // ─── ACTION: rewrite ────────────────────────────────────────────────
    if (action === 'rewrite') {
      const touchupVolumeId = body.touchupVolumeId as string;
      if (!touchupVolumeId) {
        return NextResponse.json({ error: 'touchupVolumeId is required' }, { status: 400 });
      }

      // Fetch the touchup volume and validate
      const { data: vol } = await supabase
        .from('touchup_volumes')
        .select('*, touchup_analyses!inner(id, draft_id, solicitation_id, company_id)')
        .eq('id', touchupVolumeId)
        .maybeSingle();

      if (!vol) {
        return NextResponse.json({ error: 'Touchup volume not found' }, { status: 404 });
      }

      const parent = vol.touchup_analyses as unknown as {
        id: string; draft_id: string; solicitation_id: string; company_id: string;
      };

      if (parent.company_id !== companyId || parent.solicitation_id !== solicitationId) {
        return NextResponse.json({ error: 'Touchup volume not found' }, { status: 404 });
      }

      if (vol.status !== 'scored') {
        return NextResponse.json(
          { error: `Volume must be in 'scored' status to rewrite. Current: '${vol.status}'` },
          { status: 400 }
        );
      }

      // Update status to rewriting
      await supabase.from('touchup_volumes').update({
        status: 'rewriting',
        updated_at: new Date().toISOString(),
      }).eq('id', touchupVolumeId);

      await inngest.send({
        name: 'proposal.touchup.rewrite',
        data: {
          solicitationId,
          companyId,
          draftId: parent.draft_id,
          touchupId: parent.id,
          touchupVolumeId,
        },
      });

      return NextResponse.json({ message: 'Rewrite started', touchupVolumeId });
    }

    // ─── ACTION: generate-matrix ────────────────────────────────────────
    if (action === 'generate-matrix') {
      const { data: touchup } = await supabase
        .from('touchup_analyses')
        .select('id, draft_id')
        .eq('solicitation_id', solicitationId).eq('company_id', companyId)
        .maybeSingle();

      if (!touchup) {
        return NextResponse.json({ error: 'No touchup session found' }, { status: 400 });
      }

      const { data: vols } = await supabase
        .from('touchup_volumes')
        .select('*')
        .eq('touchup_id', touchup.id)
        .neq('volume_order', 999)
        .order('volume_order', { ascending: true });

      const scoredVols = (vols || []).filter(v => v.compliance_score != null);
      if (scoredVols.length === 0) {
        return NextResponse.json({ error: 'No scored volumes to build matrix from' }, { status: 400 });
      }

      // Build compliance matrix markdown
      const lines = [
        '# Touchup Compliance Matrix',
        '',
        'Evaluation factor coverage after touchup scoring with gap resolution status.',
        '',
        '| Volume | Score | Status | Coverage | Missing | Partial | Fabrications |',
        '|---|---|---|---|---|---|---|',
      ];

      for (const v of scoredVols) {
        const ga = v.gap_analysis as unknown as GapAnalysis | null;
        const reqs = ga?.requirements_coverage || [];
        const missing = reqs.filter(r => r.status === 'missing').length;
        const partial = reqs.filter(r => r.status === 'partial').length;
        const covered = reqs.length - missing - partial;
        const fabs = (v.fabrication_flags as unknown as Array<unknown>)?.length || 0;
        const status = v.status === 'completed' ? 'Rewritten' : v.status === 'scored' ? 'Scored' : v.status;

        lines.push(
          `| ${v.volume_name} | ${v.compliance_score ?? '—'}/100 | ${status} | ${covered}/${reqs.length} | ${missing} | ${partial} | ${fabs} |`
        );
      }

      lines.push('', '---', '*Generated from touchup scoring data.*');
      const matrixMarkdown = lines.join('\n');
      const now = new Date().toISOString();

      // Upsert the compliance matrix volume (order 999)
      const { data: existing } = await supabase
        .from('touchup_volumes')
        .select('id')
        .eq('touchup_id', touchup.id).eq('volume_order', 999)
        .maybeSingle();

      if (existing) {
        await supabase.from('touchup_volumes').update({
          status: 'completed',
          content_markdown: matrixMarkdown,
          word_count: matrixMarkdown.split(/\s+/).length,
          scoring_completed_at: now,
          updated_at: now,
        }).eq('id', existing.id);
      } else {
        // Need a draft volume reference — use the first one
        const { data: firstDraftVol } = await supabase
          .from('draft_volumes')
          .select('id')
          .eq('draft_id', touchup.draft_id)
          .order('volume_order', { ascending: true })
          .limit(1)
          .single();

        if (firstDraftVol) {
          await supabase.from('touchup_volumes').insert({
            touchup_id: touchup.id,
            original_volume_id: firstDraftVol.id,
            volume_name: 'Compliance Matrix',
            volume_order: 999,
            status: 'completed',
            content_markdown: matrixMarkdown,
            word_count: matrixMarkdown.split(/\s+/).length,
            created_at: now,
            updated_at: now,
          });
        }
      }

      return NextResponse.json({ message: 'Compliance matrix generated', matrix: matrixMarkdown });
    }

    // ─── ACTION: score-package ──────────────────────────────────────────
    if (action === 'score-package') {
      const { data: draft } = await supabase
        .from('proposal_drafts')
        .select('id')
        .eq('solicitation_id', solicitationId).eq('company_id', companyId)
        .maybeSingle();

      if (!draft) {
        return NextResponse.json({ error: 'No draft found' }, { status: 400 });
      }

      const { data: touchup } = await supabase
        .from('touchup_analyses')
        .select('id')
        .eq('solicitation_id', solicitationId).eq('company_id', companyId)
        .maybeSingle();

      if (!touchup) {
        return NextResponse.json({ error: 'No touchup session found' }, { status: 400 });
      }

      const { data: scoredVols } = await supabase
        .from('touchup_volumes')
        .select('id')
        .eq('touchup_id', touchup.id)
        .neq('volume_order', 999)
        .not('compliance_score', 'is', null);

      if (!scoredVols || scoredVols.length < 2) {
        return NextResponse.json({ error: 'At least 2 scored volumes required for package consistency check' }, { status: 400 });
      }

      await inngest.send({
        name: 'proposal.touchup.score-package',
        data: {
          solicitationId,
          companyId,
          draftId: draft.id,
          touchupId: touchup.id,
        },
      });

      return NextResponse.json({ message: 'Package consistency scoring started' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Touchup POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
