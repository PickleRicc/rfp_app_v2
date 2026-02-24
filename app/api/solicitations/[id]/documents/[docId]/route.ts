/**
 * GET /api/solicitations/[id]/documents/[docId]
 * Fetch a single solicitation document with its reconciliation records and
 * template field mappings.
 *
 * PATCH /api/solicitations/[id]/documents/[docId]
 * Update document fields. Supports:
 * - document_type + document_type_label (reclassification from UI dropdown)
 * - classification_confidence (reset to 'high' on manual reclassify)
 * - sort_order (reordering within the solicitation)
 *
 * Both endpoints require:
 * - requireStaffOrResponse() auth
 * - X-Company-Id header
 * - Solicitation must belong to the requesting company
 * - Document must belong to the specified solicitation
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';
import { requireStaffOrResponse } from '@/lib/auth';
import {
  DOCUMENT_TYPE_LABELS,
  type SolicitationDocumentType,
} from '@/lib/supabase/solicitation-types';

/**
 * GET /api/solicitations/[id]/documents/[docId]
 * Returns the document with its reconciliation records and template field mappings.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const auth = await requireStaffOrResponse();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id: solicitationId, docId } = await params;
    const companyId = request.headers.get('X-Company-Id');

    if (!companyId) {
      return NextResponse.json(
        { error: 'X-Company-Id header is required' },
        { status: 400 }
      );
    }
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

    // Fetch the document, ensuring it belongs to this solicitation
    const { data: document, error: docError } = await supabase
      .from('solicitation_documents')
      .select('*')
      .eq('id', docId)
      .eq('solicitation_id', solicitationId)
      .single();

    if (docError || !document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Fetch reconciliation records where this document is source or target
    const { data: reconciliations } = await supabase
      .from('document_reconciliations')
      .select('*')
      .or(`source_document_id.eq.${docId},target_document_id.eq.${docId}`)
      .eq('solicitation_id', solicitationId)
      .order('created_at', { ascending: true });

    // Fetch template field mappings for this document
    const { data: templateFields } = await supabase
      .from('template_field_mappings')
      .select('*')
      .eq('solicitation_document_id', docId)
      .order('created_at', { ascending: true });

    return NextResponse.json({
      document,
      reconciliations: reconciliations || [],
      template_fields: templateFields || [],
    });
  } catch (error) {
    console.error('Document GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/solicitations/[id]/documents/[docId]
 * Update document fields for reclassification or reordering.
 *
 * Supported fields:
 * - document_type: SolicitationDocumentType — reclassifies the document
 * - document_type_label: string — auto-derived from document_type if not provided
 * - classification_confidence: 'high' | 'medium' | 'low' — reset to 'high' on manual reclassify
 * - sort_order: number — reorder within the solicitation document list
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const auth = await requireStaffOrResponse();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id: solicitationId, docId } = await params;
    const companyId = request.headers.get('X-Company-Id');

    if (!companyId) {
      return NextResponse.json(
        { error: 'X-Company-Id header is required' },
        { status: 400 }
      );
    }

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

    // Verify the document belongs to this solicitation
    const { data: existingDoc } = await supabase
      .from('solicitation_documents')
      .select('id, document_type')
      .eq('id', docId)
      .eq('solicitation_id', solicitationId)
      .maybeSingle();

    if (!existingDoc) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    const body: {
      document_type?: string;
      document_type_label?: string;
      classification_confidence?: string;
      sort_order?: number;
    } = await request.json();

    // Validate document_type if provided
    const validDocumentTypes: SolicitationDocumentType[] = [
      'base_rfp',
      'soo_sow_pws',
      'amendment',
      'qa_response',
      'pricing_template',
      'dd254',
      'clauses',
      'cdrls',
      'wage_determination',
      'provisions',
      'other_unclassified',
    ];

    if (body.document_type !== undefined) {
      if (!validDocumentTypes.includes(body.document_type as SolicitationDocumentType)) {
        return NextResponse.json(
          {
            error: `Invalid document_type. Must be one of: ${validDocumentTypes.join(', ')}`,
          },
          { status: 400 }
        );
      }
    }

    // Validate classification_confidence if provided
    const validConfidences = ['high', 'medium', 'low'];
    if (
      body.classification_confidence !== undefined &&
      !validConfidences.includes(body.classification_confidence)
    ) {
      return NextResponse.json(
        { error: `Invalid classification_confidence. Must be one of: ${validConfidences.join(', ')}` },
        { status: 400 }
      );
    }

    // Build update payload — only include provided fields
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.document_type !== undefined) {
      const newType = body.document_type as SolicitationDocumentType;
      updatePayload.document_type = newType;

      // Auto-derive label from DOCUMENT_TYPE_LABELS if not explicitly provided
      updatePayload.document_type_label =
        body.document_type_label ?? DOCUMENT_TYPE_LABELS[newType];

      // Manual reclassification always resets confidence to 'high'
      // (user has reviewed and confirmed — more certain than AI)
      updatePayload.classification_confidence = 'high';
    }

    if (body.classification_confidence !== undefined && body.document_type === undefined) {
      // Allow explicit confidence update without reclassification
      updatePayload.classification_confidence = body.classification_confidence;
    }

    if (body.sort_order !== undefined) {
      if (typeof body.sort_order !== 'number' || body.sort_order < 0) {
        return NextResponse.json(
          { error: 'sort_order must be a non-negative number' },
          { status: 400 }
        );
      }
      updatePayload.sort_order = body.sort_order;
    }

    // Require at least one field to update
    if (Object.keys(updatePayload).length <= 1) {
      return NextResponse.json(
        { error: 'No valid fields provided for update' },
        { status: 400 }
      );
    }

    const { data: updatedDoc, error } = await supabase
      .from('solicitation_documents')
      .update(updatePayload)
      .eq('id', docId)
      .select()
      .single();

    if (error) {
      console.error('Update document error:', error);
      return NextResponse.json(
        { error: 'Failed to update document' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      document: updatedDoc,
      reclassified: body.document_type !== undefined,
    });
  } catch (error) {
    console.error('Document PATCH error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
