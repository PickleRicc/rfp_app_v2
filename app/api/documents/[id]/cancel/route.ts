import { NextRequest, NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/client";
import { requireStaffOrResponse } from "@/lib/auth";

/**
 * POST /api/documents/[id]/cancel
 * Cancel a stuck processing or generating_proposal job.
 * Resets the document status to its previous stable state:
 *   - processing → failed
 *   - generating_proposal → completed
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffOrResponse();
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await params;
    const supabase = getServerClient();

    // Get current document
    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("id, status")
      .eq("id", id)
      .single();

    if (docError || !document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Only allow cancellation of processing states
    if (document.status !== "processing" && document.status !== "generating_proposal") {
      return NextResponse.json(
        { error: `Cannot cancel a document with status "${document.status}". Only processing or generating jobs can be cancelled.` },
        { status: 400 }
      );
    }

    // Determine the reset status:
    // - processing (Stage 1 analysis) → failed (needs re-upload or re-analysis)
    // - generating_proposal (Stage 2) → completed (analysis was done, can re-generate)
    const resetStatus = document.status === "generating_proposal" ? "completed" : "failed";

    // Update document status
    const { error: updateError } = await supabase
      .from("documents")
      .update({
        status: resetStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      console.error("Failed to cancel job:", updateError);
      return NextResponse.json(
        { error: "Failed to update document status" },
        { status: 500 }
      );
    }

    // If it was generating_proposal, also mark any in-progress response as failed
    if (document.status === "generating_proposal") {
      const { error: responseError } = await supabase
        .from("rfp_responses")
        .update({
          status: "failed",
          updated_at: new Date().toISOString(),
        })
        .eq("document_id", id)
        .eq("status", "generating");

      if (responseError) {
        console.warn("Could not update response status:", responseError);
      }
    }

    // Log the cancellation
    await supabase.from("processing_logs").insert({
      document_id: id,
      stage: "manual-cancellation",
      status: "completed",
      metadata: {
        previous_status: document.status,
        reset_to: resetStatus,
        cancelled_at: new Date().toISOString(),
      },
    });

    console.log(`✅ Job cancelled for document ${id}: ${document.status} → ${resetStatus}`);

    return NextResponse.json({
      success: true,
      previous_status: document.status,
      new_status: resetStatus,
    });
  } catch (error) {
    console.error("Cancel job error:", error);
    return NextResponse.json(
      { error: "Failed to cancel job" },
      { status: 500 }
    );
  }
}
