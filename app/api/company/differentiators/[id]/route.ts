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
    const { type } = body; // 'value_proposition', 'innovation', or 'competitive_advantage'
    const supabase = getServerClient();

    let result;
    let error;

    if (type === 'value_proposition') {
      const { data, error: err } = await supabase
        .from('value_propositions')
        .update({
          theme: body.theme,
          statement: body.statement,
          proof_points: body.proof_points || [],
          applicable_to: body.applicable_to || [],
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('company_id', companyId)
        .select()
        .single();
      result = data;
      error = err;
    } else if (type === 'innovation') {
      const { data, error: err } = await supabase
        .from('innovations')
        .update({
          name: body.name,
          description: body.description,
          evidence: body.evidence,
          proprietary: body.proprietary || false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('company_id', companyId)
        .select()
        .single();
      result = data;
      error = err;
    } else if (type === 'competitive_advantage') {
      const { data, error: err } = await supabase
        .from('competitive_advantages')
        .update({
          area: body.area,
          our_strength: body.our_strength,
          competitor_weakness: body.competitor_weakness,
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
      console.error('Error updating differentiator:', error);
      return NextResponse.json(
        { error: 'Failed to update differentiator' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Differentiator update error:', error);
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
    const type = searchParams.get('type'); // 'value_proposition', 'innovation', or 'competitive_advantage'
    const supabase = getServerClient();

    let error;

    if (type === 'value_proposition') {
      const { error: err } = await supabase
        .from('value_propositions')
        .delete()
        .eq('id', id)
        .eq('company_id', companyId);
      error = err;
    } else if (type === 'innovation') {
      const { error: err } = await supabase
        .from('innovations')
        .delete()
        .eq('id', id)
        .eq('company_id', companyId);
      error = err;
    } else if (type === 'competitive_advantage') {
      const { error: err } = await supabase
        .from('competitive_advantages')
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
      console.error('Error deleting differentiator:', error);
      return NextResponse.json(
        { error: 'Failed to delete differentiator' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Differentiator deletion error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
