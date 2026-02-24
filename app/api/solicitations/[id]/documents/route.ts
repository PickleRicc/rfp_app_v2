import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';
import { requireStaffOrResponse } from '@/lib/auth';

/**
 * GET /api/solicitations/[id]/documents
 * List all documents for a solicitation with classification data.
 * Requires X-Company-Id header for company ownership verification.
 *
 * Returns documents ordered by:
 * 1. Amendments first (ordered by amendment_number)
 * 2. All other document types ordered by sort_order
 *
 * Includes: classification data, processing status, amendment info, superseded state.
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

    // Verify the solicitation belongs to the requesting company
    const { data: solicitation } = await supabase
      .from('solicitations')
      .select('id, solicitation_number, status')
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle();

    if (!solicitation) {
      return NextResponse.json(
        { error: 'Solicitation not found' },
        { status: 404 }
      );
    }

    // Fetch all documents for this solicitation
    // Order: amendments by amendment_number first, then everything else by sort_order
    // Supabase doesn't support conditional ordering, so we fetch all and sort in application
    const { data: documents, error } = await supabase
      .from('solicitation_documents')
      .select(`
        id,
        solicitation_id,
        filename,
        file_path,
        file_size,
        mime_type,
        document_type,
        document_type_label,
        classification_confidence,
        classification_reasoning,
        amendment_number,
        effective_date,
        is_superseded,
        superseded_by,
        processing_status,
        error_message,
        sort_order,
        created_at,
        updated_at
      `)
      .eq('solicitation_id', id)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Fetch documents error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch solicitation documents' },
        { status: 500 }
      );
    }

    const allDocuments = documents || [];

    // Sort: amendments first (by amendment_number), then other types by sort_order
    const amendments = allDocuments
      .filter(d => d.document_type === 'amendment')
      .sort((a, b) => {
        if (a.amendment_number && b.amendment_number) {
          return a.amendment_number.localeCompare(b.amendment_number);
        }
        return 0;
      });

    const others = allDocuments
      .filter(d => d.document_type !== 'amendment')
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

    const sortedDocuments = [...amendments, ...others];

    return NextResponse.json({
      solicitation_id: id,
      solicitation_number: solicitation.solicitation_number,
      solicitation_status: solicitation.status,
      documents: sortedDocuments,
      count: sortedDocuments.length,
    });
  } catch (error) {
    console.error('Solicitation documents GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
