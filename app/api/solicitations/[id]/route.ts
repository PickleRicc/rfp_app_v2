import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';
import { requireStaffOrResponse } from '@/lib/auth';
import type { UpdateSolicitationRequest } from '@/lib/supabase/solicitation-types';

/**
 * GET /api/solicitations/[id]
 * Fetch a single solicitation by ID with its documents.
 * Requires X-Company-Id header for company ownership verification.
 *
 * Returns the solicitation with a documents array ordered by:
 * sort_order ASC, then document_type ASC.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const { id } = params;
    const supabase = getServerClient();

    // Fetch the solicitation, verify it belongs to the requesting company
    const { data: solicitation, error: solError } = await supabase
      .from('solicitations')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId)
      .single();

    if (solError || !solicitation) {
      return NextResponse.json(
        { error: 'Solicitation not found' },
        { status: 404 }
      );
    }

    // Fetch associated documents ordered by sort_order, document_type
    const { data: documents, error: docsError } = await supabase
      .from('solicitation_documents')
      .select('*')
      .eq('solicitation_id', id)
      .order('sort_order', { ascending: true })
      .order('document_type', { ascending: true });

    if (docsError) {
      console.error('Fetch solicitation documents error:', docsError);
      return NextResponse.json(
        { error: 'Failed to fetch solicitation documents' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      solicitation: {
        ...solicitation,
        documents: documents || [],
      },
    });
  } catch (error) {
    console.error('Solicitation GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/solicitations/[id]
 * Update solicitation fields (title, agency, status).
 * Requires X-Company-Id header for company ownership verification.
 *
 * Body: { title?: string, agency?: string, status?: SolicitationStatus }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const { id } = params;
    const supabase = getServerClient();

    // Verify the solicitation belongs to the requesting company before modifying
    const { data: existing } = await supabase
      .from('solicitations')
      .select('id')
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json(
        { error: 'Solicitation not found' },
        { status: 404 }
      );
    }

    const body: UpdateSolicitationRequest = await request.json();

    // Build update payload — only include fields that were provided
    const updatePayload: Record<string, string | null> = {
      updated_at: new Date().toISOString(),
    };

    if (body.title !== undefined) {
      updatePayload.title = body.title?.trim() || null;
    }
    if (body.agency !== undefined) {
      updatePayload.agency = body.agency?.trim() || null;
    }
    if (body.status !== undefined) {
      const validStatuses = ['uploading', 'classifying', 'reconciling', 'ready', 'failed'];
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
          { status: 400 }
        );
      }
      updatePayload.status = body.status;
    }

    const { data: solicitation, error } = await supabase
      .from('solicitations')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Update solicitation error:', error);
      return NextResponse.json(
        { error: 'Failed to update solicitation' },
        { status: 500 }
      );
    }

    return NextResponse.json({ solicitation });
  } catch (error) {
    console.error('Solicitation PATCH error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
