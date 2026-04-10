/**
 * PATCH /api/solicitations/[id]/sme-contributions/[contributionId]
 *   Update content, approval status, or contributor title.
 *   To approve: { approved: true, approved_by: "PM Name" }
 *   To revoke:  { approved: false }
 *
 * DELETE /api/solicitations/[id]/sme-contributions/[contributionId]
 *   Remove a contribution entirely. Staff only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';
import { requireStaffOrResponse } from '@/lib/auth';
import type { SmeContributionUpdateRequest } from '@/lib/supabase/tier2-types';

// ─── PATCH ────────────────────────────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; contributionId: string }> }
) {
  const auth = await requireStaffOrResponse();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id: solicitationId, contributionId } = await params;
    const companyId = request.headers.get('X-Company-Id');

    if (!companyId) {
      return NextResponse.json({ error: 'X-Company-Id header is required' }, { status: 400 });
    }

    const body = (await request.json()) as SmeContributionUpdateRequest;

    // Validate approval: approved_by required when approving
    if (body.approved === true && !body.approved_by?.trim()) {
      return NextResponse.json(
        { error: 'approved_by is required when approving a contribution' },
        { status: 400 }
      );
    }

    const supabase = getServerClient();

    // Build update payload — only include fields that were provided
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (body.topic !== undefined) updates.topic = body.topic.trim();
    if (body.content !== undefined) updates.content = body.content.trim();
    if (body.contributor_title !== undefined) updates.contributor_title = body.contributor_title.trim() || null;

    if (body.approved === true) {
      updates.approved = true;
      updates.approved_by = body.approved_by!.trim();
      updates.approved_at = new Date().toISOString();
    } else if (body.approved === false) {
      updates.approved = false;
      updates.approved_by = null;
      updates.approved_at = null;
    }

    const { data: contribution, error } = await supabase
      .from('sme_contributions')
      .update(updates)
      .eq('id', contributionId)
      .eq('solicitation_id', solicitationId)
      .eq('company_id', companyId)
      .select()
      .single();

    if (error || !contribution) {
      return NextResponse.json({ error: 'Contribution not found or update failed' }, { status: 404 });
    }

    return NextResponse.json({ contribution });
  } catch (error) {
    console.error('SME contribution PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; contributionId: string }> }
) {
  const auth = await requireStaffOrResponse();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id: solicitationId, contributionId } = await params;
    const companyId = request.headers.get('X-Company-Id');

    if (!companyId) {
      return NextResponse.json({ error: 'X-Company-Id header is required' }, { status: 400 });
    }

    const supabase = getServerClient();

    const { error } = await supabase
      .from('sme_contributions')
      .delete()
      .eq('id', contributionId)
      .eq('solicitation_id', solicitationId)
      .eq('company_id', companyId);

    if (error) {
      return NextResponse.json({ error: 'Contribution not found or delete failed' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('SME contribution DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
