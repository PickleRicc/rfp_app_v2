import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/client";
import { requireStaffOrResponse } from "@/lib/auth";

/**
 * POST /api/company/invite-client
 * Staff only. Create a Supabase Auth user for the given email, link them to the company,
 * and return the portal login URL and temporary password for staff to send to the client.
 */
export async function POST(request: NextRequest) {
  const auth = await requireStaffOrResponse();
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await request.json();
    const { companyId, email, temporaryPassword: providedPassword } = body;

    if (!companyId || !email || typeof email !== "string") {
      return NextResponse.json(
        { error: "companyId and email are required" },
        { status: 400 }
      );
    }

    const emailTrimmed = email.trim().toLowerCase();
    if (!emailTrimmed) {
      return NextResponse.json(
        { error: "Valid email is required" },
        { status: 400 }
      );
    }

    const supabase = getServerClient();

    const { data: company, error: companyError } = await supabase
      .from("company_profiles")
      .select("id, company_name, client_user_id")
      .eq("id", companyId)
      .single();

    if (companyError || !company) {
      const details = process.env.NODE_ENV === "development" ? companyError?.message : undefined;
      return NextResponse.json(
        {
          error: companyError?.code === "PGRST116"
            ? "Company not found. Check that the company exists and you have it selected."
            : "Company not found",
          ...(details && { details }),
        },
        { status: 404 }
      );
    }

    if (company.client_user_id) {
      return NextResponse.json(
        { error: "This company already has a client user linked. Unlink first to invite a different client." },
        { status: 400 }
      );
    }

    const temporaryPassword =
      typeof providedPassword === "string" && providedPassword.length >= 8
        ? providedPassword
        : generateTemporaryPassword();

    const { data: user, error: createError } = await supabase.auth.admin.createUser({
      email: emailTrimmed,
      password: temporaryPassword,
      email_confirm: true,
    });

    if (createError) {
      if (createError.message?.toLowerCase().includes("already been registered")) {
        return NextResponse.json(
          { error: "A user with this email already exists. Use a different email or link the existing user from the database." },
          { status: 400 }
        );
      }
      console.error("Invite client createUser error:", createError);
      return NextResponse.json(
        { error: createError.message ?? "Failed to create user" },
        { status: 500 }
      );
    }

    if (!user.user?.id) {
      return NextResponse.json(
        { error: "User was not created" },
        { status: 500 }
      );
    }

    const { error: updateError } = await supabase
      .from("company_profiles")
      .update({ client_user_id: user.user.id })
      .eq("id", companyId);

    if (updateError) {
      console.error("Invite client update company_profiles error:", updateError);
      return NextResponse.json(
        { error: "User was created but linking to company failed. You may need to link manually." },
        { status: 500 }
      );
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (request.nextUrl.origin || "https://localhost:3000");
    const loginUrl = `${baseUrl}/portal/login`;

    return NextResponse.json({
      success: true,
      message: "Client invited. Share the login URL and temporary password with the client securely.",
      loginUrl,
      email: emailTrimmed,
      temporaryPassword,
      companyName: company.company_name,
    });
  } catch (e) {
    console.error("Invite client error:", e);
    return NextResponse.json(
      { error: "Failed to invite client" },
      { status: 500 }
    );
  }
}

function generateTemporaryPassword(length = 16): string {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
