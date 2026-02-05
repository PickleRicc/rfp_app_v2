import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';
import { requireStaffOrResponse } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffOrResponse();
  if (auth instanceof NextResponse) return auth;
  try {
    const { id: documentId } = await params;
    const supabase = getServerClient();

    // Get document
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Get response record
    const { data: response, error: responseError } = await supabase
      .from('rfp_responses')
      .select('*')
      .eq('document_id', documentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (responseError || !response) {
      return NextResponse.json(
        { error: 'Proposal not found. It may still be generating.' },
        { status: 404 }
      );
    }

    // Get volumes
    const { data: volumes } = await supabase
      .from('proposal_volumes')
      .select('*')
      .eq('response_id', response.id)
      .order('volume_number');

    // Get requirements count and breakdown
    const { data: requirements } = await supabase
      .from('rfp_requirements')
      .select('id, category')
      .eq('document_id', documentId);

    const requirementsByCategory = requirements?.reduce((acc, req) => {
      acc[req.category] = (acc[req.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    return NextResponse.json({
      document: {
        id: document.id,
        filename: document.filename,
        status: document.status,
      },
      response: {
        id: response.id,
        status: response.status,
        requirements_coverage_percent: response.requirements_coverage_percent || 0,
        compliance_matrix_url: response.compliance_matrix_url,
        created_at: response.created_at,
        completed_at: response.completed_at,
      },
      volumes: volumes || [],
      requirements: {
        total: requirements?.length || 0,
        bycategory: requirementsByCategory,
      },
    });
  } catch (error) {
    console.error('Proposal API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch proposal' },
      { status: 500 }
    );
  }
}
