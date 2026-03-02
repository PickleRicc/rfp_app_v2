import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';
import { requireStaffOrResponse } from '@/lib/auth';

/**
 * GET /api/capture
 * List opportunity analyses. Optionally filter by X-Company-Id header.
 */
export async function GET(request: NextRequest) {
  const auth = await requireStaffOrResponse();
  if (auth instanceof NextResponse) return auth;

  try {
    const companyId = request.headers.get('X-Company-Id');
    const supabase = getServerClient();

    let query = supabase
      .from('opportunity_analyses')
      .select('*')
      .eq('created_by', auth.userId!)
      .order('created_at', { ascending: false });

    if (companyId) {
      query = query.or(`company_id.eq.${companyId},company_id.is.null`);
    }

    const { data: analyses, error } = await query;

    if (error) {
      console.error('Fetch analyses error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch analyses' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      analyses: analyses || [],
      count: analyses?.length || 0,
    });
  } catch (error) {
    console.error('Capture GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/capture
 * Create a new opportunity analysis.
 * Body: { mode, title, agency?, solicitation_number?, company_id? }
 */
export async function POST(request: NextRequest) {
  const auth = await requireStaffOrResponse();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();

    if (!body.title || body.title.trim() === '') {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    if (!body.mode || !['raw', 'database'].includes(body.mode)) {
      return NextResponse.json(
        { error: 'Mode must be "raw" or "database"' },
        { status: 400 }
      );
    }

    const companyId = body.company_id || request.headers.get('X-Company-Id');

    if (body.mode === 'database' && !companyId) {
      return NextResponse.json(
        { error: 'Company selection is required for database mode' },
        { status: 400 }
      );
    }

    const supabase = getServerClient();

    const { data: analysis, error } = await supabase
      .from('opportunity_analyses')
      .insert({
        company_id: companyId || null,
        mode: body.mode,
        title: body.title.trim(),
        agency: body.agency?.trim() || null,
        solicitation_number: body.solicitation_number?.trim() || null,
        status: 'draft',
        created_by: auth.userId!,
      })
      .select()
      .single();

    if (error) {
      console.error('Create analysis error:', error);
      return NextResponse.json(
        { error: 'Failed to create analysis' },
        { status: 500 }
      );
    }

    return NextResponse.json({ analysis }, { status: 201 });
  } catch (error) {
    console.error('Capture POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
