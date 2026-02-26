import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';
import { getCompanyIdOrResponse } from '@/lib/auth';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const resolved = await getCompanyIdOrResponse(request);
  if (resolved instanceof NextResponse) return resolved;
  const { companyId } = resolved;
  try {
    const body = await request.json();
    const { type } = body; // 'certification', 'naics', 'vehicle', or 'facility_clearance'
    const supabase = getServerClient();

    let result;
    let error;

    if (type === 'certification') {
      const { data, error: err } = await supabase
        .from('certifications')
        .update({
          certification_type: body.certification_type,
          certifying_agency: body.certifying_agency || null,
          certification_number: body.certification_number || null,
          effective_date: body.effective_date || null,
          expiration_date: body.expiration_date || null,
          documentation_url: body.documentation_url || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('company_id', companyId)
        .select()
        .single();
      result = data;
      error = err;
    } else if (type === 'naics') {
      const { data, error: err } = await supabase
        .from('naics_codes')
        .update({
          code: body.code,
          title: body.title,
          size_standard: body.size_standard || null,
          is_primary: body.is_primary || false,
        })
        .eq('id', id)
        .eq('company_id', companyId)
        .select()
        .single();
      result = data;
      error = err;
    } else if (type === 'vehicle') {
      const { data, error: err } = await supabase
        .from('contract_vehicles')
        .update({
          vehicle_name: body.vehicle_name,
          contract_number: body.contract_number || null,
          vehicle_type: body.vehicle_type,
          ordering_period_end: body.ordering_period_end || null,
          ceiling_value: body.ceiling_value || null,
          remaining_ceiling: body.remaining_ceiling || null,
          labor_categories: body.labor_categories || [],
          approved_rates_url: body.approved_rates_url || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('company_id', companyId)
        .select()
        .single();
      result = data;
      error = err;
    } else if (type === 'facility_clearance') {
      const { data, error: err } = await supabase
        .from('facility_clearances')
        .update({
          has_facility_clearance: body.has_facility_clearance,
          clearance_level: body.clearance_level || null,
          sponsoring_agency: body.sponsoring_agency || null,
          cage_code_cleared: body.cage_code_cleared || null,
          cleared_facility_address: body.cleared_facility_address || null,
          safeguarding_capability: body.safeguarding_capability || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('company_id', companyId)
        .select()
        .single();
      result = data;
      error = err;
    } else {
      return NextResponse.json(
        { error: 'Invalid type' },
        { status: 400 }
      );
    }

    if (error) {
      console.error('Error updating certification data:', error);
      return NextResponse.json(
        { error: 'Failed to update certification data' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Certification update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const resolved = await getCompanyIdOrResponse(request);
  if (resolved instanceof NextResponse) return resolved;
  const { companyId } = resolved;
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'certification', 'naics', 'vehicle', or 'facility_clearance'
    const supabase = getServerClient();

    let error;

    if (type === 'certification') {
      const { error: err } = await supabase
        .from('certifications')
        .delete()
        .eq('id', id)
        .eq('company_id', companyId);
      error = err;
    } else if (type === 'naics') {
      const { error: err } = await supabase
        .from('naics_codes')
        .delete()
        .eq('id', id)
        .eq('company_id', companyId);
      error = err;
    } else if (type === 'vehicle') {
      const { error: err } = await supabase
        .from('contract_vehicles')
        .delete()
        .eq('id', id)
        .eq('company_id', companyId);
      error = err;
    } else if (type === 'facility_clearance') {
      const { error: err } = await supabase
        .from('facility_clearances')
        .delete()
        .eq('id', id)
        .eq('company_id', companyId);
      error = err;
    } else {
      return NextResponse.json(
        { error: 'Invalid type' },
        { status: 400 }
      );
    }

    if (error) {
      console.error('Error deleting certification data:', error);
      return NextResponse.json(
        { error: 'Failed to delete certification data' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Certification deletion error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
