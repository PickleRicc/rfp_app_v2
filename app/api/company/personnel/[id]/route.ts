import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';
import { requireStaffOrResponse } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireStaffOrResponse();
  if (auth instanceof NextResponse) return auth;
  try {
    const supabase = getServerClient();

    const { data: person, error } = await supabase
      .from('personnel')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error || !person) {
      return NextResponse.json(
        { error: 'Personnel not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ person });
  } catch (error) {
    console.error('Personnel fetch error:', error);
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
  const auth = await requireStaffOrResponse();
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await request.json();
    const supabase = getServerClient();

    const { data: person, error } = await supabase
      .from('personnel')
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating personnel:', error);
      return NextResponse.json(
        { error: 'Failed to update personnel' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      person,
    });
  } catch (error) {
    console.error('Personnel update error:', error);
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
  const resolved = await getCompanyIdOrResponse(request);
  if (resolved instanceof NextResponse) return resolved;
  try {
    const supabase = getServerClient();

    const { error } = await supabase
      .from('personnel')
      .delete()
      .eq('id', params.id);

    if (error) {
      console.error('Error deleting personnel:', error);
      return NextResponse.json(
        { error: 'Failed to delete personnel' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Personnel deletion error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
