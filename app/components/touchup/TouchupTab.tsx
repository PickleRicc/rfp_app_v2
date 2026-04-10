"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Sparkles,
  FileBarChart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  TouchupGetResponse,
  TouchupVolume,
  TouchupVolumeStatus,
  DraftVolumeForTouchup,
} from "@/lib/supabase/touchup-types";
import {
  TOUCHUP_VOLUME_STATUS_LABELS,
  TOUCHUP_VOLUME_STATUS_COLORS,
} from "@/lib/supabase/touchup-types";
import { VolumeScoreCard } from "./VolumeScoreCard";

// ============================================================
// Types
// ============================================================

interface TouchupTabProps {
  solicitationId: string;
  companyId: string;
}

// ============================================================
// Volume Status Badge (used in the volume selector below)
// ============================================================

function StatusBadge({ status }: { status: TouchupVolumeStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        TOUCHUP_VOLUME_STATUS_COLORS[status]
      )}
    >
      {status === "scoring" || status === "rewriting" ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : status === "completed" ? (
        <CheckCircle className="h-3 w-3" />
      ) : status === "failed" ? (
        <XCircle className="h-3 w-3" />
      ) : null}
      {TOUCHUP_VOLUME_STATUS_LABELS[status]}
    </span>
  );
}

// ============================================================
// Gaps Banner — shows total gaps + rewrite progress
// ============================================================

function GapsBanner({ totalGaps, analyzedCount, rewrittenCount, totalCount }: {
  totalGaps: number;
  analyzedCount: number;
  rewrittenCount: number;
  totalCount: number;
}) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
        <div className="text-2xl font-bold text-gray-900">{totalGaps}</div>
        <div className="text-xs text-gray-500">Total Gaps</div>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
        <div className="text-2xl font-bold text-gray-900">{analyzedCount}/{totalCount}</div>
        <div className="text-xs text-gray-500">Analyzed</div>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
        <div className="text-2xl font-bold text-gray-900">{rewrittenCount}/{totalCount}</div>
        <div className="text-xs text-gray-500">Rewritten</div>
      </div>
    </div>
  );
}

// ============================================================
// Main Component
// ============================================================

export function TouchupTab({ solicitationId, companyId }: TouchupTabProps) {
  const [loading, setLoading] = useState(true);
  const [draftReady, setDraftReady] = useState(false);
  const [draftVolumes, setDraftVolumes] = useState<DraftVolumeForTouchup[]>([]);
  const [touchupVolumes, setTouchupVolumes] = useState<TouchupVolume[]>([]);
  const [totalGaps, setTotalGaps] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [analyzing, setAnalyzing] = useState(false);
  const [rewritingId, setRewritingId] = useState<string | null>(null);
  const [generatingMatrix, setGeneratingMatrix] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/solicitations/${solicitationId}/touchup`,
        { headers: { "X-Company-Id": companyId } }
      );
      if (!res.ok) return;
      const data: TouchupGetResponse = await res.json();

      setDraftReady(data.draftReady);
      setDraftVolumes(data.draftVolumes);
      setTouchupVolumes(data.volumes.filter(v => v.volume_order !== 999));
      setTotalGaps(data.aggregates?.total_gaps ?? 0);
    } catch {
      // Non-fatal
    }
  }, [solicitationId, companyId]);

  const needsPolling = touchupVolumes.some(
    v => v.status === "scoring" || v.status === "rewriting"
  );

  useEffect(() => {
    fetchData().then(() => setLoading(false));
  }, [fetchData]);

  useEffect(() => {
    if (needsPolling && !pollingRef.current) {
      pollingRef.current = setInterval(fetchData, 3000);
    }
    if (!needsPolling && pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [needsPolling, fetchData]);

  const toggleVolume = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(draftVolumes.map(v => v.id)));
  };

  const handleAnalyze = async () => {
    if (selectedIds.size === 0) return;
    setAnalyzing(true);
    try {
      const res = await fetch(
        `/api/solicitations/${solicitationId}/touchup`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Company-Id": companyId },
          body: JSON.stringify({ action: "score", volumeIds: Array.from(selectedIds) }),
        }
      );
      if (res.ok) {
        await fetchData();
      }
    } catch {
      // Non-fatal
    } finally {
      setAnalyzing(false);
    }
  };

  const handleRewrite = async (touchupVolumeId: string) => {
    setRewritingId(touchupVolumeId);
    try {
      const res = await fetch(
        `/api/solicitations/${solicitationId}/touchup`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Company-Id": companyId },
          body: JSON.stringify({ action: "rewrite", touchupVolumeId }),
        }
      );
      if (res.ok) {
        await fetchData();
      }
    } catch {
      // Non-fatal
    } finally {
      setRewritingId(null);
    }
  };

  const handleGenerateMatrix = async () => {
    setGeneratingMatrix(true);
    try {
      await fetch(
        `/api/solicitations/${solicitationId}/touchup`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Company-Id": companyId },
          body: JSON.stringify({ action: "generate-matrix" }),
        }
      );
      await fetchData();
    } catch {
      // Non-fatal
    } finally {
      setGeneratingMatrix(false);
    }
  };

  // ─── Loading ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        <span className="ml-2 text-sm text-gray-500">Loading touchup data...</span>
      </div>
    );
  }

  // ─── Draft not ready ───────────────────────────────────────────────────
  if (!draftReady) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center">
        <AlertCircle className="mx-auto h-8 w-8 text-amber-500 mb-3" />
        <h3 className="text-lg font-semibold text-amber-800">Draft Not Ready</h3>
        <p className="text-sm text-amber-700 mt-1">
          Complete your draft generation in the Draft tab before running touchup analysis.
        </p>
      </div>
    );
  }

  const hasAnalyzedOrCompleted = touchupVolumes.some(
    v => v.status === "scored" || v.status === "completed"
  );

  const analyzedCount = touchupVolumes.filter(
    v => v.status === "scored" || v.status === "completed"
  ).length;

  const rewrittenCount = touchupVolumes.filter(v => v.status === "completed").length;

  // ─── Main UI ───────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-gray-900">
            <Sparkles className="h-5 w-5 text-purple-600" />
            Touchup Analysis
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Identify gaps and items to edit in each volume, then rewrite to address them.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchData}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {/* Gaps summary (when we have data) */}
      {analyzedCount > 0 && (
        <GapsBanner
          totalGaps={totalGaps}
          analyzedCount={analyzedCount}
          rewrittenCount={rewrittenCount}
          totalCount={touchupVolumes.length}
        />
      )}

      {/* Volume Selector */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-800">Select Volumes to Analyze</h3>
          <button
            type="button"
            onClick={selectAll}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            Select All
          </button>
        </div>

        <div className="space-y-2 mb-4">
          {draftVolumes.map(dv => {
            const tv = touchupVolumes.find(v => v.original_volume_id === dv.id);
            return (
              <label
                key={dv.id}
                className={cn(
                  "flex items-center gap-3 rounded-lg border px-3 py-2 cursor-pointer transition-colors",
                  selectedIds.has(dv.id)
                    ? "border-blue-300 bg-blue-50"
                    : "border-gray-200 bg-gray-50 hover:bg-gray-100"
                )}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(dv.id)}
                  onChange={() => toggleVolume(dv.id)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="flex-1 text-sm text-gray-800">{dv.volume_name}</span>
                {dv.page_limit && (
                  <span className="text-xs text-gray-500">{dv.page_limit}p limit</span>
                )}
                {tv && <StatusBadge status={tv.status} />}
              </label>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={selectedIds.size === 0 || analyzing}
            className={cn(
              "flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors",
              selectedIds.size === 0 || analyzing
                ? "cursor-not-allowed bg-purple-100 text-purple-400 border border-purple-200"
                : "bg-purple-600 text-white hover:bg-purple-700"
            )}
          >
            {analyzing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {analyzing ? "Starting..." : `Analyze ${selectedIds.size} Volume(s)`}
          </button>
        </div>
      </div>

      {/* Volume Cards */}
      {touchupVolumes.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-800">Volume Results</h3>
          {touchupVolumes.map(vol => (
            <VolumeScoreCard
              key={vol.id}
              volume={vol}
              solicitationId={solicitationId}
              companyId={companyId}
              onRewrite={handleRewrite}
              rewritingId={rewritingId}
            />
          ))}
        </div>
      )}

      {/* Generate Compliance Matrix */}
      {hasAnalyzedOrCompleted && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleGenerateMatrix}
            disabled={generatingMatrix}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
              generatingMatrix
                ? "cursor-not-allowed bg-gray-100 text-gray-400"
                : "bg-gray-800 text-white hover:bg-gray-900"
            )}
          >
            {generatingMatrix ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileBarChart className="h-4 w-4" />
            )}
            {generatingMatrix ? "Generating..." : "Generate Compliance Matrix"}
          </button>
        </div>
      )}
    </div>
  );
}
