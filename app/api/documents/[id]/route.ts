import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/client";
import { requireStaffOrResponse } from "@/lib/auth";

/**
 * PATCH /api/documents/[id]
 * Staff only. Update document fields (e.g. client_status for portal display).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffOrResponse();
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await params;
    const body = await request.json();

    const supabase = getServerClient();

    const updates: Record<string, unknown> = {};
    if (typeof body.client_status === "string") {
      updates.client_status = body.client_status.trim() || null;
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update (e.g. client_status)" },
        { status: 400 }
      );
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("documents")
      .update(updates)
      .eq("id", id)
      .select("id, client_status, updated_at")
      .single();

    if (error) {
      console.error("Document update error:", error);
      return NextResponse.json(
        { error: error.message ?? "Failed to update document" },
        { status: 500 }
      );
    }

    return NextResponse.json({ document: data });
  } catch (e) {
    console.error("Documents PATCH error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
