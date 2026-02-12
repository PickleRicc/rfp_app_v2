import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';
import { inngest } from '@/lib/inngest/client';
import { requireStaffOrResponse } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const auth = await requireStaffOrResponse();
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await request.json();
    const { documentId } = body;

    if (!documentId) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      );
    }

    const supabase = getServerClient();

    // Verify document exists and is an RFP
    const { data: document, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (error || !document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    if (document.document_type !== 'rfp') {
      return NextResponse.json(
        { error: 'Document must be an RFP to generate proposal' },
        { status: 400 }
      );
    }

    if (document.status !== 'completed' && document.status !== 'proposal_ready') {
      return NextResponse.json(
        { error: 'Document analysis must be completed first' },
        { status: 400 }
      );
    }

    // Trigger Stage 2: Proposal Generation
    await inngest.send({
      name: 'response.generate',
      data: {
        documentId: document.id,
      },
    });

    // Update document to indicate proposal is being generated
    await supabase
      .from('documents')
      .update({ 
        status: 'generating_proposal',
        updated_at: new Date().toISOString() 
      })
      .eq('id', documentId);

    return NextResponse.json({
      success: true,
      message: 'Proposal generation started',
      documentId: document.id,
    });
  } catch (error) {
    console.error('Generate proposal error:', error);
    return NextResponse.json(
      { error: 'Failed to start proposal generation' },
      { status: 500 }
    );
  }
}
