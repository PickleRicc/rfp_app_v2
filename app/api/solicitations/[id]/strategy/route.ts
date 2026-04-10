/**
 * GET  /api/solicitations/[id]/strategy
 *   Returns the existing SolicitationStrategy for this solicitation + company,
 *   plus the Section L volume list and Tier 1 default win themes for UI scaffolding.
 *   Response shape: StrategyGetResponse
 *
 * PUT  /api/solicitations/[id]/strategy
 *   Upserts the full strategy (PM saves draft edits).
 *   Body: StrategyUpsertRequest
 *
 * POST /api/solicitations/[id]/strategy/confirm is handled in:
 *   app/api/solicitations/[id]/strategy/confirm/route.ts
 *   (kept separate so the draft POST route logic stays unchanged)
 *
 * Both endpoints require:
 * - requireStaffOrResponse() auth
 * - X-Company-Id header
 * - Solicitation must belong to the requesting company
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';
import { requireStaffOrResponse } from '@/lib/auth';
import type { StrategyGetResponse, StrategyUpsertRequest, VolumeStrategy } from '@/lib/supabase/strategy-types';
import type { SectionLFields } from '@/lib/supabase/compliance-types';

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

    // Verify solicitation belongs to company
    const { data: solicitation } = await supabase
      .from('solicitations')
      .select('id')
      .eq('id', solicitationId)
      .eq('company_id', companyId)
      .maybeSingle();

    if (!solicitation) {
      return NextResponse.json({ error: 'Solicitation not found' }, { status: 404 });
    }

    // Fetch all three data sources in parallel
    const [strategyResult, volumeResult, companyResult] = await Promise.all([
      // Existing strategy (may be null)
      supabase
        .from('solicitation_strategies')
        .select('*')
        .eq('solicitation_id', solicitationId)
        .eq('company_id', companyId)
        .maybeSingle(),

      // Section L volume_structure for UI scaffolding
      supabase
        .from('compliance_extractions')
        .select('field_value')
        .eq('solicitation_id', solicitationId)
        .eq('category', 'section_l')
        .eq('field_name', 'volume_structure')
        .maybeSingle(),

      // Tier 1 win themes as defaults
      supabase
        .from('company_profiles')
        .select('enterprise_win_themes')
        .eq('id', companyId)
        .maybeSingle(),
    ]);

    // Parse Section L volumes
    const volumeField = volumeResult.data?.field_value as SectionLFields['volume_structure'] | null;
    const volumes = volumeField?.volumes?.map(v => ({
      name: v.name,
      page_limit: v.page_limit ?? null,
    })) ?? [];

    // Default win themes from Tier 1
    const defaultWinThemes: string[] =
      (companyResult.data?.enterprise_win_themes as string[]) ?? [];

    const resp: StrategyGetResponse = {
      strategy: strategyResult.data ?? null,
      volumes,
      default_win_themes: defaultWinThemes,
    };

    return NextResponse.json(resp);
  } catch (error) {
    console.error('Strategy GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── PUT ──────────────────────────────────────────────────────────────────────

export async function PUT(
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

    const body = (await request.json()) as StrategyUpsertRequest;

    // Basic validation
    if (!Array.isArray(body.win_theme_priorities)) {
      return NextResponse.json({ error: 'win_theme_priorities must be an array' }, { status: 400 });
    }
    if (!['aggressive', 'balanced', 'conservative'].includes(body.risk_posture)) {
      return NextResponse.json({ error: 'risk_posture must be aggressive, balanced, or conservative' }, { status: 400 });
    }
    if (!Array.isArray(body.volume_strategies)) {
      return NextResponse.json({ error: 'volume_strategies must be an array' }, { status: 400 });
    }

    const supabase = getServerClient();

    // Verify solicitation belongs to company
    const { data: solicitation } = await supabase
      .from('solicitations')
      .select('id')
      .eq('id', solicitationId)
      .eq('company_id', companyId)
      .maybeSingle();

    if (!solicitation) {
      return NextResponse.json({ error: 'Solicitation not found' }, { status: 404 });
    }

    // Upsert — UNIQUE constraint on (solicitation_id, company_id)
    const { data: strategy, error } = await supabase
      .from('solicitation_strategies')
      .upsert(
        {
          solicitation_id: solicitationId,
          company_id: companyId,
          win_theme_priorities: body.win_theme_priorities,
          agency_intel: body.agency_intel ?? null,
          competitive_notes: body.competitive_notes ?? null,
          risk_posture: body.risk_posture,
          volume_strategies: body.volume_strategies as unknown as VolumeStrategy[],
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'solicitation_id,company_id' }
      )
      .select()
      .single();

    if (error) {
      console.error('Strategy upsert error:', error);
      return NextResponse.json({ error: 'Failed to save strategy' }, { status: 500 });
    }

    return NextResponse.json({ strategy });
  } catch (error) {
    console.error('Strategy PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
