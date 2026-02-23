import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';
import { getCompanyIdOrResponse } from '@/lib/auth';
import { calculateTier1Completeness, getTier1MissingFields } from '@/lib/validation/tier1-completeness';
import { isTier1Complete } from '@/lib/validation/tier1-completeness';

/**
 * GET /api/company/tier1-status
 *
 * Returns the Tier 1 completeness status for the currently selected company.
 * Fetches the company profile plus related table counts (contract vehicles, NAICS codes)
 * and runs the completeness calculator.
 *
 * Response:
 *   {
 *     completeness: Tier1Completeness,
 *     missingFields: string[],
 *     isComplete: boolean
 *   }
 */
export async function GET(request: NextRequest) {
  const resolved = await getCompanyIdOrResponse(request);
  if (resolved instanceof NextResponse) return resolved;
  const { companyId } = resolved;

  try {
    const supabase = getServerClient();

    // Fetch the company profile
    const { data: profile, error: profileError } = await supabase
      .from('company_profiles')
      .select('*')
      .eq('id', companyId)
      .single();

    if (profileError) {
      if (profileError.code === 'PGRST116') {
        // No profile yet — return zeroed completeness
        return NextResponse.json({
          completeness: { score: 0, sections: [], isComplete: false },
          missingFields: ['Company profile not found — create a profile first'],
          isComplete: false,
        });
      }
      console.error('tier1-status: error fetching profile:', profileError);
      return NextResponse.json(
        { error: 'Failed to fetch company profile' },
        { status: 500 }
      );
    }

    // Fetch contract vehicle count
    const { count: vehicleCount, error: vehicleError } = await supabase
      .from('contract_vehicles')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId);

    if (vehicleError) {
      console.error('tier1-status: error fetching vehicle count:', vehicleError);
    }

    // Fetch NAICS code count
    const { count: naicsCount, error: naicsError } = await supabase
      .from('naics_codes')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId);

    if (naicsError) {
      console.error('tier1-status: error fetching NAICS count:', naicsError);
    }

    const extra = {
      contractVehicleCount: vehicleCount ?? 0,
      naicsCodeCount: naicsCount ?? 0,
    };

    const completeness = calculateTier1Completeness(profile, extra);
    const missingFields = getTier1MissingFields(profile, extra);
    const complete = isTier1Complete(profile, extra);

    return NextResponse.json({
      completeness,
      missingFields,
      isComplete: complete,
    });
  } catch (error) {
    console.error('tier1-status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
