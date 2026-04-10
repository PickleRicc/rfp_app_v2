"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Loader2,
  CheckCircle,
  XCircle,
  RefreshCw,
  Clock,
  Lock,
  DollarSign,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  P2wAnalysis,
  P2wGetResponse,
  P2wRateBenchmarkRow,
} from "@/lib/supabase/p2w-types";

// ============================================================
// Props
// ============================================================

export interface P2wViewProps {
  solicitationId: string;
  companyId: string;
}

// ============================================================
// Helpers
// ============================================================

function formatCurrency(val: number | null): string {
  if (val == null) return "N/A";
  return `$${val.toFixed(2)}/hr`;
}

function formatMillions(val: number | null): string {
  if (val == null) return "—";
  const m = val / 1_000_000;
  return `$${m.toFixed(1)}M`;
}

// ============================================================
// Rate Confidence Badge
// ============================================================

function RateConfidenceBadge({ level }: { level: "high" | "medium" | "low" }) {
  const styles = {
    high: "bg-green-100 text-green-700 border-green-200",
    medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
    low: "bg-red-100 text-red-700 border-red-200",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize",
        styles[level]
      )}
    >
      {level}
    </span>
  );
}

// ============================================================
// Recommended Target cell color
// ============================================================

function targetRateCellClass(
  rate: number,
  blsMedian: number | null
): string {
  if (blsMedian == null) return "text-foreground";
  const ratio = rate / blsMedian;
  if (ratio <= 1.1) return "text-green-700 font-semibold";
  if (ratio <= 1.2) return "text-amber-700 font-semibold";
  return "text-red-700 font-semibold";
}

// ============================================================
// Data Source Badges
// ============================================================

function DataSourceBadges({ rows }: { rows: P2wRateBenchmarkRow[] }) {
  const allSources = new Set(rows.flatMap((r) => r.data_sources_used));
  return (
    <div className="flex flex-wrap items-center gap-2">
      {allSources.has("bls_oes") && (
        <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
          BLS OES May 2024
        </span>
      )}
      {allSources.has("gsa_elibrary") && (
        <span className="inline-flex items-center rounded-full border border-green-200 bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
          GSA eLibrary
        </span>
      )}
      {allSources.has("ai_estimated") && (
        <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
          AI Estimated
        </span>
      )}
    </div>
  );
}

// ============================================================
// Rate Table
// ============================================================

function RateTable({ rows }: { rows: P2wRateBenchmarkRow[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {[
                "Labor Category",
                "FTE",
                "Annual Hrs",
                "BLS Median",
                "GSA Range",
                "Gov Estimate",
                "Rec. Low",
                "Rec. Target",
                "Rec. High",
                "Confidence",
              ].map((h) => (
                <th
                  key={h}
                  className={cn(
                    "px-3 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground",
                    h === "Rec. Target"
                      ? "bg-blue-50 text-blue-700"
                      : "",
                    h === "Labor Category" ? "text-left" : "text-right"
                  )}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
              >
                <td className="px-3 py-3 font-medium text-foreground">
                  {row.labor_category}
                </td>
                <td className="px-3 py-3 text-right font-mono text-foreground">
                  {row.boe_fte.toFixed(1)}
                </td>
                <td className="px-3 py-3 text-right font-mono text-foreground">
                  {row.boe_annual_hours.toLocaleString()}
                </td>
                <td className="px-3 py-3 text-right font-mono text-foreground">
                  {formatCurrency(row.bls_median_hourly)}
                </td>
                <td className="px-3 py-3 text-right font-mono text-foreground">
                  {row.gsa_benchmark_low != null && row.gsa_benchmark_high != null
                    ? `${formatCurrency(row.gsa_benchmark_low)} – ${formatCurrency(row.gsa_benchmark_high)}`
                    : "N/A"}
                </td>
                <td className="px-3 py-3 text-right font-mono text-foreground">
                  {formatCurrency(row.gov_estimate_rate)}
                </td>
                <td className="px-3 py-3 text-right font-mono text-foreground">
                  {formatCurrency(row.recommended_low)}
                </td>
                <td
                  className={cn(
                    "bg-blue-50 px-3 py-3 text-right font-mono",
                    targetRateCellClass(row.recommended_target, row.bls_median_hourly)
                  )}
                >
                  {formatCurrency(row.recommended_target)}
                </td>
                <td className="px-3 py-3 text-right font-mono text-foreground">
                  {formatCurrency(row.recommended_high)}
                </td>
                <td className="px-3 py-3 text-right">
                  <RateConfidenceBadge level={row.rate_confidence} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// Cost Range Summary
// ============================================================

function CostRangeSummary({ analysis }: { analysis: P2wAnalysis }) {
  const { total_cost_low, total_cost_target, total_cost_high, igce_value } = analysis;

  const igcePct =
    igce_value && total_cost_target
      ? ((total_cost_target - igce_value) / igce_value) * 100
      : null;

  const igceColor =
    igcePct == null
      ? ""
      : Math.abs(igcePct) <= 15
      ? "text-green-700"
      : Math.abs(igcePct) <= 25
      ? "text-amber-700"
      : "text-red-700";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Low Estimate", value: formatMillions(total_cost_low) },
          { label: "Target Estimate", value: formatMillions(total_cost_target) },
          { label: "High Estimate", value: formatMillions(total_cost_high) },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-xl border border-border bg-card p-5 text-center"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <p className="mt-1.5 text-3xl font-bold text-foreground">{value}</p>
          </div>
        ))}
      </div>

      {igce_value && igcePct != null && (
        <div
          className={cn(
            "rounded-lg border px-4 py-3 text-sm font-medium",
            Math.abs(igcePct) <= 15
              ? "border-green-200 bg-green-50 text-green-800"
              : Math.abs(igcePct) <= 25
              ? "border-amber-200 bg-amber-50 text-amber-800"
              : "border-red-200 bg-red-50 text-red-800"
          )}
        >
          <span className="font-semibold">IGCE Comparison:</span> Our target estimate is{" "}
          <span className={cn("font-bold", igceColor)}>
            {Math.abs(igcePct).toFixed(1)}% {igcePct >= 0 ? "above" : "below"}
          </span>{" "}
          the Government&apos;s estimate of {formatMillions(igce_value)}.
        </div>
      )}
    </div>
  );
}

// ============================================================
// Data Source Legend
// ============================================================

function DataSourceLegend() {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
      <span className="font-semibold text-foreground">Data Sources:</span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
        BLS OES = Bureau of Labor Statistics national occupational data
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
        GSA eLibrary = GSA Schedule approved rates
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
        AI Estimated = Claude-reasoned estimate
      </span>
    </div>
  );
}

// ============================================================
// BOE Gate — shown when BOE is not completed
// ============================================================

function BoeDependencyGate() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-gray-50 px-8 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-gray-300 bg-white shadow-sm">
        <Lock className="h-7 w-7 text-gray-400" />
      </div>
      <h2 className="text-lg font-semibold text-gray-700">
        Complete BOE Assessment First
      </h2>
      <p className="mt-2 max-w-sm text-sm text-gray-500">
        The P2W analysis requires a completed Basis of Estimate. Generate and confirm the
        BOE in the BOE tab first.
      </p>
    </div>
  );
}

// ============================================================
// Main P2wView Component
// ============================================================

export function P2wView({ solicitationId, companyId }: P2wViewProps) {
  const [analysis, setAnalysis] = useState<P2wAnalysis | null>(null);
  const [boeStatus, setBoeStatus] = useState<
    "not_started" | "pending" | "generating" | "completed" | "failed"
  >("not_started");
  const [status, setStatus] = useState<
    "not_started" | "pending" | "generating" | "completed" | "failed"
  >("not_started");
  const [triggering, setTriggering] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch ──────────────────────────────────────────────────

  const fetchP2w = useCallback(async () => {
    try {
      const res = await fetch(`/api/solicitations/${solicitationId}/p2w`, {
        headers: { "X-Company-Id": companyId },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setFetchError(body?.error ?? "Failed to load P2W analysis.");
        return;
      }
      const data: P2wGetResponse = await res.json();
      setBoeStatus(data.boe_status);
      setStatus(data.status);
      setAnalysis(data.analysis);
    } catch {
      setFetchError("Network error loading P2W analysis.");
    }
  }, [solicitationId, companyId]);

  // ── Polling ────────────────────────────────────────────────

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPoll = useCallback(() => {
    stopPoll();
    pollRef.current = setInterval(async () => {
      const res = await fetch(`/api/solicitations/${solicitationId}/p2w`, {
        headers: { "X-Company-Id": companyId },
      });
      if (!res.ok) return;
      const data: P2wGetResponse = await res.json();
      setBoeStatus(data.boe_status);
      setStatus(data.status);
      setAnalysis(data.analysis);
      if (data.status === "completed" || data.status === "failed") {
        stopPoll();
      }
    }, 3000);
  }, [solicitationId, companyId, stopPoll]);

  // ── Mount ──────────────────────────────────────────────────

  useEffect(() => {
    fetchP2w().then(() => {});
    return () => stopPoll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (status === "generating" || status === "pending") {
      startPoll();
    } else {
      stopPoll();
    }
  }, [status, startPoll, stopPoll]);

  // ── Trigger ────────────────────────────────────────────────

  const handleGenerate = async () => {
    setTriggering(true);
    try {
      const res = await fetch(`/api/solicitations/${solicitationId}/p2w`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Company-Id": companyId,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setAnalysis(data.analysis);
        setStatus(data.analysis?.status ?? "generating");
      } else {
        const body = await res.json().catch(() => ({}));
        setFetchError(body?.error ?? "Failed to trigger P2W analysis.");
      }
    } catch {
      setFetchError("Network error triggering P2W analysis.");
    } finally {
      setTriggering(false);
    }
  };

  // ── Status Bar ─────────────────────────────────────────────

  const renderStatusBar = () => {
    if (status === "not_started" || status === "pending") {
      return (
        <div className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-semibold text-foreground">Price-to-Win Analysis</p>
              <p className="text-sm text-muted-foreground">
                Generate labor rate benchmarking and cost range estimates.
              </p>
            </div>
          </div>
          <button
            onClick={handleGenerate}
            disabled={triggering}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            {triggering ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <DollarSign className="h-4 w-4" />
            )}
            Generate P2W
          </button>
        </div>
      );
    }

    if (status === "generating") {
      return (
        <div className="flex items-center gap-4 rounded-xl border border-blue-200 bg-blue-50 px-5 py-4">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          <div>
            <p className="font-semibold text-blue-900">Generating P2W analysis...</p>
            <p className="text-sm text-blue-700">
              Benchmarking labor rates against BLS and GSA data. This typically takes 30–90
              seconds.
            </p>
          </div>
        </div>
      );
    }

    if (status === "completed") {
      return (
        <div className="flex items-center justify-between rounded-xl border border-green-200 bg-green-50 px-5 py-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <p className="font-semibold text-green-900">P2W Analysis Complete</p>
          </div>
          <button
            onClick={handleGenerate}
            disabled={triggering}
            className="inline-flex items-center gap-2 rounded-lg border border-green-300 bg-white px-3 py-1.5 text-xs font-medium text-green-800 hover:bg-green-50 disabled:opacity-60 transition-colors"
          >
            {triggering ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Regenerate
          </button>
        </div>
      );
    }

    if (status === "failed") {
      return (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-5 py-4">
          <div className="flex items-center gap-3">
            <XCircle className="h-5 w-5 text-red-600" />
            <div>
              <p className="font-semibold text-red-900">P2W Generation Failed</p>
              {analysis?.error_message && (
                <p className="text-sm text-red-700">{analysis.error_message}</p>
              )}
            </div>
          </div>
          <button
            onClick={handleGenerate}
            disabled={triggering}
            className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-800 hover:bg-red-50 disabled:opacity-60 transition-colors"
          >
            {triggering ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Retry
          </button>
        </div>
      );
    }

    return null;
  };

  // ── Render ─────────────────────────────────────────────────

  if (fetchError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <XCircle className="mx-auto mb-2 h-6 w-6 text-red-500" />
        <p className="text-sm font-medium text-red-700">{fetchError}</p>
      </div>
    );
  }

  // BOE dependency gate
  if (boeStatus !== "completed") {
    return <BoeDependencyGate />;
  }

  const isCompleted = status === "completed" && analysis != null;

  return (
    <div className="space-y-6">
      {/* Status bar */}
      {renderStatusBar()}

      {/* Rate Table */}
      {isCompleted && analysis.rate_table && analysis.rate_table.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-foreground">
              Labor Rate Benchmarking
            </h2>
            <DataSourceBadges rows={analysis.rate_table} />
          </div>
          <RateTable rows={analysis.rate_table} />
        </div>
      )}

      {/* Cost Range Summary */}
      {isCompleted && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">
            Total Contract Value Estimates
          </h2>
          <CostRangeSummary analysis={analysis} />
        </div>
      )}

      {/* Data Source Legend */}
      {isCompleted && <DataSourceLegend />}

      {/* Narrative — internal only */}
      {isCompleted && analysis.narrative_markdown && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">
            P2W Analysis (Internal Use Only)
          </h2>
          <div className="flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
            <p className="text-sm font-semibold text-red-800">
              INTERNAL ONLY — This analysis is for proposal team use only. Do not share
              with the government or include in any proposal submission.
            </p>
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="max-h-[400px] overflow-y-auto p-5">
              <pre className="whitespace-pre-wrap font-mono text-sm text-foreground">
                {analysis.narrative_markdown}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
