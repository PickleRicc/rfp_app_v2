import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/client";
import { validateIntakeToken } from "@/lib/intake/validate-token";
import { validateUEI, validateCAGE } from "@/lib/validation/tier1-validators";
import { isTier1Complete } from "@/lib/validation/tier1-completeness";

/**
 * GET /api/intake/[token]/profile
 * Public. Load company profile via intake token.
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

  const supabase = getServerClient();
  const { data: profile, error } = await supabase
    .from("company_profiles")
    .select("*")
    .eq("id", result.companyId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ profile: null });
    }
    console.error("Intake profile fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch profile" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    profile,
    companyName: profile?.company_name || "Company",
  });
}

/**
 * PUT /api/intake/[token]/profile
 * Public. Update company profile via intake token.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const result = await validateIntakeToken(token);
  if (!result.valid) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  try {
    const body = await request.json();
    const supabase = getServerClient();
    const companyId = result.companyId;

    if (body.uei_number !== undefined) {
      const ueiResult = validateUEI(body.uei_number);
      if (!ueiResult.valid) {
        return NextResponse.json(
          { error: `Invalid UEI: ${ueiResult.error}` },
          { status: 400 }
        );
      }
    }

    if (body.cage_code !== undefined) {
      const cageResult = validateCAGE(body.cage_code);
      if (!cageResult.valid) {
        return NextResponse.json(
          { error: `Invalid CAGE code: ${cageResult.error}` },
          { status: 400 }
        );
      }
    }

    const { data: profile, error } = await supabase
      .from("company_profiles")
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq("id", companyId)
      .select()
      .single();

    if (error) {
      console.error("Intake profile update error:", error);
      return NextResponse.json(
        { error: "Failed to update profile" },
        { status: 500 }
      );
    }

    let tier1Complete = false;
    try {
      const [vehicleResult, naicsResult] = await Promise.all([
        supabase
          .from("contract_vehicles")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId),
        supabase
          .from("naics_codes")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId),
      ]);

      tier1Complete = isTier1Complete(profile, {
        contractVehicleCount: vehicleResult.count ?? 0,
        naicsCodeCount: naicsResult.count ?? 0,
      });

      if (profile.tier1_complete !== tier1Complete) {
        await supabase
          .from("company_profiles")
          .update({ tier1_complete: tier1Complete })
          .eq("id", companyId);
        profile.tier1_complete = tier1Complete;
      }
    } catch (flagErr) {
      console.error("tier1_complete recalculation error:", flagErr);
    }

    return NextResponse.json({ success: true, profile, tier1Complete });
  } catch (e) {
    console.error("Intake profile update error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
