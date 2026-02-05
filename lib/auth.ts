import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServerClient } from "@/lib/supabase/client";

export type AuthResult = {
  userId: string | null;
  userEmail: string | null;
  isClient: boolean;
  companyId: string | null;
};

/**
 * Get current auth session and resolve whether user is a client (linked to a company).
 * Use in API routes and server components.
 */
export async function getAuth(): Promise<AuthResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return { userId: null, userEmail: null, isClient: false, companyId: null };
  }

  const server = getServerClient();
  const { data: company } = await server
    .from("company_profiles")
    .select("id")
    .eq("client_user_id", user.id)
    .maybeSingle();

  return {
    userId: user.id,
    userEmail: user.email ?? null,
    isClient: !!company?.id,
    companyId: company?.id ?? null,
  };
}

/**
 * Require staff for API routes. Returns AuthResult or a NextResponse (401/403) to return.
 */
export async function requireStaffOrResponse(): Promise<AuthResult | NextResponse> {
  try {
    return await requireStaff();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unauthorized";
    if (message.includes("Forbidden"))
      return NextResponse.json({ error: message }, { status: 403 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

/**
 * Require client for API routes (e.g. portal). Returns AuthResult with companyId or NextResponse (401).
 */
export async function requireClientOrResponse(): Promise<
  (AuthResult & { companyId: string }) | NextResponse
> {
  try {
    return await requireClient();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

/**
 * Resolve company ID for company-scoped API routes. For portal (X-Portal: true) uses client's company;
 * for staff uses X-Company-Id. Returns 400 if staff and no header.
 */
export async function getCompanyIdOrResponse(
  request: Request
): Promise<{ companyId: string } | NextResponse> {
  const isPortal = request.headers.get("X-Portal") === "true";
  if (isPortal) {
    const auth = await requireClientOrResponse();
    if (auth instanceof NextResponse) return auth;
    return { companyId: auth.companyId };
  }
  const auth = await requireStaffOrResponse();
  if (auth instanceof NextResponse) return auth;
  const companyId = request.headers.get("X-Company-Id");
  if (!companyId) {
    return NextResponse.json(
      { error: "No company selected. Please select a company." },
      { status: 400 }
    );
  }
  return { companyId };
}

/**
 * Require staff (authenticated and not a client). Throws if not staff; returns auth result.
 */
export async function requireStaff(): Promise<AuthResult> {
  const auth = await getAuth();
  if (!auth.userId) {
    throw new Error("Unauthorized");
  }
  if (auth.isClient) {
    throw new Error("Forbidden: client access not allowed");
  }
  return auth;
}

/**
 * Require client (authenticated and linked to a company). Throws if not client; returns auth result with companyId.
 */
export async function requireClient(): Promise<AuthResult & { companyId: string }> {
  const auth = await getAuth();
  if (!auth.userId || !auth.isClient || !auth.companyId) {
    throw new Error("Unauthorized");
  }
  return { ...auth, companyId: auth.companyId };
}
