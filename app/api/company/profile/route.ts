import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';
import { requireStaffOrResponse, getCompanyIdOrResponse } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const auth = await requireStaffOrResponse();
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await request.json();
    const supabase = getServerClient();

    // Create new company profile (no longer checking for existing since we support multiple)
    const { data: profile, error } = await supabase
      .from('company_profiles')
      .insert({
        company_name: body.company_name,
        legal_name: body.legal_name,
        dba_names: body.dba_names || [],
        cage_code: body.cage_code,
        uei_number: body.uei_number,
        sam_status: body.sam_status,
        sam_expiration: body.sam_expiration,
        year_founded: body.year_founded,
        headquarters_address: body.headquarters_address,
        additional_offices: body.additional_offices || [],
        website: body.website || '',
        employee_count: body.employee_count,
        annual_revenue: body.annual_revenue || null,
        fiscal_year_end: body.fiscal_year_end || null,
        proposal_poc: body.proposal_poc,
        contracts_poc: body.contracts_poc || null,
        authorized_signer: body.authorized_signer,
        elevator_pitch: body.elevator_pitch,
        full_description: body.full_description || null,
        mission_statement: body.mission_statement || null,
        vision_statement: body.vision_statement || null,
        core_values: body.core_values || [],
        completeness_score: 25, // Initial score from core info
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating profile:', error);
      return NextResponse.json(
        { error: 'Failed to create company profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      profile,
    });
  } catch (error) {
    console.error('Profile creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const resolved = await getCompanyIdOrResponse(request);
  if (resolved instanceof NextResponse) return resolved;
  const { companyId } = resolved;
  try {

    const supabase = getServerClient();

    const { data: profile, error } = await supabase
      .from('company_profiles')
      .select('*')
      .eq('id', companyId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No profile found
        return NextResponse.json({ profile: null });
      }
      console.error('Error fetching profile:', error);
      return NextResponse.json(
        { error: 'Failed to fetch profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({ profile });
  } catch (error) {
    console.error('Profile fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const resolved = await getCompanyIdOrResponse(request);
  if (resolved instanceof NextResponse) return resolved;
  const { companyId } = resolved;
  try {

    const body = await request.json();
    const supabase = getServerClient();

    // Update profile for selected company
    const { data: profile, error } = await supabase
      .from('company_profiles')
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq('id', companyId)
      .select()
      .single();

    if (error) {
      console.error('Error updating profile:', error);
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      profile,
    });
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
