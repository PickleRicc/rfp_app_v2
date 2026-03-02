import { getServerClient } from "@/lib/supabase/client";
import type { IntakeToken } from "@/lib/supabase/intake-token-types";

export interface TokenValidationResult {
  valid: true;
  token: IntakeToken;
  companyId: string;
}

export interface TokenValidationError {
  valid: false;
  error: string;
  status: number;
}

/**
 * Validate an intake token and return the associated company ID.
 * Also bumps access_count and last_accessed_at.
 */
export async function validateIntakeToken(
  tokenValue: string
): Promise<TokenValidationResult | TokenValidationError> {
  if (!tokenValue || typeof tokenValue !== "string" || tokenValue.length < 16) {
    return { valid: false, error: "Invalid token", status: 400 };
  }

  const supabase = getServerClient();

  const { data: token, error } = await supabase
    .from("intake_tokens")
    .select("*")
    .eq("token", tokenValue)
    .single();

  if (error || !token) {
    return { valid: false, error: "Token not found", status: 404 };
  }

  if (token.is_revoked) {
    return {
      valid: false,
      error: "This intake link has been revoked. Please contact your representative for a new link.",
      status: 403,
    };
  }

  if (new Date(token.expires_at) < new Date()) {
    return {
      valid: false,
      error: "This intake link has expired. Please contact your representative for a new link.",
      status: 403,
    };
  }

  await supabase
    .from("intake_tokens")
    .update({
      last_accessed_at: new Date().toISOString(),
      access_count: (token.access_count || 0) + 1,
    })
    .eq("id", token.id);

  return {
    valid: true,
    token: token as IntakeToken,
    companyId: token.company_id,
  };
}
