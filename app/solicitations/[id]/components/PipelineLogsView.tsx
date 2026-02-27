"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCompany } from "@/lib/context/CompanyContext";
import type {
  PipelineLog,
  PipelineSummary,
} from "@/lib/supabase/pipeline-log-types";
import { PIPELINE_STAGE_LABELS } from "@/lib/supabase/pipeline-log-types";

// ===== HELPERS =====

function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getStageLabel(stage: string): string {
  return PIPELINE_STAGE_LABELS[stage] || stage;
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  started: <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />,
  completed: <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />,
  failed: <XCircle className="h-3.5 w-3.5 text-red-500" />,
  warning: <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />,
};

const STATUS_BADGE_CLASSES: Record<string, string> = {
  started: "bg-blue-50 text-blue-700 border-blue-200",
  completed: "bg-green-50 text-green-700 border-green-200",
  failed: "bg-red-50 text-red-700 border-red-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
};

// ===== COMPONENT =====

interface PipelineLogsViewProps {
  solicitationId: string;
}

export function PipelineLogsView({ solicitationId }: PipelineLogsViewProps) {
  const { selectedCompanyId } = useCompany();

  const [logs, setLogs] = useState<PipelineLog[]>([]);
  const [summary, setSummary] = useState<PipelineSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedLogIds, setExpandedLogIds] = useState<Set<string>>(new Set());
  const [stageFilter, setStageFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLogs = useCallback(async () => {
    if (!selectedCompanyId) return;

    try {
      const headers = new Headers({ "X-Company-Id": selectedCompanyId });
      const params = new URLSearchParams();
      if (stageFilter) params.set("stage", stageFilter);
      if (statusFilter) params.set("status", statusFilter);
      params.set("limit", "500");

      const response = await fetch(
        `/api/solicitations/${solicitationId}/logs?${params.toString()}`,
        { headers }
      );

      if (!response.ok) {
        setError("Failed to fetch pipeline logs");
        return;
      }

      const data = await response.json();
      setLogs(data.logs || []);
      setSummary(data.summary || null);
      setError(null);

      // Stop auto-refresh if pipeline is complete (no in-progress stages)
      if (data.summary?.stages_in_progress?.length === 0 && data.summary?.total_events > 0) {
        setAutoRefresh(false);
      }
    } catch (err) {
      console.error("Fetch logs error:", err);
      setError("Network error loading pipeline logs");
    } finally {
      setLoading(false);
    }
  }, [solicitationId, selectedCompanyId, stageFilter, statusFilter]);

  // Initial fetch
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Auto-refresh
  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchLogs, 5000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, fetchLogs]);

  const toggleExpanded = (logId: string) => {
    setExpandedLogIds((prev) => {
      const next = new Set(prev);
      if (next.has(logId)) {
        next.delete(logId);
      } else {
        next.add(logId);
      }
      return next;
    });
  };

  const handleExport = () => {
    const blob = new Blob(
      [JSON.stringify({ logs, summary }, null, 2)],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pipeline-logs-${solicitationId.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Get unique stages for filter dropdown
  const uniqueStages = [...new Set(logs.map((l) => l.stage))].sort();

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <XCircle className="mx-auto mb-2 h-5 w-5 text-red-500" />
        <p className="text-sm text-red-700">{error}</p>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <Clock className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm font-medium text-foreground">No pipeline activity yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Upload documents to begin the extraction pipeline.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ===== Pipeline Overview ===== */}
      {summary && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4 text-sm">
              <span className="font-medium text-foreground">Pipeline Overview</span>
              <span className="text-xs text-muted-foreground">
                {summary.total_events} events
              </span>
              {summary.pipeline_duration_ms !== null && (
                <span className="text-xs text-muted-foreground">
                  Total: {formatDuration(summary.pipeline_duration_ms)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Status counts */}
              {Object.entries(summary.by_status).map(([status, count]) => (
                <span
                  key={status}
                  className={cn(
                    "flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
                    STATUS_BADGE_CLASSES[status] || "bg-gray-50 text-gray-600"
                  )}
                >
                  {STATUS_ICONS[status]}
                  {count}
                </span>
              ))}
            </div>
          </div>

          {/* Stage progress pills */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {Object.entries(summary.by_stage).map(([stage, info]) => (
              <span
                key={stage}
                className={cn(
                  "flex items-center gap-1 rounded-md border px-2 py-1 text-xs",
                  STATUS_BADGE_CLASSES[info.status] || "bg-gray-50 text-gray-600"
                )}
                title={`${getStageLabel(stage)}: ${info.status}${info.duration_ms ? ` (${formatDuration(info.duration_ms)})` : ""}`}
              >
                {STATUS_ICONS[info.status]}
                <span className="max-w-[120px] truncate">{getStageLabel(stage)}</span>
                {info.duration_ms !== null && (
                  <span className="text-[10px] opacity-70">
                    {formatDuration(info.duration_ms)}
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ===== Filters & Actions ===== */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-xs text-foreground"
        >
          <option value="">All Stages</option>
          {uniqueStages.map((s) => (
            <option key={s} value={s}>
              {getStageLabel(s)}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-xs text-foreground"
        >
          <option value="">All Statuses</option>
          <option value="started">Started</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="warning">Warning</option>
        </select>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={cn(
              "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
              autoRefresh
                ? "border-blue-200 bg-blue-50 text-blue-700"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            )}
          >
            <RefreshCw className={cn("h-3 w-3", autoRefresh && "animate-spin")} />
            {autoRefresh ? "Auto-refreshing" : "Auto-refresh off"}
          </button>

          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <Download className="h-3 w-3" />
            Export
          </button>
        </div>
      </div>

      {/* ===== Log Stream ===== */}
      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        {logs.map((log) => {
          const isExpanded = expandedLogIds.has(log.id);
          const hasMetadata = Object.keys(log.metadata || {}).length > 0;

          return (
            <div key={log.id} className="group">
              <button
                onClick={() => hasMetadata && toggleExpanded(log.id)}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm",
                  hasMetadata && "cursor-pointer hover:bg-muted/30",
                  !hasMetadata && "cursor-default"
                )}
              >
                {/* Expand chevron */}
                <span className="w-4 shrink-0">
                  {hasMetadata &&
                    (isExpanded ? (
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    ))}
                </span>

                {/* Status icon */}
                <span className="shrink-0">{STATUS_ICONS[log.status]}</span>

                {/* Timestamp */}
                <span className="shrink-0 w-[72px] text-xs text-muted-foreground font-mono">
                  {formatTimestamp(log.created_at)}
                </span>

                {/* Stage label */}
                <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                  {getStageLabel(log.stage)}
                </span>

                {/* Status badge */}
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                    STATUS_BADGE_CLASSES[log.status]
                  )}
                >
                  {log.status}
                </span>

                {/* Duration */}
                <span className="shrink-0 w-[60px] text-right text-xs text-muted-foreground">
                  {formatDuration(log.duration_ms)}
                </span>
              </button>

              {/* Expanded metadata */}
              {isExpanded && hasMetadata && (
                <div className="border-t border-border bg-muted/20 px-4 py-3">
                  {/* Error message */}
                  {log.error && (
                    <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                      <span className="font-medium">Error:</span> {log.error}
                    </div>
                  )}

                  {/* Metadata table */}
                  <div className="space-y-1.5">
                    {Object.entries(log.metadata).map(([key, value]) => (
                      <div key={key} className="flex gap-3 text-xs">
                        <span className="shrink-0 w-40 font-mono text-muted-foreground">
                          {key}:
                        </span>
                        <span className="min-w-0 flex-1 break-all font-mono text-foreground">
                          {typeof value === "object"
                            ? JSON.stringify(value, null, 2)
                            : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
