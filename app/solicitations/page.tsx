"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Plus, Loader2, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCompany } from "@/lib/context/CompanyContext";
import { Button } from "@/app/components/ui/button";
import { AlertBanner } from "@/app/components/ui/alert-banner";
import { makeStatusBadge } from "@/app/components/ui/status-badge";
import type { Solicitation, SolicitationStatus } from "@/lib/supabase/solicitation-types";

// ── Status badge ────────────────────────────────────────────────────────────

const SOLICITATION_STATUS: Record<SolicitationStatus, { label: string; classes: string }> = {
  uploading:   { label: "Uploading",   classes: "bg-blue-500/15 text-blue-400" },
  classifying: { label: "Classifying", classes: "bg-amber-500/15 text-amber-400" },
  reconciling: { label: "Reconciling", classes: "bg-purple-500/15 text-purple-400" },
  ready:       { label: "Ready",       classes: "bg-success/15 text-success" },
  failed:      { label: "Failed",      classes: "bg-destructive/15 text-destructive" },
};

const SolicitationStatusBadge = makeStatusBadge(SOLICITATION_STATUS);

// ── Helpers ──────────────────────────────────────────────────────────────────

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

// ── Page ─────────────────────────────────────────────────────────────────────

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
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [selectedCompanyId]);

  useEffect(() => {
    fetchSolicitations();
  }, [fetchSolicitations]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Page header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Solicitations</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your RFPs, amendments, Q&A responses, and templates.
          </p>
        </div>
        <Button asChild className="gap-2">
          <Link href="/solicitations/new">
            <Plus className="h-4 w-4" />
            New Solicitation
          </Link>
        </Button>
      </div>

      {/* No company selected */}
      {!selectedCompanyId && (
        <AlertBanner
          variant="warning"
          title="No company selected"
          message="Select a company from the header to view solicitations."
          center
        />
      )}

      {/* Loading */}
      {selectedCompanyId && loading && (
        <div className="flex min-h-[300px] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error */}
      {selectedCompanyId && !loading && error && (
        <AlertBanner
          variant="error"
          message={error}
          action={
            <button
              onClick={fetchSolicitations}
              className="text-xs text-primary underline hover:no-underline"
            >
              Try again
            </button>
          }
        />
      )}

      {/* Empty state */}
      {selectedCompanyId && !loading && !error && solicitations.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
          <FolderOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium text-foreground">No solicitations yet.</p>
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

      {/* Table */}
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
                    Docs
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
                    className={cn(
                      "group cursor-pointer transition-colors hover:bg-muted/30"
                    )}
                    onClick={() => { window.location.href = `/solicitations/${sol.id}`; }}
                  >
                    <td className="px-5 py-4">
                      <Link
                        href={`/solicitations/${sol.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="block"
                      >
                        <span className="font-semibold text-primary group-hover:underline">
                          {sol.solicitation_number}
                        </span>
                        {sol.title && (
                          <span
                            className="mt-0.5 block max-w-[300px] truncate text-xs text-foreground"
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

                    <td className="px-4 py-4">
                      <SolicitationStatusBadge status={sol.status} />
                    </td>

                    <td className="px-4 py-4">
                      <span className="tabular-nums text-sm text-foreground">
                        {sol.document_count}
                      </span>
                      <span className="ml-1 text-xs text-muted-foreground">
                        {sol.document_count === 1 ? "doc" : "docs"}
                      </span>
                    </td>

                    <td className="px-4 py-4 text-xs text-muted-foreground">
                      {formatDate(sol.created_at)}
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
