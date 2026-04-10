/**
 * GET  /api/solicitations/[id]/boe
 *   Returns the current BoeAssessment row (or null if none exists yet).
 *
 * POST /api/solicitations/[id]/boe
 *   Validates that compliance extractions exist, upserts a pending
 *   boe_assessments row, and fires the 'boe.generate' Inngest event.
 *
 * Requires:
 * - requireStaffOrResponse() auth
 * - X-Company-Id header
 * - Solicitation must belong to the requesting company
 * - POST only: compliance_extractions must exist (count > 0)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';
import { requireStaffOrResponse } from '@/lib/auth';
import { inngest } from '@/lib/inngest/client';
import type { BoeGetResponse, BoeTriggerResponse } from '@/lib/supabase/boe-types';

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

    // Fetch boe_assessments row
    const { data: assessment } = await supabase
      .from('boe_assessments')
      .select('*')
      .eq('solicitation_id', solicitationId)
      .eq('company_id', companyId)
      .maybeSingle();

    const response: BoeGetResponse = {
      assessment: assessment ?? null,
      status: assessment?.status ?? 'not_started',
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('BOE GET error:', error);
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

    // Verify compliance extractions exist
    const { count: extractionCount } = await supabase
      .from('compliance_extractions')
      .select('id', { count: 'exact', head: true })
      .eq('solicitation_id', solicitationId);

    if (!extractionCount || extractionCount === 0) {
      return NextResponse.json(
        {
          error:
            'Compliance extraction must be completed before generating BOE',
        },
        { status: 400 }
      );
    }

    // Upsert boe_assessments with pending status
    const { data: assessment, error: upsertError } = await supabase
      .from('boe_assessments')
      .upsert(
        {
          solicitation_id: solicitationId,
          company_id: companyId,
          status: 'pending',
          error_message: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'solicitation_id,company_id' }
      )
      .select()
      .single();

    if (upsertError || !assessment) {
      console.error('BOE assessment upsert error:', upsertError);
      return NextResponse.json(
        { error: 'Failed to create BOE assessment record' },
        { status: 500 }
      );
    }

    // Fire Inngest event
    await inngest.send({
      name: 'boe.generate',
      data: {
        solicitationId,
        companyId,
      },
    });

    const response: BoeTriggerResponse = {
      assessment,
      message: 'BOE generation started',
    };

    return NextResponse.json(response, { status: 202 });
  } catch (error) {
    console.error('BOE POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
