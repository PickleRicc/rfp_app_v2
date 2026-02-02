import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getServerClient();

    const { data: boilerplate, error } = await supabase
      .from('boilerplate_library')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error || !boilerplate) {
      return NextResponse.json(
        { error: 'Boilerplate not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ boilerplate });
  } catch (error) {
    console.error('Boilerplate fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

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
    const supabase = getServerClient();

    const { data: boilerplate, error } = await supabase
      .from('boilerplate_library')
      .update({
        type: body.type,
        variant: body.variant || null,
        content: body.content,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .eq('company_id', companyId)
      .select()
      .single();

    if (error) {
      console.error('Error updating boilerplate:', error);
      return NextResponse.json(
        { error: 'Failed to update boilerplate' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      boilerplate,
    });
  } catch (error) {
    console.error('Boilerplate update error:', error);
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

    const supabase = getServerClient();

    const { error } = await supabase
      .from('boilerplate_library')
      .delete()
      .eq('id', params.id)
      .eq('company_id', companyId);

    if (error) {
      console.error('Error deleting boilerplate:', error);
      return NextResponse.json(
        { error: 'Failed to delete boilerplate' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Boilerplate deletion error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
