import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';
import { requireStaffOrResponse } from '@/lib/auth';

/**
 * GET /api/capture/[id]
 * Fetch a single opportunity analysis with its documents.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffOrResponse();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const supabase = getServerClient();

    const { data: analysis, error } = await supabase
      .from('opportunity_analyses')
      .select('*')
      .eq('id', id)
      .eq('created_by', auth.userId!)
      .single();

    if (error || !analysis) {
      return NextResponse.json(
        { error: 'Analysis not found' },
        { status: 404 }
      );
    }

    const { data: documents } = await supabase
      .from('opportunity_documents')
      .select('*')
      .eq('analysis_id', id)
      .order('created_at', { ascending: true });

    return NextResponse.json({
      analysis,
      documents: documents || [],
    });
  } catch (error) {
    console.error('Capture GET [id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/capture/[id]
 * Delete an opportunity analysis and its documents.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffOrResponse();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const supabase = getServerClient();

    const { data: analysis } = await supabase
      .from('opportunity_analyses')
      .select('id')
      .eq('id', id)
      .eq('created_by', auth.userId!)
      .single();

    if (!analysis) {
      return NextResponse.json(
        { error: 'Analysis not found' },
        { status: 404 }
      );
    }

    const { error } = await supabase
      .from('opportunity_analyses')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Delete analysis error:', error);
      return NextResponse.json(
        { error: 'Failed to delete analysis' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Capture DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
