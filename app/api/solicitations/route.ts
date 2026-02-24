import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';
import { requireStaffOrResponse } from '@/lib/auth';
import type { CreateSolicitationRequest } from '@/lib/supabase/solicitation-types';

/**
 * GET /api/solicitations
 * List all solicitations for the requesting company.
 * Requires X-Company-Id header.
 * Returns solicitations ordered by created_at DESC with document_count.
 */
export async function GET(request: NextRequest) {
  const auth = await requireStaffOrResponse();
  if (auth instanceof NextResponse) return auth;

  try {
    const companyId = request.headers.get('X-Company-Id');

    if (!companyId) {
      return NextResponse.json(
        { error: 'X-Company-Id header is required' },
        { status: 400 }
      );
    }

    const supabase = getServerClient();

    const { data: solicitations, error } = await supabase
      .from('solicitations')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Fetch solicitations error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch solicitations' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      solicitations: solicitations || [],
      count: solicitations?.length || 0,
    });
  } catch (error) {
    console.error('Solicitations GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/solicitations
 * Create a new solicitation for the requesting company.
 * Requires X-Company-Id header.
 * Body: { solicitation_number: string, title?: string, agency?: string }
 *
 * Returns 201 on success, 400 on validation failure, 409 on duplicate.
 */
export async function POST(request: NextRequest) {
  const auth = await requireStaffOrResponse();
  if (auth instanceof NextResponse) return auth;

  try {
    const companyId = request.headers.get('X-Company-Id');

    if (!companyId) {
      return NextResponse.json(
        { error: 'X-Company-Id header is required' },
        { status: 400 }
      );
    }

    const body: CreateSolicitationRequest = await request.json();

    // Validate required fields
    if (!body.solicitation_number || body.solicitation_number.trim() === '') {
      return NextResponse.json(
        { error: 'solicitation_number is required and cannot be empty' },
        { status: 400 }
      );
    }

    const solicitationNumber = body.solicitation_number.trim();
    const supabase = getServerClient();

    // Check for duplicate (same company + solicitation_number)
    const { data: existing } = await supabase
      .from('solicitations')
      .select('id')
      .eq('company_id', companyId)
      .eq('solicitation_number', solicitationNumber)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        {
          error: `Solicitation ${solicitationNumber} already exists for this company`,
          existing_id: existing.id,
        },
        { status: 409 }
      );
    }

    // Create the solicitation
    const { data: solicitation, error } = await supabase
      .from('solicitations')
      .insert({
        company_id: companyId,
        solicitation_number: solicitationNumber,
        title: body.title?.trim() || null,
        agency: body.agency?.trim() || null,
        status: 'uploading',
        document_count: 0,
      })
      .select()
      .single();

    if (error) {
      console.error('Create solicitation error:', error);
      return NextResponse.json(
        { error: 'Failed to create solicitation' },
        { status: 500 }
      );
    }

    return NextResponse.json({ solicitation }, { status: 201 });
  } catch (error) {
    console.error('Solicitations POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
