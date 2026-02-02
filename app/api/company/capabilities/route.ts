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

    // Fetch all capability data in parallel
    const [
      { data: serviceAreas },
      { data: tools },
      { data: methodologies },
    ] = await Promise.all([
      supabase
        .from('service_areas')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false }),
      supabase
        .from('tools_technologies')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false }),
      supabase
        .from('methodologies')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false }),
    ]);

    return NextResponse.json({
      serviceAreas: serviceAreas || [],
      tools: tools || [],
      methodologies: methodologies || [],
    });
  } catch (error) {
    console.error('Capabilities fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Service Areas
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
    const { type } = body; // 'service', 'tool', or 'methodology'
    const supabase = getServerClient();

    let result;
    let error;

    if (type === 'service') {
      const { data, error: err } = await supabase
        .from('service_areas')
        .insert({
          company_id: companyId,
          service_name: body.service_name,
          description: body.description,
          experience_years: body.experience_years || null,
          key_clients: body.key_clients || [],
          relevant_naics: body.relevant_naics || [],
        })
        .select()
        .single();
      result = data;
      error = err;
    } else if (type === 'tool') {
      const { data, error: err } = await supabase
        .from('tools_technologies')
        .insert({
          company_id: companyId,
          name: body.name,
          category: body.category || null,
          proficiency: body.proficiency,
          years_experience: body.years_experience || null,
          certified_practitioners: body.certified_practitioners || null,
          description: body.description || null,
        })
        .select()
        .single();
      result = data;
      error = err;
    } else if (type === 'methodology') {
      const { data, error: err } = await supabase
        .from('methodologies')
        .insert({
          company_id: companyId,
          name: body.name,
          category: body.category || null,
          implementation_experience: body.implementation_experience || null,
          certified_practitioners: body.certified_practitioners || null,
        })
        .select()
        .single();
      result = data;
      error = err;
    } else {
      return NextResponse.json(
        { error: 'Invalid type. Must be service, tool, or methodology' },
        { status: 400 }
      );
    }

    if (error) {
      console.error('Error creating capability:', error);
      return NextResponse.json(
        { error: 'Failed to create capability' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Capability creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
