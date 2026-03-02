import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';
import { requireStaffOrResponse } from '@/lib/auth';
import { inngest } from '@/lib/inngest/client';

/**
 * POST /api/capture/[id]/analyze
 * Trigger the AI opportunity confirmation analysis.
 * Validates documents are uploaded, then fires the Inngest event.
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

    if (analysis.status === 'analyzing') {
      return NextResponse.json(
        { error: 'Analysis is already running' },
        { status: 409 }
      );
    }

    const { data: documents } = await supabase
      .from('opportunity_documents')
      .select('id, document_type, processing_status')
      .eq('analysis_id', analysisId);

    if (!documents || documents.length === 0) {
      return NextResponse.json(
        { error: 'No documents uploaded. Upload documents before analyzing.' },
        { status: 400 }
      );
    }

    const rfpDocs = documents.filter(
      (d) => d.document_type !== 'past_performance'
    );

    if (rfpDocs.length === 0) {
      return NextResponse.json(
        { error: 'At least one RFP/RFI/SOW document is required.' },
        { status: 400 }
      );
    }

    if (analysis.mode === 'raw') {
      const ppDocs = documents.filter(
        (d) => d.document_type === 'past_performance'
      );
      if (ppDocs.length === 0) {
        return NextResponse.json(
          {
            error:
              'Raw mode requires at least one past performance document.',
          },
          { status: 400 }
        );
      }
    }

    await supabase
      .from('opportunity_analyses')
      .update({ status: 'analyzing', updated_at: new Date().toISOString() })
      .eq('id', analysisId);

    await inngest.send({
      name: 'opportunity.confirmation.analyze',
      data: {
        analysisId,
        mode: analysis.mode,
        companyId: analysis.company_id,
      },
    });

    return NextResponse.json({ success: true, status: 'analyzing' });
  } catch (error) {
    console.error('Capture analyze error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
