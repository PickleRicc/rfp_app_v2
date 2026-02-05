import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';
import { requireStaffOrResponse } from '@/lib/auth';

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

    // Fetch all past performance contracts
    const { data: contracts, error } = await supabase
      .from('past_performance')
      .select('*')
      .eq('company_id', companyId)
      .order('start_date', { ascending: false });

    if (error) {
      console.error('Error fetching contracts:', error);
      return NextResponse.json(
        { error: 'Failed to fetch contracts' },
        { status: 500 }
      );
    }

    return NextResponse.json({ contracts: contracts || [] });
  } catch (error) {
    console.error('Past performance fetch error:', error);
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

    // Create past performance record
    const { data: contract, error } = await supabase
      .from('past_performance')
      .insert({
        company_id: companyId,
        contract_nickname: body.contract_nickname,
        contract_name: body.contract_name,
        contract_number: body.contract_number,
        task_order_number: body.task_order_number || null,
        client_agency: body.client_agency,
        client_office: body.client_office || null,
        contract_type: body.contract_type,
        contract_value: body.contract_value,
        annual_value: body.annual_value || null,
        start_date: body.start_date,
        end_date: body.end_date,
        base_period: body.base_period || null,
        option_periods: body.option_periods || 0,
        role: body.role,
        percentage_of_work: body.percentage_of_work || null,
        prime_contractor: body.prime_contractor || null,
        team_size: body.team_size,
        place_of_performance: body.place_of_performance,
        client_poc: body.client_poc,
        alternate_poc: body.alternate_poc || null,
        cpars_rating: body.cpars_rating || null,
        customer_feedback: body.customer_feedback || null,
        overview: body.overview,
        description_of_effort: body.description_of_effort,
        task_areas: body.task_areas || [],
        tools_used: body.tools_used || [],
        achievements: body.achievements || [],
        relevance_tags: body.relevance_tags || [],
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating contract:', error);
      return NextResponse.json(
        { error: 'Failed to create contract' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      contract,
    });
  } catch (error) {
    console.error('Contract creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
