"use client";

import { ArrowRight, CheckCircle2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_TYPE_COLORS,
  type SolicitationDocument,
  type DocumentReconciliation,
} from "@/lib/supabase/solicitation-types";

interface AmendmentChainViewProps {
  documents: SolicitationDocument[];
  reconciliations: DocumentReconciliation[];
}

/**
 * AmendmentChainView
 *
 * Visualizes the evolution of a solicitation package from the original base
 * document through successive amendments. Only the latest (non-superseded)
 * version is marked "ACTIVE". Superseded documents appear faded with
 * strikethrough on the name.
 *
 * Per user decision: "Chain view for multi-amendment evolution:
 * Original -> Amend 1 -> Amend 2, with only the latest version active"
 */
export function AmendmentChainView({
  documents,
  reconciliations,
}: AmendmentChainViewProps) {
  // Build the chain: base_rfp first, then amendments sorted by amendment_number
  const baseDocuments = documents.filter((d) => d.document_type === "base_rfp");
  const amendments = documents
    .filter((d) => d.document_type === "amendment")
    .sort((a, b) =>
      (a.amendment_number ?? "").localeCompare(b.amendment_number ?? "")
    );

  const chainNodes = [...baseDocuments, ...amendments];

  // If there are no amendments, just show base documents (no chain to visualize)
  if (amendments.length === 0) {
    if (baseDocuments.length === 0) return null;

    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold text-foreground">
          Document Chain
        </h3>
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
          <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-500" />
          <div>
            <p className="text-sm font-medium text-foreground">
              {baseDocuments[0].filename}
            </p>
            <p className="text-xs text-muted-foreground">
              Base Document — No Amendments
            </p>
          </div>
          <span className="ml-auto rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
            ACTIVE
          </span>
        </div>
      </div>
    );
  }

  // Count changes per amendment for stats
  const changesBySource = reconciliations.reduce<Record<string, number>>(
    (acc, r) => {
      acc[r.source_document_id] = (acc[r.source_document_id] ?? 0) + 1;
      return acc;
    },
    {}
  );

  // Determine the latest active amendment (last in chain)
  const latestNode = chainNodes[chainNodes.length - 1];

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="mb-4 text-sm font-semibold text-foreground">
        Amendment Chain
      </h3>

      {/* Horizontal scrollable chain */}
      <div className="overflow-x-auto">
        <div className="flex min-w-max items-start gap-0 pb-2">
          {chainNodes.map((node, index) => {
            const isLatest = node.id === latestNode.id;
            const isSuperseded = node.is_superseded;
            const changeCount = changesBySource[node.id] ?? 0;
            const typeColor =
              DOCUMENT_TYPE_COLORS[node.document_type ?? "other_unclassified"];
            const typeLabel =
              DOCUMENT_TYPE_LABELS[node.document_type ?? "other_unclassified"];

            return (
              <div key={node.id} className="flex items-start">
                {/* Chain node */}
                <div
                  className={cn(
                    "w-44 rounded-lg border p-3 transition-all",
                    isLatest
                      ? "border-green-400 bg-green-50 shadow-sm"
                      : isSuperseded
                      ? "border-border bg-muted/40 opacity-60"
                      : "border-border bg-card"
                  )}
                >
                  {/* Type badge */}
                  <div className="mb-2 flex items-center justify-between gap-1">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        typeColor
                      )}
                    >
                      {typeLabel}
                    </span>
                    {isLatest && (
                      <span className="rounded-full bg-green-500 px-1.5 py-0.5 text-xs font-bold text-white">
                        ACTIVE
                      </span>
                    )}
                  </div>

                  {/* Filename */}
                  <p
                    className={cn(
                      "truncate text-xs font-medium",
                      isSuperseded
                        ? "text-muted-foreground line-through"
                        : "text-foreground"
                    )}
                    title={node.filename}
                  >
                    {node.filename}
                  </p>

                  {/* Amendment number */}
                  {node.amendment_number && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {node.amendment_number}
                    </p>
                  )}

                  {/* Effective date */}
                  {node.effective_date && (
                    <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3 flex-shrink-0" />
                      <span>
                        {new Date(node.effective_date).toLocaleDateString()}
                      </span>
                    </div>
                  )}

                  {/* Change count stat */}
                  {changeCount > 0 && (
                    <p className="mt-1.5 text-xs text-amber-600">
                      {changeCount} change{changeCount !== 1 ? "s" : ""}
                    </p>
                  )}
                </div>

                {/* Arrow between nodes */}
                {index < chainNodes.length - 1 && (
                  <div className="flex h-16 items-center px-1">
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary stats */}
      <div className="mt-3 flex flex-wrap gap-4 border-t border-border pt-3">
        <div className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{amendments.length}</span>{" "}
          amendment{amendments.length !== 1 ? "s" : ""}
        </div>
        <div className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            {reconciliations.length}
          </span>{" "}
          total reconciliation change{reconciliations.length !== 1 ? "s" : ""}
        </div>
        {reconciliations.filter((r) => r.source_type === "qa_response").length >
          0 && (
          <div className="text-xs text-muted-foreground">
            <span className="font-medium text-green-700">
              {
                reconciliations.filter((r) => r.source_type === "qa_response")
                  .length
              }
            </span>{" "}
            Q&A-sourced
          </div>
        )}
      </div>
    </div>
  );
}
