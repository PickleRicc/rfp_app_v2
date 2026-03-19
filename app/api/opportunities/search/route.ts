import { NextRequest, NextResponse } from 'next/server';
import { requireStaffOrResponse } from '@/lib/auth';
import { searchOpportunities } from '@/lib/samgov/client';

/**
 * GET /api/opportunities/search
 * Search SAM.gov opportunities via the Tango API.
 * Query params: keyword, naics, set_aside, page, limit
 */
export async function GET(request: NextRequest) {
  const auth = await requireStaffOrResponse();
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = request.nextUrl;
  const keyword = searchParams.get('keyword') || undefined;
  const naicsCode = searchParams.get('naics') || undefined;
  const setAside = searchParams.get('set_aside') || undefined;
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25', 10)));

  if (!keyword && !naicsCode && !setAside) {
    return NextResponse.json(
      { error: 'At least one of keyword, naics, or set_aside is required' },
      { status: 400 }
    );
  }

  const result = await searchOpportunities({
    keyword,
    naicsCode,
    setAside,
    active: true,
    limit,
    page,
  });

  return NextResponse.json({
    opportunities: result.opportunities,
    totalRecords: result.totalRecords,
    page,
    limit,
  });
}
