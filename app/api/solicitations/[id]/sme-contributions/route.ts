/**
 * SME Contributions API
 *
 * GET  /api/solicitations/[id]/sme-contributions
 *   Returns all SME contributions for this solicitation + company.
 *   Query param: ?approved_only=true to filter to approved contributions (used by generator preview).
 *
 * POST /api/solicitations/[id]/sme-contributions
 *   Creates a new SME contribution (submitted by SME or PM).
 *   Body: SmeContributionCreateRequest
 *
 * PATCH /api/solicitations/[id]/sme-contributions/[contributionId]
 *   Updates content or approval status.
 *   Body: SmeContributionUpdateRequest
 *   Note: Setting approved=true also requires approved_by in the body.
 *
 * DELETE /api/solicitations/[id]/sme-contributions/[contributionId]
 *   Removes a contribution. Staff only.
 *
 * All endpoints require:
 * - requireStaffOrResponse() auth
 * - X-Company-Id header
 * - Solicitation must belong to the requesting company
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';
import { requireStaffOrResponse } from '@/lib/auth';
import type {
  SmeContributionCreateRequest,
} from '@/lib/supabase/tier2-types';

// ─── Shared auth + solicitation guard ────────────────────────────────────────

async function guardSolicitation(
  solicitationId: string,
  companyId: string
): Promise<{ ok: true } | NextResponse> {
  const supabase = getServerClient();
  const { data } = await supabase
    .from('solicitations')
    .select('id')
    .eq('id', solicitationId)
    .eq('company_id', companyId)
    .maybeSingle();
  if (!data) {
    return NextResponse.json({ error: 'Solicitation not found' }, { status: 404 });
  }
  return { ok: true };
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

    const guard = await guardSolicitation(solicitationId, companyId);
    if (guard instanceof NextResponse) return guard;

    const approvedOnly = request.nextUrl.searchParams.get('approved_only') === 'true';
    const supabase = getServerClient();

    let query = supabase
      .from('sme_contributions')
      .select('*')
      .eq('solicitation_id', solicitationId)
      .eq('company_id', companyId)
      .order('created_at', { ascending: true });

    if (approvedOnly) {
      query = query.eq('approved', true);
    }

    const { data: contributions, error } = await query;

    if (error) {
      console.error('SME contributions GET error:', error);
      return NextResponse.json({ error: 'Failed to fetch contributions' }, { status: 500 });
    }

    return NextResponse.json({ contributions: contributions ?? [] });
  } catch (error) {
    console.error('SME contributions GET error:', error);
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

    const guard = await guardSolicitation(solicitationId, companyId);
    if (guard instanceof NextResponse) return guard;

    const body = (await request.json()) as SmeContributionCreateRequest;

    if (!body.volume_name?.trim()) {
      return NextResponse.json({ error: 'volume_name is required' }, { status: 400 });
    }
    if (!body.topic?.trim()) {
      return NextResponse.json({ error: 'topic is required' }, { status: 400 });
    }
    if (!body.content?.trim()) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }
    if (!body.contributor_name?.trim()) {
      return NextResponse.json({ error: 'contributor_name is required' }, { status: 400 });
    }

    const supabase = getServerClient();

    const { data: contribution, error } = await supabase
      .from('sme_contributions')
      .insert({
        solicitation_id: solicitationId,
        company_id: companyId,
        volume_name: body.volume_name.trim(),
        topic: body.topic.trim(),
        content: body.content.trim(),
        contributor_name: body.contributor_name.trim(),
        contributor_title: body.contributor_title?.trim() ?? null,
        approved: false,
      })
      .select()
      .single();

    if (error) {
      console.error('SME contribution insert error:', error);
      return NextResponse.json({ error: 'Failed to create contribution' }, { status: 500 });
    }

    return NextResponse.json({ contribution }, { status: 201 });
  } catch (error) {
    console.error('SME contributions POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
