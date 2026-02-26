import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';
import { requireStaffOrResponse, getCompanyIdOrResponse } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const auth = await requireStaffOrResponse();
  if (auth instanceof NextResponse) return auth;
  try {
    const companyId = request.headers.get('X-Company-Id');
    
    if (!companyId) {
      return NextResponse.json(
        { error: 'No company selected' },
        { status: 400 }
      );
    }

    const supabase = getServerClient();

    // Fetch all personnel
    const { data: personnel, error } = await supabase
      .from('personnel')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching personnel:', error);
      return NextResponse.json(
        { error: 'Failed to fetch personnel' },
        { status: 500 }
      );
    }

    return NextResponse.json({ personnel: personnel || [] });
  } catch (error) {
    console.error('Personnel fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const resolved = await getCompanyIdOrResponse(request);
  if (resolved instanceof NextResponse) return resolved;
  const { companyId } = resolved;
  try {

    const body = await request.json();
    const supabase = getServerClient();

    // Create personnel record
    const { data: person, error } = await supabase
      .from('personnel')
      .insert({
        company_id: companyId,
        status: body.status,
        full_name: body.full_name,
        email: body.email,
        phone: body.phone || null,
        employment_type: body.employment_type,
        employer_company: body.employer_company || null,
        availability: body.availability,
        current_assignment: body.current_assignment || null,
        geographic_location: body.geographic_location,
        relocation_willing: body.relocation_willing || false,
        remote_capable: body.remote_capable,
        clearance_level: body.clearance_level || null,
        clearance_status: body.clearance_status || null,
        investigation_date: body.investigation_date || null,
        sponsoring_agency: body.sponsoring_agency || null,
        education: body.education || [],
        certifications: body.certifications || [],
        total_experience_years: body.total_experience_years,
        federal_experience_years: body.federal_experience_years || null,
        relevant_experience_years: body.relevant_experience_years || null,
        work_history: body.work_history || [],
        proposed_roles: body.proposed_roles || [],
        resume_url: body.resume_url || null,
        resume_last_updated: body.resume_last_updated || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating personnel:', error);
      return NextResponse.json(
        { error: 'Failed to create personnel record' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      person,
    });
  } catch (error) {
    console.error('Personnel creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
