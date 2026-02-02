import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
        .update({
          service_name: body.service_name,
          description: body.description,
          experience_years: body.experience_years || null,
          key_clients: body.key_clients || [],
          relevant_naics: body.relevant_naics || [],
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.id)
        .eq('company_id', companyId)
        .select()
        .single();
      result = data;
      error = err;
    } else if (type === 'tool') {
      const { data, error: err } = await supabase
        .from('tools_technologies')
        .update({
          name: body.name,
          category: body.category || null,
          proficiency: body.proficiency,
          years_experience: body.years_experience || null,
          certified_practitioners: body.certified_practitioners || null,
          description: body.description || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.id)
        .eq('company_id', companyId)
        .select()
        .single();
      result = data;
      error = err;
    } else if (type === 'methodology') {
      const { data, error: err } = await supabase
        .from('methodologies')
        .update({
          name: body.name,
          category: body.category || null,
          implementation_experience: body.implementation_experience || null,
          certified_practitioners: body.certified_practitioners || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.id)
        .eq('company_id', companyId)
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
      console.error('Error updating capability:', error);
      return NextResponse.json(
        { error: 'Failed to update capability' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Capability update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const companyId = request.headers.get('X-Company-Id');
    
    if (!companyId) {
      return NextResponse.json(
        { error: 'No company selected' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'service', 'tool', or 'methodology'
    const supabase = getServerClient();

    let error;

    if (type === 'service') {
      const { error: err } = await supabase
        .from('service_areas')
        .delete()
        .eq('id', params.id)
        .eq('company_id', companyId);
      error = err;
    } else if (type === 'tool') {
      const { error: err } = await supabase
        .from('tools_technologies')
        .delete()
        .eq('id', params.id)
        .eq('company_id', companyId);
      error = err;
    } else if (type === 'methodology') {
      const { error: err } = await supabase
        .from('methodologies')
        .delete()
        .eq('id', params.id)
        .eq('company_id', companyId);
      error = err;
    } else {
      return NextResponse.json(
        { error: 'Invalid type' },
        { status: 400 }
      );
    }

    if (error) {
      console.error('Error deleting capability:', error);
      return NextResponse.json(
        { error: 'Failed to delete capability' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Capability deletion error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
