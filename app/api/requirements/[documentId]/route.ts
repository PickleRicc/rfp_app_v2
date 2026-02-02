import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';

/**
 * GET /api/requirements/[documentId]
 * Get all requirements extracted from an RFP document
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { documentId: string } }
) {
  try {
    const supabase = getServerClient();

    const { data: requirements, error } = await supabase
      .from('rfp_requirements')
      .select('*')
      .eq('document_id', params.documentId)
      .order('requirement_number');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Calculate statistics
    const stats = {
      total: requirements?.length || 0,
      by_category: {} as Record<string, number>,
      by_priority: {} as Record<string, number>,
    };

    if (requirements) {
      for (const req of requirements) {
        // Count by category
        stats.by_category[req.category] = (stats.by_category[req.category] || 0) + 1;
        
        // Count by priority
        stats.by_priority[req.priority] = (stats.by_priority[req.priority] || 0) + 1;
      }
    }

    return NextResponse.json({
      requirements: requirements || [],
      statistics: stats,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
