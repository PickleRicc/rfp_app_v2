import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';
import { requireStaffOrResponse } from '@/lib/auth';
import { inngest } from '@/lib/inngest/client';

/**
 * POST /api/capture/[id]/find-opportunities
 * Trigger the AI-powered opportunity finder pipeline.
 * Requires at least one company_data document uploaded.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffOrResponse();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id: analysisId } = await params;
    const supabase = getServerClient();

    const { data: analysis } = await supabase
      .from('opportunity_analyses')
      .select('*')
      .eq('id', analysisId)
      .eq('created_by', auth.userId!)
      .single();

    if (!analysis) {
      return NextResponse.json(
        { error: 'Analysis not found' },
        { status: 404 }
      );
    }

    if (analysis.mode !== 'finder') {
      return NextResponse.json(
        { error: 'This analysis is not in finder mode' },
        { status: 400 }
      );
    }

    if (analysis.status === 'analyzing') {
      return NextResponse.json(
        { error: 'Analysis is already running' },
        { status: 409 }
      );
    }

    // Check for uploaded company data documents
    const { data: documents } = await supabase
      .from('opportunity_documents')
      .select('id, document_type, processing_status, extracted_text')
      .eq('analysis_id', analysisId);

    const companyDocs = (documents || []).filter(
      (d: { document_type: string }) => d.document_type === 'company_data'
    );

    if (companyDocs.length === 0) {
      return NextResponse.json(
        { error: 'Upload at least one company data document before searching.' },
        { status: 400 }
      );
    }

    // Mark as analyzing
    await supabase
      .from('opportunity_analyses')
      .update({ status: 'analyzing', updated_at: new Date().toISOString() })
      .eq('id', analysisId);

    // Fire Inngest event
    await inngest.send({
      name: 'opportunity.finder.search',
      data: {
        analysisId,
        companyId: analysis.company_id,
      },
    });

    return NextResponse.json({ success: true, status: 'analyzing' });
  } catch (error) {
    console.error('Find opportunities error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
