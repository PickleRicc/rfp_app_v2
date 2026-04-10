/**
 * GET  /api/solicitations/[id]/p2w
 *   Returns the current P2wAnalysis row (or null if none exists yet),
 *   plus boe_status and overall status for the UI polling loop.
 *
 * POST /api/solicitations/[id]/p2w
 *   Validates that a completed BOE assessment exists, upserts a pending
 *   p2w_analyses row, and fires the 'p2w.analyze' Inngest event.
 *
 * Requires:
 * - requireStaffOrResponse() auth
 * - X-Company-Id header
 * - Solicitation must belong to the requesting company
 * - POST only: boe_assessments row must exist with status='completed'
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';
import { requireStaffOrResponse } from '@/lib/auth';
import { inngest } from '@/lib/inngest/client';
import type { P2wGetResponse, P2wTriggerResponse } from '@/lib/supabase/p2w-types';

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
      return NextResponse.json(
        { error: 'X-Company-Id header is required' },
        { status: 400 }
      );
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
      return NextResponse.json(
        { error: 'Solicitation not found' },
        { status: 404 }
      );
    }

    // Fetch boe_assessments and p2w_analyses in parallel
    const [{ data: boeRow }, { data: p2wRow }] = await Promise.all([
      supabase
        .from('boe_assessments')
        .select('status')
        .eq('solicitation_id', solicitationId)
        .eq('company_id', companyId)
        .maybeSingle(),
      supabase
        .from('p2w_analyses')
        .select('*')
        .eq('solicitation_id', solicitationId)
        .eq('company_id', companyId)
        .maybeSingle(),
    ]);

    const response: P2wGetResponse = {
      analysis: p2wRow ?? null,
      boe_status: boeRow?.status ?? 'not_started',
      status: p2wRow?.status ?? 'not_started',
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('P2W GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

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
      return NextResponse.json(
        { error: 'X-Company-Id header is required' },
        { status: 400 }
      );
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
      return NextResponse.json(
        { error: 'Solicitation not found' },
        { status: 404 }
      );
    }

    // Verify BOE assessment is completed
    const { data: boeRow } = await supabase
      .from('boe_assessments')
      .select('id, status')
      .eq('solicitation_id', solicitationId)
      .eq('company_id', companyId)
      .maybeSingle();

    if (!boeRow || boeRow.status !== 'completed') {
      return NextResponse.json(
        { error: 'BOE assessment must be completed before generating P2W analysis' },
        { status: 400 }
      );
    }

    // Upsert p2w_analyses with pending status
    const { data: analysis, error: upsertError } = await supabase
      .from('p2w_analyses')
      .upsert(
        {
          solicitation_id: solicitationId,
          company_id: companyId,
          boe_assessment_id: boeRow.id,
          status: 'pending',
          error_message: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'solicitation_id,company_id' }
      )
      .select()
      .single();

    if (upsertError || !analysis) {
      console.error('P2W analysis upsert error:', upsertError);
      return NextResponse.json(
        { error: 'Failed to create P2W analysis record' },
        { status: 500 }
      );
    }

    // Fire Inngest event
    await inngest.send({
      name: 'p2w.analyze',
      data: {
        solicitationId,
        companyId,
        boeAssessmentId: boeRow.id,
      },
    });

    const response: P2wTriggerResponse = {
      analysis,
      message: 'P2W analysis started',
    };

    return NextResponse.json(response, { status: 202 });
  } catch (error) {
    console.error('P2W POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
