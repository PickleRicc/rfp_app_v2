import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/client";
import { validateIntakeToken } from "@/lib/intake/validate-token";

/**
 * GET /api/intake/[token]/certifications
 * Public. Load certifications, vehicles, NAICS, and clearance via token.
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
  const companyId = result.companyId;

  const [
    { data: certifications },
    { data: naicsCodes },
    { data: contractVehicles },
    { data: facilityClearance },
  ] = await Promise.all([
    supabase
      .from("certifications")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
    supabase
      .from("naics_codes")
      .select("*")
      .eq("company_id", companyId)
      .order("is_primary", { ascending: false }),
    supabase
      .from("contract_vehicles")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
    supabase
      .from("facility_clearances")
      .select("*")
      .eq("company_id", companyId)
      .single(),
  ]);

  return NextResponse.json({
    certifications: certifications || [],
    naicsCodes: naicsCodes || [],
    contractVehicles: contractVehicles || [],
    facilityClearance: facilityClearance || null,
  });
}

/**
 * POST /api/intake/[token]/certifications
 * Public. Add certification, vehicle, NAICS, or facility clearance via token.
 */
export async function POST(
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
    const { type } = body;
    const supabase = getServerClient();
    const companyId = result.companyId;

    let data;
    let error;

    if (type === "certification") {
      const res = await supabase
        .from("certifications")
        .insert({
          company_id: companyId,
          certification_type: body.certification_type,
          certifying_agency: body.certifying_agency || null,
          certification_number: body.certification_number || null,
          effective_date: body.effective_date || null,
          expiration_date: body.expiration_date || null,
          documentation_url: body.documentation_url || null,
        })
        .select()
        .single();
      data = res.data;
      error = res.error;
    } else if (type === "naics") {
      const res = await supabase
        .from("naics_codes")
        .insert({
          company_id: companyId,
          code: body.code,
          title: body.title,
          size_standard: body.size_standard || null,
          is_primary: body.is_primary || false,
        })
        .select()
        .single();
      data = res.data;
      error = res.error;
    } else if (type === "vehicle") {
      const res = await supabase
        .from("contract_vehicles")
        .insert({
          company_id: companyId,
          vehicle_name: body.vehicle_name,
          contract_number: body.contract_number || null,
          vehicle_type: body.vehicle_type,
          ordering_period_end: body.ordering_period_end || null,
          ceiling_value: body.ceiling_value || null,
          remaining_ceiling: body.remaining_ceiling || null,
          labor_categories: body.labor_categories || [],
          approved_rates_url: body.approved_rates_url || null,
        })
        .select()
        .single();
      data = res.data;
      error = res.error;
    } else if (type === "facility_clearance") {
      const res = await supabase
        .from("facility_clearances")
        .upsert({
          company_id: companyId,
          has_facility_clearance: body.has_facility_clearance,
          clearance_level: body.clearance_level || null,
          sponsoring_agency: body.sponsoring_agency || null,
          cage_code_cleared: body.cage_code_cleared || null,
          cleared_facility_address: body.cleared_facility_address || null,
          safeguarding_capability: body.safeguarding_capability || null,
        })
        .select()
        .single();
      data = res.data;
      error = res.error;
    } else {
      return NextResponse.json(
        { error: "Invalid type. Must be certification, naics, vehicle, or facility_clearance" },
        { status: 400 }
      );
    }

    if (error) {
      console.error("Intake certification create error:", error);
      return NextResponse.json(
        { error: "Failed to create certification data" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (e) {
    console.error("Intake certification error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
