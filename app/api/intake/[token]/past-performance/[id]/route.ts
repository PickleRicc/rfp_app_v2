import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/client";
import { validateIntakeToken } from "@/lib/intake/validate-token";

/** Fields that external clients are allowed to update on past performance records. */
const ALLOWED_PP_FIELDS = new Set([
  'contract_nickname', 'contract_name', 'contract_number', 'task_order_number',
  'client_agency', 'client_office', 'contract_type', 'contract_value',
  'annual_value', 'start_date', 'end_date', 'base_period', 'option_periods',
  'role', 'percentage_of_work', 'prime_contractor', 'team_size',
  'place_of_performance', 'client_poc', 'alternate_poc',
  'cpars_rating', 'customer_feedback',
  'overview', 'description_of_effort',
  'task_areas', 'tools_used', 'achievements', 'relevance_tags',
]);

/**
 * GET /api/intake/[token]/past-performance/[id]
 * Public. Fetch a single past performance record.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string; id: string }> }
) {
  const { token, id } = await params;
  const result = await validateIntakeToken(token);
  if (!result.valid) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status }
    );
  }

  const supabase = getServerClient();
  const { data: contract, error } = await supabase
    .from("past_performance")
    .select("*")
    .eq("id", id)
    .eq("company_id", result.companyId)
    .single();

  if (error || !contract) {
    return NextResponse.json(
      { error: "Record not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ contract });
}

/**
 * PUT /api/intake/[token]/past-performance/[id]
 * Public. Update a past performance record via intake token.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ token: string; id: string }> }
) {
  const { token, id } = await params;
  const result = await validateIntakeToken(token);
  if (!result.valid) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status }
    );
  }

  try {
    const rawBody = await request.json();
    const supabase = getServerClient();

    // Strip any fields not in the allowlist to prevent mass assignment
    const body: Record<string, unknown> = {};
    for (const key of Object.keys(rawBody)) {
      if (ALLOWED_PP_FIELDS.has(key)) {
        body[key] = rawBody[key];
      }
    }

    // Verify ownership
    const { data: existing } = await supabase
      .from("past_performance")
      .select("id")
      .eq("id", id)
      .eq("company_id", result.companyId)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: "Record not found" },
        { status: 404 }
      );
    }

    const { data: contract, error } = await supabase
      .from("past_performance")
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating past performance via token:", error);
      return NextResponse.json(
        { error: "Failed to update record" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, contract });
  } catch (err) {
    console.error("Past performance update via token error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/intake/[token]/past-performance/[id]
 * Public. Delete a past performance record via intake token.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string; id: string }> }
) {
  const { token, id } = await params;
  const result = await validateIntakeToken(token);
  if (!result.valid) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status }
    );
  }

  try {
    const supabase = getServerClient();

    // Verify ownership
    const { data: existing } = await supabase
      .from("past_performance")
      .select("id")
      .eq("id", id)
      .eq("company_id", result.companyId)
      .single();

    if (!existing) {
      return NextResponse.json(
        { error: "Record not found" },
        { status: 404 }
      );
    }

    const { error } = await supabase
      .from("past_performance")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting past performance via token:", error);
      return NextResponse.json(
        { error: "Failed to delete record" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Past performance delete via token error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
