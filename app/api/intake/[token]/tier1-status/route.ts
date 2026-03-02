import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/client";
import { validateIntakeToken } from "@/lib/intake/validate-token";
import {
  calculateTier1Completeness,
  getTier1MissingFields,
  isTier1Complete,
} from "@/lib/validation/tier1-completeness";

/**
 * GET /api/intake/[token]/tier1-status
 * Public. Tier 1 completeness status via token.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const result = await validateIntakeToken(token);
  if (!result.valid) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  try {
    const supabase = getServerClient();
    const companyId = result.companyId;

    const { data: profile, error: profileError } = await supabase
      .from("company_profiles")
      .select("*")
      .eq("id", companyId)
      .single();

    if (profileError) {
      if (profileError.code === "PGRST116") {
        return NextResponse.json({
          completeness: { score: 0, sections: [], isComplete: false },
          missingFields: ["Company profile not found"],
          isComplete: false,
        });
      }
      return NextResponse.json(
        { error: "Failed to fetch profile" },
        { status: 500 }
      );
    }

    const [
      { count: vehicleCount },
      { count: naicsCount },
    ] = await Promise.all([
      supabase
        .from("contract_vehicles")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId),
      supabase
        .from("naics_codes")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId),
    ]);

    const extra = {
      contractVehicleCount: vehicleCount ?? 0,
      naicsCodeCount: naicsCount ?? 0,
    };

    const completeness = calculateTier1Completeness(profile, extra);
    const missingFields = getTier1MissingFields(profile, extra);
    const complete = isTier1Complete(profile, extra);

    return NextResponse.json({ completeness, missingFields, isComplete: complete });
  } catch (e) {
    console.error("Intake tier1-status error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
