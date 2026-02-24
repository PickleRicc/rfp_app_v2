"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_TYPE_COLORS,
  type SolicitationDocument,
  type SolicitationDocumentType,
} from "@/lib/supabase/solicitation-types";

// All 11 document types in display order for the reclassification dropdown
const DOCUMENT_TYPE_OPTIONS: SolicitationDocumentType[] = [
  "base_rfp",
  "soo_sow_pws",
  "amendment",
  "qa_response",
  "pricing_template",
  "dd254",
  "clauses",
  "cdrls",
  "wage_determination",
  "provisions",
  "other_unclassified",
];

// Sort order for document types — base_rfp first, amendments second, then others alphabetically
const TYPE_SORT_ORDER: Record<SolicitationDocumentType, number> = {
  base_rfp: 0,
  amendment: 1,
  soo_sow_pws: 2,
  qa_response: 3,
  pricing_template: 4,
  dd254: 5,
  clauses: 6,
  cdrls: 7,
  wage_determination: 8,
  provisions: 9,
  other_unclassified: 10,
};

function sortDocuments(docs: SolicitationDocument[]): SolicitationDocument[] {
  return [...docs].sort((a, b) => {
    const typeA = a.document_type ?? "other_unclassified";
    const typeB = b.document_type ?? "other_unclassified";
    const orderA = TYPE_SORT_ORDER[typeA] ?? 99;
    const orderB = TYPE_SORT_ORDER[typeB] ?? 99;

    if (orderA !== orderB) return orderA - orderB;

    // For amendments, sort by amendment_number
    if (typeA === "amendment" && typeB === "amendment") {
      return (a.amendment_number ?? "").localeCompare(b.amendment_number ?? "");
    }

    return a.filename.localeCompare(b.filename);
  });
}

interface DocumentClassificationTableProps {
  solicitationId: string;
  documents: SolicitationDocument[];
  onReclassify: (docId: string, newType: SolicitationDocumentType) => void;
}

interface TypeBadgeProps {
  docId: string;
  currentType?: SolicitationDocumentType;
  onReclassify: (docId: string, newType: SolicitationDocumentType) => void;
}

function TypeBadge({ docId, currentType, onReclassify }: TypeBadgeProps) {
  const [open, setOpen] = useState(false);

  const type = currentType ?? "other_unclassified";
  const label = DOCUMENT_TYPE_LABELS[type];
  const colorClasses = DOCUMENT_TYPE_COLORS[type];

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "cursor-pointer rounded-full px-2.5 py-0.5 text-xs font-medium transition-opacity hover:opacity-80",
          colorClasses,
          !currentType && "border border-dashed border-neutral-400"
        )}
        title="Click to reclassify"
      >
        {!currentType ? "Classify this document" : label}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          {/* Dropdown */}
          <div className="absolute left-0 top-full z-20 mt-1 min-w-[180px] overflow-hidden rounded-lg border border-border bg-card shadow-lg">
            {DOCUMENT_TYPE_OPTIONS.map((option) => (
              <button
                key={option}
                onClick={() => {
                  onReclassify(docId, option);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted",
                  option === type && "bg-muted/50 font-medium"
                )}
              >
                <span
                  className={cn(
                    "inline-block h-2 w-2 flex-shrink-0 rounded-full",
                    DOCUMENT_TYPE_COLORS[option].split(" ")[0]
                  )}
                />
                {DOCUMENT_TYPE_LABELS[option]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * DocumentClassificationTable
 *
 * Displays all classified solicitation documents in a table with:
 * - Colored type badges (clickable to reclassify via dropdown)
 * - Warning icon on low-confidence classifications only
 * - Amendment number column (when applicable)
 * - Processing status badge
 * - Documents sorted: base_rfp first, amendments by number, then others
 */
export function DocumentClassificationTable({
  solicitationId: _solicitationId,
  documents,
  onReclassify,
}: DocumentClassificationTableProps) {
  const sorted = sortDocuments(documents);

  if (sorted.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">No documents to display.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Filename
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Confidence
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Amendment #
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sorted.map((doc) => (
              <tr key={doc.id} className="hover:bg-muted/20 transition-colors">
                {/* Filename */}
                <td className="px-4 py-3">
                  <span
                    className="max-w-[240px] block truncate font-medium text-foreground"
                    title={doc.filename}
                  >
                    {doc.filename}
                  </span>
                  {doc.classification_reasoning && (
                    <span
                      className="mt-0.5 block max-w-[240px] truncate text-xs text-muted-foreground"
                      title={doc.classification_reasoning}
                    >
                      {doc.classification_reasoning}
                    </span>
                  )}
                </td>

                {/* Type badge — clickable for reclassification */}
                <td className="px-4 py-3">
                  <TypeBadge
                    docId={doc.id}
                    currentType={doc.document_type}
                    onReclassify={onReclassify}
                  />
                </td>

                {/* Confidence — only show warning icon for 'low' */}
                <td className="px-4 py-3">
                  {doc.classification_confidence === "low" ? (
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-500" />
                      <span className="text-xs text-amber-600">Low</span>
                    </div>
                  ) : doc.classification_confidence === "medium" ? (
                    <span className="text-xs text-muted-foreground">Medium</span>
                  ) : doc.classification_confidence === "high" ? (
                    <span className="text-xs text-green-600">High</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>

                {/* Amendment number */}
                <td className="px-4 py-3">
                  {doc.amendment_number ? (
                    <span className="text-xs font-medium text-foreground">
                      {doc.amendment_number}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>

                {/* Processing status */}
                <td className="px-4 py-3">
                  <StatusBadge status={doc.processing_status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; classes: string }> = {
    pending: { label: "Pending", classes: "bg-gray-100 text-gray-600" },
    extracting: { label: "Extracting", classes: "bg-blue-100 text-blue-700" },
    classified: { label: "Classified", classes: "bg-green-100 text-green-700" },
    reconciled: { label: "Reconciled", classes: "bg-teal-100 text-teal-700" },
    failed: { label: "Failed", classes: "bg-red-100 text-red-700" },
  };

  const config = map[status] ?? { label: status, classes: "bg-gray-100 text-gray-600" };

  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-0.5 text-xs font-medium",
        config.classes
      )}
    >
      {config.label}
    </span>
  );
}
