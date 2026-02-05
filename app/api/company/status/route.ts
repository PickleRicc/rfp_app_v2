import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';
import { calculateCompleteness } from '@/lib/supabase/company-types';
import { getCompanyIdOrResponse } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const resolved = await getCompanyIdOrResponse(request);
  if (resolved instanceof NextResponse) return resolved;
  const { companyId } = resolved;
  try {

    const supabase = getServerClient();

    // Check if company profile exists
    const { data: profile, error: profileError } = await supabase
      .from('company_profiles')
      .select('*')
      .eq('id', companyId)
      .single();

    if (profileError) {
      if (profileError.code === 'PGRST116') {
        return NextResponse.json({
          hasProfile: false,
          completeness: null,
        });
      }
      console.error('Error fetching profile:', profileError);
      return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
    }

    // Fetch all related data for completeness calculation
    const [
      { data: certifications },
      { data: serviceAreas },
      { data: pastPerformance },
      { data: personnel },
      { data: valuePropositions },
    ] = await Promise.all([
      supabase.from('certifications').select('*').eq('company_id', profile.id),
      supabase.from('service_areas').select('*').eq('company_id', profile.id),
      supabase.from('past_performance').select('*').eq('company_id', profile.id),
      supabase.from('personnel').select('*').eq('company_id', profile.id),
      supabase.from('value_propositions').select('*').eq('company_id', profile.id),
    ]);

    const completeness = calculateCompleteness(
      profile,
      certifications || [],
      serviceAreas || [],
      pastPerformance || [],
      personnel || [],
      valuePropositions || []
    );

    return NextResponse.json({
      hasProfile: true,
      completeness,
    });
  } catch (error) {
    console.error('Status check error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
