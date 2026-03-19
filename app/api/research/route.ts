import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';
import { requireStaffOrResponse } from '@/lib/auth';
import { inngest } from '@/lib/inngest/client';

/**
 * GET /api/research
 * List research reports. Optional ?q=company+name to filter.
 * Returns most recent reports.
 */
export async function GET(request: NextRequest) {
  const auth = await requireStaffOrResponse();
  if (auth instanceof NextResponse) return auth;

  const supabase = getServerClient();
  const searchQuery = request.nextUrl.searchParams.get('q');
  const researchId = request.nextUrl.searchParams.get('id');

  // Fetch a specific report by ID
  if (researchId) {
    const { data, error } = await supabase
      .from('company_research')
      .select('*')
      .eq('id', researchId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Research not found' }, { status: 404 });
    }

    return NextResponse.json({ report: data });
  }

  // List reports, optionally filtered by company name
  let query = supabase
    .from('company_research')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (searchQuery) {
    query = query.ilike('search_company_name', `%${searchQuery}%`);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch research' }, { status: 500 });
  }

  return NextResponse.json({ reports: data || [] });
}

/**
 * POST /api/research
 * Trigger a new research run for any company.
 * Body: { company_name: string, cage_code?: string, uei?: string }
 */
export async function POST(request: NextRequest) {
  const auth = await requireStaffOrResponse();
  if (auth instanceof NextResponse) return auth;

  const body = await request.json();

  if (!body.company_name || body.company_name.trim() === '') {
    return NextResponse.json({ error: 'company_name is required' }, { status: 400 });
  }

  const companyName = body.company_name.trim();
  const cageCode = body.cage_code?.trim() || null;
  const uei = body.uei?.trim() || null;

  const supabase = getServerClient();

  // Check for in-progress research for the same company
  const { data: existing } = await supabase
    .from('company_research')
    .select('id, status')
    .ilike('search_company_name', companyName)
    .in('status', ['pending', 'researching'])
    .limit(1)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({
      error: 'Research already in progress for this company',
      researchId: existing.id,
    }, { status: 409 });
  }

  // Create research record
  const { data: research, error: insertErr } = await supabase
    .from('company_research')
    .insert({
      search_company_name: companyName,
      search_cage_code: cageCode,
      search_uei: uei,
      company_id: null,
      triggered_by: auth.userId!,
      status: 'pending',
    })
    .select()
    .single();

  if (insertErr || !research) {
    console.error('Create research error:', insertErr);
    return NextResponse.json({ error: 'Failed to create research' }, { status: 500 });
  }

  // Fire Inngest event
  await inngest.send({
    name: 'company.research.start',
    data: {
      researchId: research.id,
      companyName,
      cageCode,
      uei,
    },
  });

  return NextResponse.json({ research }, { status: 201 });
}
