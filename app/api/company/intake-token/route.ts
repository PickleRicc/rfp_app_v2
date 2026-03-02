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
 * Staff-only. Generate a new intake token for the selected company.
 */
export async function POST(request: NextRequest) {
  const auth = await requireStaffOrResponse();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { companyId, label, expiresInDays } = body;

    if (!companyId) {
      return NextResponse.json(
        { error: "companyId is required" },
        { status: 400 }
      );
    }

    const supabase = getServerClient();

    const { data: company, error: companyError } = await supabase
      .from("company_profiles")
      .select("id, company_name")
      .eq("id", companyId)
      .single();

    if (companyError || !company) {
      return NextResponse.json(
        { error: "Company not found" },
        { status: 404 }
      );
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
      companyName: company.company_name,
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
