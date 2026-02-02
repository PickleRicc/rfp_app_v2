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

    // Fetch all boilerplate text blocks
    const { data: boilerplate, error } = await supabase
      .from('boilerplate_library')
      .select('*')
      .eq('company_id', companyId)
      .order('type', { ascending: true });

    if (error) {
      console.error('Error fetching boilerplate:', error);
      return NextResponse.json(
        { error: 'Failed to fetch boilerplate' },
        { status: 500 }
      );
    }

    return NextResponse.json({ boilerplate: boilerplate || [] });
  } catch (error) {
    console.error('Boilerplate fetch error:', error);
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
    const supabase = getServerClient();

    // Create boilerplate text block
    const { data: boilerplate, error } = await supabase
      .from('boilerplate_library')
      .insert({
        company_id: companyId,
        type: body.type,
        variant: body.variant || null,
        content: body.content,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating boilerplate:', error);
      return NextResponse.json(
        { error: 'Failed to create boilerplate' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      boilerplate,
    });
  } catch (error) {
    console.error('Boilerplate creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
