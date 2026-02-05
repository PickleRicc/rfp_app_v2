import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';
import { requireStaffOrResponse } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const auth = await requireStaffOrResponse();
  if (auth instanceof NextResponse) return auth;
  try {
    const supabase = getServerClient();
    
    // Get company context from header
    const companyId = request.headers.get('X-Company-Id');
    
    // Build query
    let query = supabase
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false });
    
    // Filter by company if provided
    if (companyId) {
      query = query.eq('company_id', companyId);
    }
    
    const { data: documents, error } = await query;

    if (error) {
      console.error('Fetch documents error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch documents' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      documents: documents || [],
      count: documents?.length || 0,
    });
  } catch (error) {
    console.error('Documents API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
