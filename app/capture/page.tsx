"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Plus,
  Loader2,
  AlertCircle,
  Crosshair,
  Database,
  Upload,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCompany } from "@/lib/context/CompanyContext";
import { Button } from "@/app/components/ui/button";
import type {
  OpportunityAnalysis,
  AnalysisStatus,
  FitRating,
} from "@/lib/supabase/capture-types";
import {
  ANALYSIS_STATUS_LABELS,
  FIT_RATING_LABELS,
  FIT_RATING_COLORS,
} from "@/lib/supabase/capture-types";

const STATUS_CONFIG: Record<AnalysisStatus, { label: string; classes: string }> = {
  draft: { label: "Draft", classes: "bg-gray-100 text-gray-700" },
  uploading: { label: "Uploading", classes: "bg-blue-100 text-blue-700" },
  ready: { label: "Ready", classes: "bg-indigo-100 text-indigo-700" },
  analyzing: { label: "Analyzing", classes: "bg-purple-100 text-purple-700" },
  complete: { label: "Complete", classes: "bg-green-100 text-green-700" },
  failed: { label: "Failed", classes: "bg-red-100 text-red-700" },
};

function StatusBadge({ status }: { status: AnalysisStatus }) {
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

function FitBadge({ rating }: { rating: FitRating }) {
  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-0.5 text-xs font-medium",
        FIT_RATING_COLORS[rating]
      )}
    >
      {FIT_RATING_LABELS[rating]}
    </span>
  );
}

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

export default function CapturePage() {
  const { selectedCompanyId } = useCompany();

  const [analyses, setAnalyses] = useState<OpportunityAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalyses = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const headers = new Headers();
      if (selectedCompanyId) {
        headers.set("X-Company-Id", selectedCompanyId);
      }

      const response = await fetch("/api/capture", { headers });

      if (!response.ok) {
        setError("Failed to load analyses.");
        return;
      }

      const data = await response.json();
      setAnalyses(data.analyses || []);
    } catch (err) {
      console.error("Fetch analyses error:", err);
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [selectedCompanyId]);

  useEffect(() => {
    fetchAnalyses();
  }, [fetchAnalyses]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Capture</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Opportunity confirmation — analyze RFPs against past performance to
            determine fit and win probability.
          </p>
        </div>

        <Button asChild className="gap-2">
          <Link href="/capture/new">
            <Plus className="h-4 w-4" />
            New Analysis
          </Link>
        </Button>
      </div>

      {loading && (
        <div className="flex min-h-[300px] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <AlertCircle className="mx-auto mb-2 h-5 w-5 text-red-500" />
          <p className="text-sm text-red-700">{error}</p>
          <button
            onClick={fetchAnalyses}
            className="mt-2 text-xs text-red-600 underline hover:no-underline"
          >
            Try again
          </button>
        </div>
      )}

      {!loading && !error && analyses.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
          <Crosshair className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm font-medium text-foreground">
            No opportunity analyses yet.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Start your first analysis to evaluate if an RFP is a good fit.
          </p>

          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button asChild variant="outline" className="gap-2">
              <Link href="/capture/new?mode=raw">
                <Upload className="h-4 w-4" />
                Raw Upload Analysis
              </Link>
            </Button>
            <Button asChild className="gap-2">
              <Link href="/capture/new?mode=database">
                <Database className="h-4 w-4" />
                Company Database Analysis
              </Link>
            </Button>
          </div>
        </div>
      )}

      {!loading && !error && analyses.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Analysis
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Mode
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Fit Rating
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {analyses.map((analysis) => (
                  <tr
                    key={analysis.id}
                    className="group transition-colors hover:bg-muted/20"
                  >
                    <td className="px-5 py-4">
                      <Link href={`/capture/${analysis.id}`} className="block">
                        <span className="font-semibold text-primary group-hover:underline">
                          {analysis.title}
                        </span>
                        {analysis.solicitation_number && (
                          <span className="mt-0.5 block text-xs text-foreground">
                            {analysis.solicitation_number}
                          </span>
                        )}
                        {analysis.agency && (
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {analysis.agency}
                          </span>
                        )}
                      </Link>
                    </td>

                    <td className="px-4 py-4">
                      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        {analysis.mode === "raw" ? (
                          <Upload className="h-3.5 w-3.5" />
                        ) : (
                          <Database className="h-3.5 w-3.5" />
                        )}
                        {analysis.mode === "raw" ? "Raw Upload" : "Database"}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      <StatusBadge status={analysis.status} />
                    </td>

                    <td className="px-4 py-4">
                      {analysis.overall_fit_rating ? (
                        <FitBadge rating={analysis.overall_fit_rating} />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>

                    <td className="px-4 py-4">
                      <span className="text-xs text-muted-foreground">
                        {formatDate(analysis.created_at)}
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
