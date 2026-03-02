import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/client";
import { requireStaffOrResponse, getCompanyIdOrResponse } from "@/lib/auth";

/**
 * GET /api/company/intake-token
 * List active intake tokens for the selected company.
 */
export async function GET(request: NextRequest) {
  const resolved = await getCompanyIdOrResponse(request);
  if (resolved instanceof NextResponse) return resolved;
  const { companyId } = resolved;

  const supabase = getServerClient();
  const { data: tokens, error } = await supabase
    .from("intake_tokens")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_revoked", false)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching intake tokens:", error);
    return NextResponse.json(
      { error: "Failed to fetch intake tokens" },
      { status: 500 }
    );
  }

  return NextResponse.json({ tokens: tokens || [] });
}

/**
 * POST /api/company/intake-token
 * Staff-only. Generate a new intake token.
 *
 * Two modes:
 *   1. Existing company: pass { companyId }
 *   2. New company:      pass { newCompanyName } — creates a skeleton company_profiles row first
 */
export async function POST(request: NextRequest) {
  const auth = await requireStaffOrResponse();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { companyId: existingCompanyId, newCompanyName, label, expiresInDays } = body;

    if (!existingCompanyId && !newCompanyName) {
      return NextResponse.json(
        { error: "Either companyId or newCompanyName is required" },
        { status: 400 }
      );
    }

    const supabase = getServerClient();
    let companyId: string;
    let companyName: string;

    if (existingCompanyId) {
      const { data: company, error: companyError } = await supabase
        .from("company_profiles")
        .select("id, company_name")
        .eq("id", existingCompanyId)
        .single();

      if (companyError || !company) {
        return NextResponse.json(
          { error: "Company not found" },
          { status: 404 }
        );
      }
      companyId = company.id;
      companyName = company.company_name;
    } else {
      const trimmedName = (newCompanyName as string).trim();
      if (!trimmedName) {
        return NextResponse.json(
          { error: "Company name cannot be empty" },
          { status: 400 }
        );
      }

      const { data: newCompany, error: createError } = await supabase
        .from("company_profiles")
        .insert({
          company_name: trimmedName,
          legal_name: trimmedName,
          dba_names: [],
          cage_code: "",
          uei_number: "",
          sam_status: "Not Registered",
          sam_expiration: "",
          year_founded: new Date().getFullYear(),
          headquarters_address: { street: "", city: "", state: "", zip: "", country: "USA" },
          additional_offices: [],
          website: "",
          employee_count: 1,
          annual_revenue: null,
          fiscal_year_end: null,
          proposal_poc: { name: "", title: "", email: "", phone: "" },
          authorized_signer: { name: "", title: "", email: "" },
          elevator_pitch: "",
          core_values: [],
          completeness_score: 0,
          tier1_complete: false,
        })
        .select()
        .single();

      if (createError || !newCompany) {
        console.error("Error creating company for intake:", createError);
        return NextResponse.json(
          { error: "Failed to create company profile" },
          { status: 500 }
        );
      }
      companyId = newCompany.id;
      companyName = trimmedName;
    }

    const days = typeof expiresInDays === "number" && expiresInDays > 0 ? expiresInDays : 30;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    const { data: token, error: tokenError } = await supabase
      .from("intake_tokens")
      .insert({
        company_id: companyId,
        label: label || null,
        created_by: auth.userEmail || null,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (tokenError || !token) {
      console.error("Error creating intake token:", tokenError);
      return NextResponse.json(
        { error: "Failed to create intake token" },
        { status: 500 }
      );
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      request.nextUrl.origin ||
      "https://localhost:3000";
    const intakeUrl = `${baseUrl}/intake/${token.token}`;

    return NextResponse.json({
      success: true,
      token,
      intakeUrl,
      companyId,
      companyName,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (e) {
    console.error("Intake token creation error:", e);
    return NextResponse.json(
      { error: "Failed to create intake token" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/company/intake-token
 * Staff-only. Revoke an intake token.
 */
export async function DELETE(request: NextRequest) {
  const auth = await requireStaffOrResponse();
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const tokenId = searchParams.get("tokenId");

    if (!tokenId) {
      return NextResponse.json(
        { error: "tokenId is required" },
        { status: 400 }
      );
    }

    const supabase = getServerClient();
    const { error } = await supabase
      .from("intake_tokens")
      .update({ is_revoked: true, updated_at: new Date().toISOString() })
      .eq("id", tokenId);

    if (error) {
      console.error("Error revoking intake token:", error);
      return NextResponse.json(
        { error: "Failed to revoke token" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Intake token revoke error:", e);
    return NextResponse.json(
      { error: "Failed to revoke token" },
      { status: 500 }
    );
  }
}
