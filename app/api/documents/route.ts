import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';

export async function GET(request: NextRequest) {
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
