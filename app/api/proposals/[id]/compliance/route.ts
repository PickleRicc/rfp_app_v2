import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';
import { readFile } from 'fs/promises';
import { requireStaffOrResponse } from '@/lib/auth';

/**
 * GET /api/proposals/[id]/compliance
 * Get compliance matrix for a proposal
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffOrResponse();
  if (auth instanceof NextResponse) return auth;
  try {
    const { id: documentId } = await params;
    const supabase = getServerClient();

    // Get response with compliance info
    const { data: response, error } = await supabase
      .from('rfp_responses')
      .select('id, compliance_matrix_url, requirements_coverage_percent, document_id')
      .eq('document_id', documentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !response) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    // If compliance matrix file requested, return the file
    const { searchParams } = new URL(request.url);
    if (searchParams.get('download') === 'true' && response.compliance_matrix_url) {
      try {
        const fileBuffer = await readFile(response.compliance_matrix_url);
        return new NextResponse(fileBuffer, {
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="compliance-matrix-${documentId}.xlsx"`,
          },
        });
      } catch (error) {
        console.error('Error reading compliance matrix:', error);
        return NextResponse.json({ error: 'File not found' }, { status: 404 });
      }
    }

    // Get requirements for the document
    const { data: requirements } = await supabase
      .from('rfp_requirements')
      .select('*')
      .eq('document_id', response.document_id)
      .order('requirement_number');

    // Calculate compliance breakdown
    const breakdown = {
      total: requirements?.length || 0,
      addressed: 0,
      not_addressed: 0,
      by_category: {} as Record<string, { total: number; addressed: number }>,
    };

    if (requirements) {
      for (const req of requirements) {
        // Initialize category if not exists
        if (!breakdown.by_category[req.category]) {
          breakdown.by_category[req.category] = { total: 0, addressed: 0 };
        }
        
        breakdown.by_category[req.category].total++;
        
        // Simplified: assume all are addressed for now
        // In full implementation, would check actual mappings
        breakdown.addressed++;
        breakdown.by_category[req.category].addressed++;
      }
      
      breakdown.not_addressed = breakdown.total - breakdown.addressed;
    }

    return NextResponse.json({
      compliance_matrix_url: response.compliance_matrix_url,
      coverage_percent: response.requirements_coverage_percent || 0,
      breakdown,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

