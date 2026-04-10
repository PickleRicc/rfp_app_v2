"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Loader2,
  CheckCircle,
  XCircle,
  RefreshCw,
  Users,
  AlertTriangle,
  Clock,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  BoeAssessment,
  BoeGetResponse,
  BoeTableRow,
  GovStaffingComparison,
  ParsedPerformancePeriod,
} from "@/lib/supabase/boe-types";

// ============================================================
// Props
// ============================================================

export interface BoeViewProps {
  solicitationId: string;
  companyId: string;
}

// ============================================================
// Confidence Badge
// ============================================================

function ConfidenceBadge({ level }: { level: "high" | "medium" | "low" }) {
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
// Gov Comparison Status Badge
// ============================================================

function ComparisonStatusBadge({
  row,
}: {
  row: GovStaffingComparison;
}) {
  if (row.gov_fte === null) {
    return (
      <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
        Not in Gov Table
      </span>
    );
  }
  const absDelta = Math.abs(row.delta_pct);
  if (absDelta <= 15) {
    return (
      <span className="inline-flex items-center rounded-full border border-green-200 bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
        Agrees
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-red-200 bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
      Diverges
    </span>
  );
}

// ============================================================
// Performance Period Card Row
// ============================================================

function PerformancePeriods({
  periods,
}: {
  periods: ParsedPerformancePeriod[];
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {periods.map((p, i) => (
        <div
          key={i}
          className="rounded-lg border border-border bg-card px-4 py-3 text-sm"
        >
          <p className="font-semibold text-foreground">{p.label}</p>
          <p className="mt-0.5 text-muted-foreground">
            {p.duration_months} months &bull; {p.annual_hours.toLocaleString()} hrs/FTE
          </p>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Summary Stat Card
// ============================================================

function StatCard({
  label,
  value,
  warning,
}: {
  label: string;
  value: React.ReactNode;
  warning?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-5",
        warning ? "border-red-300 bg-red-50" : "border-border"
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-1.5 text-2xl font-bold",
          warning ? "text-red-700" : "text-foreground"
        )}
      >
        {value}
      </p>
    </div>
  );
}

// ============================================================
// BOE Table (sortable by FTE)
// ============================================================

function BoeTable({ rows }: { rows: BoeTableRow[] }) {
  const [sortDesc, setSortDesc] = useState(true);

  const sorted = [...rows].sort((a, b) =>
    sortDesc ? b.fte_count - a.fte_count : a.fte_count - b.fte_count
  );

  const totalFte = rows.reduce((s, r) => s + r.fte_count, 0);
  const totalHours = rows.reduce((s, r) => s + r.total_annual_hours, 0);

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Task Area
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Labor Category
              </th>
              <th
                className="cursor-pointer select-none px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
                onClick={() => setSortDesc((d) => !d)}
              >
                FTE {sortDesc ? "▼" : "▲"}
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Annual Hours
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                SOW References
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Confidence
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Rationale
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr
                key={i}
                className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
              >
                <td className="px-4 py-3 font-medium text-foreground">
                  <div className="text-xs text-muted-foreground">{row.task_area_code}</div>
                  <div>{row.task_area_name}</div>
                </td>
                <td className="px-4 py-3 text-foreground">{row.labor_category}</td>
                <td className="px-4 py-3 text-right font-mono text-foreground">
                  {row.fte_count.toFixed(1)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-foreground">
                  {row.total_annual_hours.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {row.sow_paragraph_refs.join(", ") || "—"}
                </td>
                <td className="px-4 py-3">
                  <ConfidenceBadge level={row.confidence} />
                </td>
                <td className="max-w-xs px-4 py-3 text-sm text-muted-foreground">
                  {row.rationale}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border bg-muted/40 font-semibold">
              <td colSpan={2} className="px-4 py-3 text-sm text-foreground">
                Total
              </td>
              <td className="px-4 py-3 text-right font-mono text-foreground">
                {totalFte.toFixed(1)}
              </td>
              <td className="px-4 py-3 text-right font-mono text-foreground">
                {totalHours.toLocaleString()}
              </td>
              <td colSpan={3} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// Government Comparison Table
// ============================================================

function GovComparisonTable({ rows }: { rows: GovStaffingComparison[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Labor Category
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Gov FTE
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Proposed FTE
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Delta
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Delta %
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
              >
                <td className="px-4 py-3 font-medium text-foreground">
                  {row.labor_category}
                </td>
                <td className="px-4 py-3 text-right font-mono text-foreground">
                  {row.gov_fte != null ? row.gov_fte.toFixed(1) : "—"}
                </td>
                <td className="px-4 py-3 text-right font-mono text-foreground">
                  {row.proposed_fte.toFixed(1)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-foreground">
                  {row.gov_fte != null
                    ? (row.delta >= 0 ? "+" : "") + row.delta.toFixed(1)
                    : "—"}
                </td>
                <td className="px-4 py-3 text-right font-mono text-foreground">
                  {row.gov_fte != null
                    ? (row.delta_pct >= 0 ? "+" : "") +
                      row.delta_pct.toFixed(1) +
                      "%"
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  <ComparisonStatusBadge row={row} />
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
// Main BoeView Component
// ============================================================

export function BoeView({ solicitationId, companyId }: BoeViewProps) {
  const [assessment, setAssessment] = useState<BoeAssessment | null>(null);
  const [status, setStatus] = useState<
    "not_started" | "pending" | "generating" | "completed" | "failed"
  >("not_started");
  const [triggering, setTriggering] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch ──────────────────────────────────────────────────

  const fetchBoe = useCallback(async () => {
    try {
      const res = await fetch(`/api/solicitations/${solicitationId}/boe`, {
        headers: { "X-Company-Id": companyId },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setFetchError(body?.error ?? "Failed to load BOE assessment.");
        return;
      }
      const data: BoeGetResponse = await res.json();
      setStatus(data.status);
      setAssessment(data.assessment);
    } catch {
      setFetchError("Network error loading BOE assessment.");
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
      const res = await fetch(`/api/solicitations/${solicitationId}/boe`, {
        headers: { "X-Company-Id": companyId },
      });
      if (!res.ok) return;
      const data: BoeGetResponse = await res.json();
      setStatus(data.status);
      setAssessment(data.assessment);
      if (data.status === "completed" || data.status === "failed") {
        stopPoll();
      }
    }, 3000);
  }, [solicitationId, companyId, stopPoll]);

  // ── Mount ──────────────────────────────────────────────────

  useEffect(() => {
    fetchBoe().then(() => {});
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

  // ── Trigger generation ─────────────────────────────────────

  const handleGenerate = async () => {
    setTriggering(true);
    try {
      const res = await fetch(`/api/solicitations/${solicitationId}/boe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Company-Id": companyId,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setAssessment(data.assessment);
        setStatus(data.assessment?.status ?? "generating");
      } else {
        const body = await res.json().catch(() => ({}));
        setFetchError(body?.error ?? "Failed to trigger BOE generation.");
      }
    } catch {
      setFetchError("Network error triggering BOE generation.");
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
              <p className="font-semibold text-foreground">BOE Assessment</p>
              <p className="text-sm text-muted-foreground">
                Generate an independent staffing estimate for this solicitation.
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
              <Users className="h-4 w-4" />
            )}
            Generate BOE
          </button>
        </div>
      );
    }

    if (status === "generating") {
      return (
        <div className="flex items-center gap-4 rounded-xl border border-blue-200 bg-blue-50 px-5 py-4">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          <div>
            <p className="font-semibold text-blue-900">Generating BOE assessment...</p>
            <p className="text-sm text-blue-700">
              Analyzing SOW requirements, extracting staffing signals, and building labor
              estimates. This typically takes 30–90 seconds.
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
            <p className="font-semibold text-green-900">BOE Complete</p>
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
              <p className="font-semibold text-red-900">BOE Generation Failed</p>
              {assessment?.error_message && (
                <p className="text-sm text-red-700">{assessment.error_message}</p>
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

  const isCompleted = status === "completed" && assessment != null;

  return (
    <div className="space-y-6">
      {/* Status bar */}
      {renderStatusBar()}

      {/* Summary stats */}
      {isCompleted && (
        <div className="grid grid-cols-3 gap-4">
          <StatCard
            label="Total FTE Proposed"
            value={assessment.total_fte_proposed?.toFixed(1) ?? "—"}
          />
          <StatCard
            label="Total Annual Hours"
            value={
              assessment.boe_table
                ? assessment.boe_table
                    .reduce((s, r) => s + r.total_annual_hours, 0)
                    .toLocaleString()
                : "—"
            }
          />
          <StatCard
            label="Variance Flag"
            value={
              assessment.variance_flag ? (
                <span className="flex items-center gap-1.5">
                  <AlertTriangle className="h-5 w-5" />
                  Flagged
                </span>
              ) : (
                "None"
              )
            }
            warning={assessment.variance_flag}
          />
        </div>
      )}

      {/* Performance periods */}
      {isCompleted && assessment.performance_periods && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">
            Performance Periods
          </h2>
          <PerformancePeriods periods={assessment.performance_periods} />
        </div>
      )}

      {/* BOE Table */}
      {isCompleted && assessment.boe_table && assessment.boe_table.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">
            Independent Staffing Assessment
          </h2>
          <BoeTable rows={assessment.boe_table} />
        </div>
      )}

      {/* Government Comparison */}
      {isCompleted && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">
            Government Staffing Table Comparison
          </h2>
          {assessment.government_comparison &&
          assessment.government_comparison.length > 0 ? (
            <>
              <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
                <p className="text-sm text-amber-800">
                  A government-provided staffing table was found in the solicitation. Our
                  independent analysis is shown below.
                </p>
              </div>
              <GovComparisonTable rows={assessment.government_comparison} />
            </>
          ) : (
            <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
              <FileText className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-500" />
              <p className="text-sm text-gray-600">
                No government staffing table found — this is a fully independent estimate.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Narrative */}
      {isCompleted && assessment.narrative_markdown && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">
            BOE Narrative (Draft Proposal Language)
          </h2>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div
              className="max-h-[400px] overflow-y-auto p-5"
              style={{ maxHeight: "400px" }}
            >
              <pre className="whitespace-pre-wrap font-mono text-sm text-foreground">
                {assessment.narrative_markdown}
              </pre>
            </div>
            <div className="border-t border-border bg-muted/30 px-5 py-2">
              <p className="text-xs text-muted-foreground">
                This narrative will be included in the Cost/Price volume of the proposal.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
