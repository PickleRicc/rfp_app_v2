import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: documentId } = await params;
    const supabase = getServerClient();

    // Get document status
    const { data: document } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Get recent processing logs for this document
    const { data: logs } = await supabase
      .from('processing_logs')
      .select('*')
      .eq('document_id', documentId)
      .order('created_at', { ascending: false })
      .limit(20);

    // Get requirements count
    const { count: requirementsCount } = await supabase
      .from('rfp_requirements')
      .select('*', { count: 'exact', head: true })
      .eq('document_id', documentId);

    // Get response data if available (might not exist yet)
    const { data: responses } = await supabase
      .from('rfp_responses')
      .select('id, status, requirements_coverage_percent, created_at, completed_at')
      .eq('document_id', documentId)
      .order('created_at', { ascending: false })
      .limit(1);

    const response = responses?.[0] || null;

    // Get volumes count if available
    let volumesCount = 0;
    if (response?.id) {
      const { count } = await supabase
        .from('proposal_volumes')
        .select('*', { count: 'exact', head: true })
        .eq('response_id', response.id);
      volumesCount = count || 0;
    }

    return NextResponse.json({
      document: {
        id: document.id,
        filename: document.filename,
        status: document.status,
        document_type: document.document_type,
        updated_at: document.updated_at,
      },
      progress: {
        requirementsExtracted: requirementsCount || 0,
        volumesGenerated: volumesCount || 0,
        coveragePercent: response?.requirements_coverage_percent || 0,
        responseId: response?.id,
        responseStatus: response?.status,
      },
      logs: logs || [],
      latestLog: logs?.[0] || null,
    });
  } catch (error) {
    console.error('Progress API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch progress' },
      { status: 500 }
    );
  }
}
