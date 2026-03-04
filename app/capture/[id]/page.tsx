"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Crosshair,
  FileText,
  Upload,
  Database,
  Search,
  RefreshCw,
  Trash2,
  Play,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/app/components/ui/button";
import { OpportunityReportView } from "@/app/components/capture/OpportunityReportView";
import { OpportunityFinderResults } from "@/app/components/capture/OpportunityFinderResults";
import type {
  OpportunityAnalysis,
  OpportunityDocument,
  AnalysisStatus,
  FitRating,
} from "@/lib/supabase/capture-types";
import {
  ANALYSIS_STATUS_LABELS,
  FIT_RATING_LABELS,
  FIT_RATING_COLORS,
} from "@/lib/supabase/capture-types";

const STATUS_CONFIG: Record<AnalysisStatus, { classes: string }> = {
  draft: { classes: "bg-gray-100 text-gray-700" },
  uploading: { classes: "bg-blue-100 text-blue-700" },
  ready: { classes: "bg-indigo-100 text-indigo-700" },
  analyzing: { classes: "bg-purple-100 text-purple-700" },
  complete: { classes: "bg-green-100 text-green-700" },
  failed: { classes: "bg-red-100 text-red-700" },
};

export default function AnalysisDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [analysis, setAnalysis] = useState<OpportunityAnalysis | null>(null);
  const [documents, setDocuments] = useState<OpportunityDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  const fetchAnalysis = useCallback(async () => {
    try {
      const response = await fetch(`/api/capture/${id}`);
      if (!response.ok) {
        setError("Analysis not found.");
        return;
      }

      const data = await response.json();
      setAnalysis(data.analysis);
      setDocuments(data.documents || []);
    } catch {
      setError("Failed to load analysis.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchAnalysis();
  }, [fetchAnalysis]);

  useEffect(() => {
    if (analysis?.status !== "analyzing") return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/capture/${id}`);
        if (response.ok) {
          const data = await response.json();
          setAnalysis(data.analysis);
          setDocuments(data.documents || []);
          if (
            data.analysis.status === "complete" ||
            data.analysis.status === "failed"
          ) {
            clearInterval(interval);
          }
        }
      } catch {
        // polling error, will retry
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [analysis?.status, id]);

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this analysis?")) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/capture/${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        router.push("/capture");
      }
    } catch {
      setError("Failed to delete analysis.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      const endpoint = analysis?.mode === "finder"
        ? `/api/capture/${id}/find-opportunities`
        : `/api/capture/${id}/analyze`;
      const response = await fetch(endpoint, {
        method: "POST",
      });
      if (response.ok) {
        setAnalysis((prev) =>
          prev ? { ...prev, status: "analyzing" } : prev
        );
      } else {
        const data = await response.json();
        setError(data.error || "Failed to restart analysis.");
      }
    } catch {
      setError("Network error.");
    } finally {
      setIsRetrying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && !analysis) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <AlertCircle className="mx-auto mb-2 h-5 w-5 text-red-500" />
          <p className="text-sm text-red-700">{error}</p>
          <Link
            href="/capture"
            className="mt-3 inline-block text-sm text-primary hover:underline"
          >
            Back to Capture
          </Link>
        </div>
      </div>
    );
  }

  if (!analysis) return null;

  const rfpDocs = documents.filter(
    (d) => d.document_type !== "past_performance"
  );
  const ppDocs = documents.filter(
    (d) => d.document_type === "past_performance"
  );

  const statusConfig = STATUS_CONFIG[analysis.status] || STATUS_CONFIG.draft;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/capture"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Capture
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">
                {analysis.title}
              </h1>
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-medium",
                  statusConfig.classes
                )}
              >
                {ANALYSIS_STATUS_LABELS[analysis.status]}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                {analysis.mode === "finder" ? (
                  <Search className="h-3.5 w-3.5" />
                ) : analysis.mode === "raw" ? (
                  <Upload className="h-3.5 w-3.5" />
                ) : (
                  <Database className="h-3.5 w-3.5" />
                )}
                {analysis.mode === "finder"
                  ? "Opportunity Finder"
                  : analysis.mode === "raw"
                  ? "Raw Upload"
                  : "Company Database"}
              </span>
              {analysis.solicitation_number && (
                <span>Sol: {analysis.solicitation_number}</span>
              )}
              {analysis.agency && <span>{analysis.agency}</span>}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {(analysis.status === "failed" ||
              analysis.status === "ready") && (
              <Button
                variant="outline"
                onClick={handleRetry}
                disabled={isRetrying}
                className="gap-2"
              >
                {isRetrying ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                {analysis.status === "failed" ? "Retry" : "Run Analysis"}
              </Button>
            )}
            <Button
              variant="outline"
              onClick={handleDelete}
              disabled={isDeleting}
              className="gap-2 text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>
      </div>

      {/* Analyzing state */}
      {analysis.status === "analyzing" && (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            {analysis.mode === "finder" ? (
              <Search className="h-8 w-8 animate-pulse text-primary" />
            ) : (
              <Crosshair className="h-8 w-8 animate-pulse text-primary" />
            )}
          </div>
          <h3 className="text-lg font-semibold text-foreground">
            {analysis.mode === "finder"
              ? "Finding Opportunities"
              : "Analyzing Opportunity"}
          </h3>
          <p className="max-w-md text-sm text-muted-foreground">
            {analysis.mode === "finder" ? (
              <>
                Parsing your company data, searching SAM.gov for matching
                opportunities, and scoring results by relevance. This may take a
                few minutes.
              </>
            ) : (
              <>
                Cross-referencing {rfpDocs.length} solicitation document
                {rfpDocs.length !== 1 ? "s" : ""} against{" "}
                {analysis.mode === "raw"
                  ? `${ppDocs.length} past performance document${
                      ppDocs.length !== 1 ? "s" : ""
                    }`
                  : "company database records"}
                . This may take a few minutes.
              </>
            )}
          </p>
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">
              {analysis.mode === "finder"
                ? "Searching opportunities..."
                : "Analysis in progress..."}
            </span>
          </div>
        </div>
      )}

      {/* Failed state */}
      {analysis.status === "failed" && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <AlertCircle className="mx-auto mb-2 h-5 w-5 text-red-500" />
          <p className="text-sm font-medium text-red-800">Analysis Failed</p>
          <p className="mt-1 text-sm text-red-700">
            {analysis.summary || "An error occurred during analysis. Please try again."}
          </p>
        </div>
      )}

      {/* Draft/Uploading state — show document summary */}
      {(analysis.status === "draft" || analysis.status === "uploading") && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="text-sm font-semibold text-foreground">
              Uploaded Documents
            </h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/20 p-4">
                <p className="text-sm font-medium text-foreground">
                  Solicitation Documents
                </p>
                <p className="text-2xl font-bold text-primary">
                  {rfpDocs.length}
                </p>
                {rfpDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"
                  >
                    <FileText className="h-3 w-3" />
                    {doc.filename}
                  </div>
                ))}
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-4">
                <p className="text-sm font-medium text-foreground">
                  {analysis.mode === "raw"
                    ? "Past Performance Documents"
                    : "Company Database Records"}
                </p>
                <p className="text-2xl font-bold text-primary">
                  {analysis.mode === "raw" ? ppDocs.length : "DB"}
                </p>
                {analysis.mode === "raw" &&
                  ppDocs.map((doc) => (
                    <div
                      key={doc.id}
                      className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"
                    >
                      <FileText className="h-3 w-3" />
                      {doc.filename}
                    </div>
                  ))}
                {analysis.mode === "database" && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Using stored past performance from company profile
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Complete state — Finder mode shows OpportunityFinderResults */}
      {analysis.status === "complete" &&
        analysis.mode === "finder" &&
        analysis.finder_report && (
          <OpportunityFinderResults report={analysis.finder_report} />
        )}

      {/* Complete state — Raw/Database mode shows the report */}
      {analysis.status === "complete" &&
        analysis.mode !== "finder" &&
        analysis.report &&
        analysis.overall_fit_rating &&
        analysis.overall_score != null && (
          <OpportunityReportView
            report={analysis.report}
            score={analysis.overall_score}
            fitRating={analysis.overall_fit_rating}
          />
        )}

      {/* Complete but no report data */}
      {analysis.status === "complete" &&
        !analysis.report &&
        !analysis.finder_report && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
            <AlertCircle className="mx-auto mb-2 h-5 w-5 text-amber-500" />
            <p className="text-sm text-amber-800">
              Analysis completed but no report data was generated.
            </p>
          </div>
        )}
    </div>
  );
}
