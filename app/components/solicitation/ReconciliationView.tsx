"use client";

import { useState } from "react";
import { RotateCcw, RotateCw, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  DocumentReconciliation,
  SolicitationDocument,
  ReconciliationChangeType,
} from "@/lib/supabase/solicitation-types";

// Human-readable labels for change types
const CHANGE_TYPE_LABELS: Record<ReconciliationChangeType, string> = {
  supersedes_section: "Supersedes Section",
  modifies_scope: "Modifies Scope",
  modifies_page_limit: "Modifies Page Limit",
  modifies_eval_criteria: "Modifies Eval Criteria",
  modifies_submission_instructions: "Modifies Submission Instructions",
  adds_requirement: "Adds Requirement",
  removes_requirement: "Removes Requirement",
  general_modification: "General Modification",
};

interface ReconciliationViewProps {
  reconciliations: EnrichedReconciliation[];
  documents: SolicitationDocument[];
  onToggle: (reconciliationId: string, isActive: boolean) => void;
}

/** Reconciliation enriched with source/target document filenames from the API */
export interface EnrichedReconciliation extends DocumentReconciliation {
  source_document_filename?: string | null;
  target_document_filename?: string | null;
}

/**
 * ReconciliationView
 *
 * Displays all reconciliation records grouped by target document.
 *
 * For each change:
 * - Shows source badge: Amendment (amber) or Q&A Response (green)
 * - Shows change type badge
 * - Shows section reference
 * - Original text with inline strikethrough when is_active=true
 * - Replacement text with left accent border
 * - Link/tag to source document
 * - Undo/Restore toggle button
 *
 * Per user decisions:
 * - "Inline strikethrough for superseded text"
 * - "Q&A responses tagged as 'Q&A-sourced'"
 * - "Users can override reconciliation with undo/restore action"
 * - "with a link/tag to the amendment that replaced it"
 */
export function ReconciliationView({
  reconciliations,
  documents,
  onToggle,
}: ReconciliationViewProps) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  if (reconciliations.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">
          No reconciliation changes detected.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Reconciliation records are created when amendments or Q&A responses
          modify the base document.
        </p>
      </div>
    );
  }

  // Group reconciliations by target_document_id (the document being modified)
  const grouped = reconciliations.reduce<
    Map<string | null, EnrichedReconciliation[]>
  >((acc, r) => {
    const key = r.target_document_id ?? null;
    if (!acc.has(key)) acc.set(key, []);
    acc.get(key)!.push(r);
    return acc;
  }, new Map());

  // Build document lookup for group headers
  const docById = documents.reduce<Record<string, SolicitationDocument>>(
    (acc, d) => {
      acc[d.id] = d;
      return acc;
    },
    {}
  );

  const toggleExpand = (id: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {Array.from(grouped.entries()).map(([targetDocId, recs]) => {
        const targetDoc = targetDocId ? docById[targetDocId] : null;
        const groupLabel = targetDoc
          ? targetDoc.filename
          : "General Changes (No Specific Target)";

        return (
          <div key={targetDocId ?? "null"} className="space-y-3">
            {/* Group header: target document name */}
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-border" />
              <h3 className="whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Changes to: {groupLabel}
              </h3>
              <div className="h-px flex-1 bg-border" />
            </div>

            {/* Reconciliation records in this group */}
            {recs.map((rec) => (
              <ReconciliationCard
                key={rec.id}
                reconciliation={rec}
                expanded={expandedItems.has(rec.id)}
                onToggleExpand={() => toggleExpand(rec.id)}
                onToggleActive={() => onToggle(rec.id, !rec.is_active)}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// ReconciliationCard — individual change record
// ============================================================

interface ReconciliationCardProps {
  reconciliation: EnrichedReconciliation;
  expanded: boolean;
  onToggleExpand: () => void;
  onToggleActive: () => void;
}

function ReconciliationCard({
  reconciliation: rec,
  expanded,
  onToggleExpand,
  onToggleActive,
}: ReconciliationCardProps) {
  const isAmendment = rec.source_type === "amendment";
  const isActive = rec.is_active;

  const sourceBadgeClasses = isAmendment
    ? "bg-amber-100 text-amber-800"
    : "bg-green-100 text-green-800";
  const accentBorderColor = isAmendment
    ? "border-amber-400"
    : "border-green-400";

  const sourceLabel = isAmendment ? "Amendment" : "Q&A Response";
  const changeTypeLabel =
    CHANGE_TYPE_LABELS[rec.change_type] ?? rec.change_type;

  const hasText = rec.original_text || rec.replacement_text;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border transition-all",
        isActive ? "border-border bg-card" : "border-border/50 bg-muted/30"
      )}
    >
      {/* Card header */}
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          {/* Source badge: Amendment or Q&A Response */}
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-semibold",
              sourceBadgeClasses
            )}
          >
            {sourceLabel}
          </span>

          {/* Change type badge */}
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            {changeTypeLabel}
          </span>

          {/* Section reference */}
          {rec.section_reference && (
            <span className="text-xs text-muted-foreground">
              {rec.section_reference}
            </span>
          )}

          {/* Source document link/tag */}
          {rec.source_document_filename && (
            <span className="text-xs text-muted-foreground">
              from:{" "}
              <span className="font-medium text-foreground">
                {rec.source_document_filename}
              </span>
            </span>
          )}

          {/* Overridden indicator */}
          {!isActive && (
            <span className="rounded-full border border-muted-foreground/30 px-2 py-0.5 text-xs text-muted-foreground">
              Overridden by user
            </span>
          )}
        </div>

        <div className="flex flex-shrink-0 items-center gap-2">
          {/* Undo / Restore toggle */}
          <button
            onClick={onToggleActive}
            className={cn(
              "flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
              isActive
                ? "border-border text-muted-foreground hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700"
                : "border-green-300 bg-green-50 text-green-700 hover:bg-green-100"
            )}
            title={isActive ? "Undo this change" : "Restore this change"}
          >
            {isActive ? (
              <>
                <RotateCcw className="h-3 w-3" />
                Undo
              </>
            ) : (
              <>
                <RotateCw className="h-3 w-3" />
                Restore
              </>
            )}
          </button>

          {/* Expand/collapse button (only if there's text to show) */}
          {hasText && (
            <button
              onClick={onToggleExpand}
              className="flex items-center gap-1 rounded-lg border border-border px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted"
              title={expanded ? "Collapse" : "Show text"}
            >
              {expanded ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Expandable text section */}
      {hasText && expanded && (
        <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
          {/* Original text with strikethrough when change is active */}
          {rec.original_text && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Original
              </p>
              <p
                className={cn(
                  "text-sm leading-relaxed",
                  isActive
                    ? "text-muted-foreground line-through"
                    : "text-foreground"
                )}
              >
                {rec.original_text}
              </p>
            </div>
          )}

          {/* Replacement text with left accent border */}
          {rec.replacement_text && isActive && (
            <div
              className={cn(
                "border-l-4 pl-3",
                accentBorderColor
              )}
            >
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Replaced by
              </p>
              <p className="text-sm leading-relaxed text-foreground">
                {rec.replacement_text}
              </p>
            </div>
          )}

          {/* When overridden: show replacement text as inactive/muted */}
          {rec.replacement_text && !isActive && (
            <div className="border-l-4 border-muted pl-3 opacity-50">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Amendment text (overridden)
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {rec.replacement_text}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
