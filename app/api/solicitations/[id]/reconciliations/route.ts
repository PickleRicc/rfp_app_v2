/**
 * GET /api/solicitations/[id]/reconciliations
 * List all reconciliation records for a solicitation with source/target document filenames.
 *
 * PATCH /api/solicitations/[id]/reconciliations
 * Toggle is_active on a reconciliation record.
 * Body: { reconciliation_id: string, is_active: boolean }
 *
 * Per user decision: "Users can undo/restore reconciliation changes via is_active toggle"
 * — is_active=false restores original text, is_active=true re-applies the change.
 *
 * Both endpoints require:
 * - requireStaffOrResponse() auth
 * - X-Company-Id header
 * - Solicitation must belong to the requesting company
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';
import { requireStaffOrResponse } from '@/lib/auth';

/**
 * GET /api/solicitations/[id]/reconciliations
 * Returns all reconciliation records for the solicitation, enriched with
 * source and target document filenames for display.
 * Ordered by created_at ASC.
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

    const { id: solicitationId } = params;
    const supabase = getServerClient();

    // Verify the solicitation belongs to the requesting company
    const { data: solicitation } = await supabase
      .from('solicitations')
      .select('id, solicitation_number')
      .eq('id', solicitationId)
      .eq('company_id', companyId)
      .maybeSingle();

    if (!solicitation) {
      return NextResponse.json(
        { error: 'Solicitation not found' },
        { status: 404 }
      );
    }

    // Fetch reconciliation records ordered by created_at
    const { data: reconciliations, error } = await supabase
      .from('document_reconciliations')
      .select(`
        id,
        solicitation_id,
        source_document_id,
        target_document_id,
        change_type,
        source_type,
        section_reference,
        original_text,
        replacement_text,
        is_active,
        created_at
      `)
      .eq('solicitation_id', solicitationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Fetch reconciliations error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch reconciliation records' },
        { status: 500 }
      );
    }

    // Enrich with source and target document filenames
    // Collect all unique document IDs referenced
    const allReconciliations = reconciliations || [];
    const documentIds = new Set<string>();
    for (const rec of allReconciliations) {
      documentIds.add(rec.source_document_id);
      if (rec.target_document_id) documentIds.add(rec.target_document_id);
    }

    // Fetch document filenames for all referenced docs
    let documentFilenames: Record<string, string> = {};
    if (documentIds.size > 0) {
      const { data: docs } = await supabase
        .from('solicitation_documents')
        .select('id, filename, document_type, document_type_label')
        .in('id', Array.from(documentIds));

      if (docs) {
        for (const doc of docs) {
          documentFilenames[doc.id] = doc.filename;
        }
      }
    }

    // Enrich reconciliation records with filenames
    const enrichedReconciliations = allReconciliations.map((rec) => ({
      ...rec,
      source_document_filename: documentFilenames[rec.source_document_id] || null,
      target_document_filename: rec.target_document_id
        ? documentFilenames[rec.target_document_id] || null
        : null,
    }));

    return NextResponse.json({
      solicitation_id: solicitationId,
      solicitation_number: solicitation.solicitation_number,
      reconciliations: enrichedReconciliations,
      count: enrichedReconciliations.length,
    });
  } catch (error) {
    console.error('Reconciliations GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/solicitations/[id]/reconciliations
 * Toggle is_active on a single reconciliation record.
 *
 * Body: { reconciliation_id: string, is_active: boolean }
 *
 * is_active=false — User is "undoing" this reconciliation change (restoring original text).
 * is_active=true  — User is re-applying the change after having undone it.
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

    const { id: solicitationId } = params;
    const supabase = getServerClient();

    // Verify the solicitation belongs to the requesting company
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

    const body: { reconciliation_id: string; is_active: boolean } = await request.json();

    if (!body.reconciliation_id) {
      return NextResponse.json(
        { error: 'reconciliation_id is required' },
        { status: 400 }
      );
    }

    if (typeof body.is_active !== 'boolean') {
      return NextResponse.json(
        { error: 'is_active must be a boolean' },
        { status: 400 }
      );
    }

    // Update the reconciliation record, verifying it belongs to this solicitation
    const { data: reconciliation, error } = await supabase
      .from('document_reconciliations')
      .update({ is_active: body.is_active })
      .eq('id', body.reconciliation_id)
      .eq('solicitation_id', solicitationId)
      .select()
      .single();

    if (error || !reconciliation) {
      console.error('Update reconciliation error:', error);
      return NextResponse.json(
        { error: 'Reconciliation record not found or update failed' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      reconciliation,
      message: body.is_active
        ? 'Reconciliation change re-applied'
        : 'Reconciliation change undone — original text restored',
    });
  } catch (error) {
    console.error('Reconciliations PATCH error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
