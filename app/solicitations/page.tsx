"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Plus, Loader2, AlertCircle, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCompany } from "@/lib/context/CompanyContext";
import { Button } from "@/app/components/ui/button";
import type { Solicitation, SolicitationStatus } from "@/lib/supabase/solicitation-types";

// ============================================================
// Status badge config
// ============================================================

const STATUS_CONFIG: Record<
  SolicitationStatus,
  { label: string; classes: string }
> = {
  uploading: { label: "Uploading", classes: "bg-blue-100 text-blue-700" },
  classifying: { label: "Classifying", classes: "bg-amber-100 text-amber-700" },
  reconciling: {
    label: "Reconciling",
    classes: "bg-purple-100 text-purple-700",
  },
  ready: { label: "Ready", classes: "bg-green-100 text-green-700" },
  failed: { label: "Failed", classes: "bg-red-100 text-red-700" },
};

function StatusBadge({ status }: { status: SolicitationStatus }) {
  const config = STATUS_CONFIG[status] ?? {
    label: status,
    classes: "bg-gray-100 text-gray-600",
  };
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

// ============================================================
// Format helpers
// ============================================================

function formatDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateString;
  }
}

// ============================================================
// Solicitations list page
// ============================================================

/**
 * Solicitations List Page — /solicitations
 *
 * Shows all solicitations for the selected company with:
 * - Solicitation number (clickable link to detail page)
 * - Title and agency
 * - Status badge (colored per pipeline state)
 * - Document count
 * - Created date
 * - "New Solicitation" button
 * - Empty state when no solicitations exist
 *
 * Requires a company to be selected (shows warning if not).
 */
export default function SolicitationsPage() {
  const { selectedCompanyId } = useCompany();

  const [solicitations, setSolicitations] = useState<Solicitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSolicitations = useCallback(async () => {
    if (!selectedCompanyId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const headers = new Headers({ "X-Company-Id": selectedCompanyId });
      const response = await fetch("/api/solicitations", { headers });

      if (!response.ok) {
        setError("Failed to load solicitations.");
        return;
      }

      const data = await response.json();
      setSolicitations(data.solicitations || []);
    } catch (err) {
      console.error("Fetch solicitations error:", err);
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [selectedCompanyId]);

  useEffect(() => {
    fetchSolicitations();
  }, [fetchSolicitations]);

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Page header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Solicitations</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your solicitation packages — RFPs, amendments, Q&A responses,
            and templates.
          </p>
        </div>

        {/* New Solicitation button — prominent placement */}
        <Button asChild className="gap-2">
          <Link href="/solicitations/new">
            <Plus className="h-4 w-4" />
            New Solicitation
          </Link>
        </Button>
      </div>

      {/* No company warning */}
      {!selectedCompanyId && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
          <AlertCircle className="mx-auto mb-2 h-5 w-5 text-amber-500" />
          <p className="text-sm font-medium text-amber-800">
            No company selected.
          </p>
          <p className="mt-1 text-xs text-amber-700">
            Please select a company from the header to view solicitations.
          </p>
        </div>
      )}

      {/* Loading state */}
      {selectedCompanyId && loading && (
        <div className="flex min-h-[300px] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error state */}
      {selectedCompanyId && !loading && error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <AlertCircle className="mx-auto mb-2 h-5 w-5 text-red-500" />
          <p className="text-sm text-red-700">{error}</p>
          <button
            onClick={fetchSolicitations}
            className="mt-2 text-xs text-red-600 underline hover:no-underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Empty state */}
      {selectedCompanyId && !loading && !error && solicitations.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
          <FolderOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm font-medium text-foreground">
            No solicitations yet.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload your first solicitation package to get started.
          </p>
          <Button asChild className="mt-4 gap-2">
            <Link href="/solicitations/new">
              <Plus className="h-4 w-4" />
              New Solicitation
            </Link>
          </Button>
        </div>
      )}

      {/* Solicitations table */}
      {selectedCompanyId && !loading && !error && solicitations.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Solicitation
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Documents
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {solicitations.map((sol) => (
                  <tr
                    key={sol.id}
                    className="group hover:bg-muted/20 transition-colors"
                  >
                    {/* Solicitation number + title/agency */}
                    <td className="px-5 py-4">
                      <Link
                        href={`/solicitations/${sol.id}`}
                        className="block"
                      >
                        <span className="font-semibold text-primary group-hover:underline">
                          {sol.solicitation_number}
                        </span>
                        {sol.title && (
                          <span
                            className="mt-0.5 block max-w-[280px] truncate text-xs text-foreground"
                            title={sol.title}
                          >
                            {sol.title}
                          </span>
                        )}
                        {sol.agency && (
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {sol.agency}
                          </span>
                        )}
                      </Link>
                    </td>

                    {/* Status badge */}
                    <td className="px-4 py-4">
                      <StatusBadge status={sol.status} />
                    </td>

                    {/* Document count */}
                    <td className="px-4 py-4">
                      <span className="text-sm text-foreground">
                        {sol.document_count}
                      </span>
                      <span className="ml-1 text-xs text-muted-foreground">
                        {sol.document_count === 1 ? "doc" : "docs"}
                      </span>
                    </td>

                    {/* Created date */}
                    <td className="px-4 py-4">
                      <span className="text-xs text-muted-foreground">
                        {formatDate(sol.created_at)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
