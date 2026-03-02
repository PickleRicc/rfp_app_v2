import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/client";
import { requireStaffOrResponse } from "@/lib/auth";
import {
  generateCapabilitiesField,
  type GeneratableField,
  type CompanyContext,
} from "@/lib/generation/capabilities-ai-generator";

const VALID_FIELDS: GeneratableField[] = [
  "corporate_overview",
  "core_services_summary",
  "enterprise_win_themes",
  "key_differentiators_summary",
  "standard_management_approach",
  "elevator_pitch_and_descriptions",
];

export async function POST(request: NextRequest) {
  const auth = await requireStaffOrResponse();
  if (auth instanceof NextResponse) return auth;

  try {
    const companyId = request.headers.get("X-Company-Id");
    if (!companyId) {
      return NextResponse.json(
        { error: "X-Company-Id header is required" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const field = body.field as GeneratableField;

    if (!field || !VALID_FIELDS.includes(field)) {
      return NextResponse.json(
        { error: `Invalid field. Must be one of: ${VALID_FIELDS.join(", ")}` },
        { status: 400 }
      );
    }

    const supabase = getServerClient();

    const [profileRes, ppRes, certsRes, naicsRes, vehiclesRes] =
      await Promise.all([
        supabase
          .from("company_profiles")
          .select("*")
          .eq("id", companyId)
          .single(),
        supabase
          .from("past_performance")
          .select(
            "contract_name, client_agency, contract_value, role, overview, task_areas, tools_used, relevance_tags"
          )
          .eq("company_id", companyId)
          .order("contract_value", { ascending: false })
          .limit(10),
        supabase
          .from("certifications")
          .select("certification_type")
          .eq("company_id", companyId),
        supabase
          .from("naics_codes")
          .select("code, title, is_primary")
          .eq("company_id", companyId),
        supabase
          .from("contract_vehicles")
          .select("vehicle_name, vehicle_type")
          .eq("company_id", companyId),
      ]);

    if (profileRes.error || !profileRes.data) {
      return NextResponse.json(
        { error: "Company profile not found" },
        { status: 404 }
      );
    }

    const profile = profileRes.data;

    const context: CompanyContext = {
      companyName: profile.company_name,
      legalName: profile.legal_name,
      cageCode: profile.cage_code,
      ueiNumber: profile.uei_number,
      yearFounded: profile.year_founded,
      employeeCount: profile.employee_count,
      website: profile.website,
      corporateOverview: profile.corporate_overview,
      coreServicesSummary: profile.core_services_summary,
      elevatorPitch: profile.elevator_pitch,
      fullDescription: profile.full_description,
      pastPerformance: ppRes.data || [],
      certifications: certsRes.data || [],
      naicsCodes: naicsRes.data || [],
      contractVehicles: vehiclesRes.data || [],
    };

    const result = await generateCapabilitiesField(field, context);

    return NextResponse.json({ success: true, field, result });
  } catch (error) {
    console.error("Capabilities generate error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate content",
      },
      { status: 500 }
    );
  }
}
