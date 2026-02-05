import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/client";
import { requireClient } from "@/lib/auth";

/**
 * GET /api/portal/documents
 * List documents and proposal status for the authenticated client's company only.
 */
export async function GET() {
  try {
    const { companyId } = await requireClient();
    const supabase = getServerClient();

    const { data: documents, error: docError } = await supabase
      .from("documents")
      .select("id, filename, document_type, created_at, updated_at, client_status")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (docError) {
      console.error("Portal documents fetch error:", docError);
      return NextResponse.json(
        { error: "Failed to fetch documents" },
        { status: 500 }
      );
    }

    const docList = documents ?? [];
    const documentIds = docList.map((d) => d.id);

    const { data: responses } = await supabase
      .from("rfp_responses")
      .select("document_id, id, status, requirements_coverage_percent, completed_at")
      .in("document_id", documentIds.length ? documentIds : ["__none__"]);

    const responseByDoc = new Map(
      (responses ?? []).map((r) => [r.document_id, r])
    );

    const readyStatuses = ["complete", "ready for review", "ready"];
    const isReady = (s: string | null) =>
      s && readyStatuses.some((r) => (s || "").toLowerCase().includes(r));

    const items = docList.map((doc) => {
      const response = responseByDoc.get(doc.id);
      const status = doc.client_status ?? "Pending";
      const allowDownload = !!response && isReady(doc.client_status);
      return {
        id: doc.id,
        filename: doc.filename,
        document_type: doc.document_type,
        created_at: doc.created_at,
        updated_at: doc.updated_at,
        client_status: status,
        proposal: response
          ? {
              responseId: response.id,
              canDownload: allowDownload,
            }
          : null,
      };
    });

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const byStatus: Record<string, number> = {};
    let lastUpdated: string | null = null;
    for (const doc of items) {
      byStatus[doc.client_status] = (byStatus[doc.client_status] ?? 0) + 1;
      if (doc.updated_at && (!lastUpdated || doc.updated_at > lastUpdated)) {
        lastUpdated = doc.updated_at;
      }
    }
    const readyForYou = items.filter((d) => d.proposal?.canDownload).length;
    const newThisMonth = items.filter((d) => d.created_at >= startOfMonth).length;

    return NextResponse.json({
      documents: items,
      count: items.length,
      stats: {
        total: items.length,
        readyForYou,
        byStatus,
        lastUpdated,
        newThisMonth,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unauthorized";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
