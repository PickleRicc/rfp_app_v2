import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/client";
import { validateIntakeToken } from "@/lib/intake/validate-token";
import { validateUEI, validateCAGE } from "@/lib/validation/tier1-validators";
import { isTier1Complete } from "@/lib/validation/tier1-completeness";

/** Fields that external clients are allowed to update via the public intake form. */
const ALLOWED_PROFILE_FIELDS = new Set([
  // Corporate Identity
  'legal_name', 'company_name', 'dba_names', 'logo_url',
  'primary_color', 'secondary_color',
  'uei_number', 'cage_code', 'sam_status', 'sam_expiration',
  'primary_naics', 'primary_naics_title', 'business_size', 'socioeconomic_certs',
  'year_founded', 'employee_count', 'annual_revenue', 'fiscal_year_end',
  'website', 'headquarters_address',
  'proposal_poc', 'contracts_poc', 'authorized_signer',
  // Vehicles & Certifications (JSONB fields saved to profile)
  'iso_cmmi_status', 'dcaa_approved_systems',
  // Capabilities & Positioning
  'corporate_overview', 'core_services_summary', 'enterprise_win_themes',
  'key_differentiators_summary', 'standard_management_approach',
  'elevator_pitch', 'full_description',
  'mission_statement', 'vision_statement', 'core_values',
]);

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
    const rawBody = await request.json();
    const supabase = getServerClient();
    const companyId = result.companyId;

    // Strip any fields not in the allowlist to prevent mass assignment
    const body: Record<string, unknown> = {};
    for (const key of Object.keys(rawBody)) {
      if (ALLOWED_PROFILE_FIELDS.has(key)) {
        body[key] = rawBody[key];
      }
    }

    const DATE_FIELDS = [
      'sam_expiration', 'fiscal_year_end', 'ordering_period_end',
      'start_date', 'end_date', 'effective_date', 'expiration_date',
      'investigation_date', 'resume_last_updated',
    ];
    for (const f of DATE_FIELDS) {
      if (f in body && body[f] === '') body[f] = null;
    }

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
