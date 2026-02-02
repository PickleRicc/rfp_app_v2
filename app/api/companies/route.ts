import { NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';

export async function GET() {
  try {
    const supabase = getServerClient();

    const { data: companies, error } = await supabase
      .from('company_profiles')
      .select('id, company_name, legal_name, cage_code, uei_number, elevator_pitch, completeness_score')
      .order('company_name', { ascending: true });

    if (error) {
      console.error('Error fetching companies:', error);
      return NextResponse.json(
        { error: 'Failed to fetch companies' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      companies: companies || [],
    });
  } catch (error) {
    console.error('Companies fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
