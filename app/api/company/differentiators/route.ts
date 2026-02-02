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

    // Fetch all differentiator data in parallel
    const [
      { data: valuePropositions },
      { data: innovations },
      { data: competitiveAdvantages },
    ] = await Promise.all([
      supabase
        .from('value_propositions')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false }),
      supabase
        .from('innovations')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false }),
      supabase
        .from('competitive_advantages')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false }),
    ]);

    return NextResponse.json({
      valuePropositions: valuePropositions || [],
      innovations: innovations || [],
      competitiveAdvantages: competitiveAdvantages || [],
    });
  } catch (error) {
    console.error('Differentiators fetch error:', error);
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
    const { type } = body; // 'value_proposition', 'innovation', or 'competitive_advantage'
    const supabase = getServerClient();

    let result;
    let error;

    if (type === 'value_proposition') {
      const { data, error: err } = await supabase
        .from('value_propositions')
        .insert({
          company_id: companyId,
          theme: body.theme,
          statement: body.statement,
          proof_points: body.proof_points || [],
          applicable_to: body.applicable_to || [],
        })
        .select()
        .single();
      result = data;
      error = err;
    } else if (type === 'innovation') {
      const { data, error: err } = await supabase
        .from('innovations')
        .insert({
          company_id: companyId,
          name: body.name,
          description: body.description,
          evidence: body.evidence,
          proprietary: body.proprietary || false,
        })
        .select()
        .single();
      result = data;
      error = err;
    } else if (type === 'competitive_advantage') {
      const { data, error: err } = await supabase
        .from('competitive_advantages')
        .insert({
          company_id: companyId,
          area: body.area,
          our_strength: body.our_strength,
          competitor_weakness: body.competitor_weakness,
        })
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
      console.error('Error creating differentiator:', error);
      return NextResponse.json(
        { error: 'Failed to create differentiator' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Differentiator creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
