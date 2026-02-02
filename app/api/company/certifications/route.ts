import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';

export async function GET(request: NextRequest) {
  try {
    const companyId = request.headers.get('X-Company-Id');
    
    if (!companyId) {
      return NextResponse.json(
        { error: 'No company selected' },
        { status: 400 }
      );
    }

    const supabase = getServerClient();

    // Fetch all certification-related data in parallel
    const [
      { data: certifications },
      { data: naicsCodes },
      { data: contractVehicles },
      { data: facilityClearance },
    ] = await Promise.all([
      supabase
        .from('certifications')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false }),
      supabase
        .from('naics_codes')
        .select('*')
        .eq('company_id', companyId)
        .order('is_primary', { ascending: false }),
      supabase
        .from('contract_vehicles')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false }),
      supabase
        .from('facility_clearances')
        .select('*')
        .eq('company_id', companyId)
        .single(),
    ]);

    return NextResponse.json({
      certifications: certifications || [],
      naicsCodes: naicsCodes || [],
      contractVehicles: contractVehicles || [],
      facilityClearance: facilityClearance || null,
    });
  } catch (error) {
    console.error('Certifications fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const companyId = request.headers.get('X-Company-Id');
    
    if (!companyId) {
      return NextResponse.json(
        { error: 'No company selected' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { type } = body; // 'certification', 'naics', 'vehicle', or 'facility_clearance'
    const supabase = getServerClient();

    let result;
    let error;

    if (type === 'certification') {
      const { data, error: err } = await supabase
        .from('certifications')
        .insert({
          company_id: companyId,
          certification_type: body.certification_type,
          certifying_agency: body.certifying_agency || null,
          certification_number: body.certification_number || null,
          effective_date: body.effective_date || null,
          expiration_date: body.expiration_date || null,
          documentation_url: body.documentation_url || null,
        })
        .select()
        .single();
      result = data;
      error = err;
    } else if (type === 'naics') {
      const { data, error: err } = await supabase
        .from('naics_codes')
        .insert({
          company_id: companyId,
          code: body.code,
          title: body.title,
          size_standard: body.size_standard || null,
          is_primary: body.is_primary || false,
        })
        .select()
        .single();
      result = data;
      error = err;
    } else if (type === 'vehicle') {
      const { data, error: err } = await supabase
        .from('contract_vehicles')
        .insert({
          company_id: companyId,
          vehicle_name: body.vehicle_name,
          contract_number: body.contract_number || null,
          vehicle_type: body.vehicle_type,
          ordering_period_end: body.ordering_period_end || null,
          ceiling_value: body.ceiling_value || null,
          remaining_ceiling: body.remaining_ceiling || null,
          labor_categories: body.labor_categories || [],
          approved_rates_url: body.approved_rates_url || null,
        })
        .select()
        .single();
      result = data;
      error = err;
    } else if (type === 'facility_clearance') {
      // For facility clearance, we need to upsert since there should only be one
      const { data, error: err } = await supabase
        .from('facility_clearances')
        .upsert({
          company_id: companyId,
          has_facility_clearance: body.has_facility_clearance,
          clearance_level: body.clearance_level || null,
          sponsoring_agency: body.sponsoring_agency || null,
          cage_code_cleared: body.cage_code_cleared || null,
          cleared_facility_address: body.cleared_facility_address || null,
          safeguarding_capability: body.safeguarding_capability || null,
        })
        .select()
        .single();
      result = data;
      error = err;
    } else {
      return NextResponse.json(
        { error: 'Invalid type. Must be certification, naics, vehicle, or facility_clearance' },
        { status: 400 }
      );
    }

    if (error) {
      console.error('Error creating certification data:', error);
      return NextResponse.json(
        { error: 'Failed to create certification data' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Certification creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
