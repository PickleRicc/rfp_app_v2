"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Download,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StrategyBuilder, type GraphicsProfile } from "./StrategyBuilder";
import { DiagramPreview } from "./DiagramPreview";
import type {
  DraftGetResponse,
  DraftVolume,
  VolumeStatus,
} from "@/lib/supabase/draft-types";

// ============================================================
// Types
// ============================================================

export interface DraftGenerationViewProps {
  solicitationId: string;
  companyId: string;
  onTabChange?: (tabId: string) => void;
}

type ViewState = "strategy" | "generating" | "complete";

// ============================================================
// Page info (plain text — no color coding)
// ============================================================

function PageInfo({
  pageEstimate,
  pageLimit,
  wordCount,
}: {
  pageEstimate: number | null;
  pageLimit: number | null;
  wordCount: number | null;
}) {
  if (pageEstimate == null && wordCount == null) return null;

  const pageText =
    pageEstimate != null && pageLimit != null
      ? `${pageEstimate} / ${pageLimit} pages`
      : pageEstimate != null
      ? `${pageEstimate} page${pageEstimate !== 1 ? "s" : ""}`
      : null;

  return (
    <p className="text-xs text-muted-foreground">
      {pageText}
      {wordCount != null ? `${pageText ? " · " : ""}${wordCount.toLocaleString()} words` : ""}
    </p>
  );
}

// ============================================================
// Simple markdown renderer (no external library)
// Handles: headings (###), bold (**text**), newlines
// ============================================================

function SimpleMarkdown({ content }: { content: string }) {
  const lines = content.split("\n");

  return (
    <div className="space-y-1.5 text-sm text-foreground">
      {lines.map((line, i) => {
        // H3
        if (line.startsWith("### ")) {
          return (
            <h4 key={i} className="mt-3 text-sm font-bold text-foreground first:mt-0">
              {renderInline(line.slice(4))}
            </h4>
          );
        }
        // H2
        if (line.startsWith("## ")) {
          return (
            <h3 key={i} className="mt-4 text-base font-bold text-foreground first:mt-0">
              {renderInline(line.slice(3))}
            </h3>
          );
        }
        // H1
        if (line.startsWith("# ")) {
          return (
            <h2 key={i} className="mt-4 text-lg font-bold text-foreground first:mt-0">
              {renderInline(line.slice(2))}
            </h2>
          );
        }
        // Bullet
        if (line.startsWith("- ") || line.startsWith("* ")) {
          return (
            <li key={i} className="ml-4 list-disc text-sm text-foreground">
              {renderInline(line.slice(2))}
            </li>
          );
        }
        // Markdown table row — render as plain text with pipe spacing
        if (line.startsWith("|")) {
          const cells = line.split("|").filter((c) => c.trim() !== "");
          // Skip separator rows like |---|---|
          if (cells.every((c) => /^[-: ]+$/.test(c))) return null;
          return (
            <div key={i} className="flex gap-4 text-sm">
              {cells.map((cell, j) => (
                <span key={j} className={j === 0 ? "font-medium" : "text-muted-foreground"}>
                  {renderInline(cell.trim())}
                </span>
              ))}
            </div>
          );
        }
        // Empty line
        if (line.trim() === "") {
          return <div key={i} className="h-2" />;
        }
        // Regular paragraph
        return (
          <p key={i} className="text-sm leading-relaxed">
            {renderInline(line)}
          </p>
        );
      })}
    </div>
  );
}

/**
 * Render inline bold (**text**) and italic (*text*) inside a line.
 */
function renderInline(text: string): React.ReactNode {
  // Split on bold markers (**text**)
  const boldParts = text.split(/\*\*(.*?)\*\*/g);
  return boldParts.map((part, i) =>
    i % 2 === 1 ? <strong key={i}>{part}</strong> : part
  );
}

// ============================================================
// Volume status icon
// ============================================================

function VolumeStatusIcon({ status }: { status: VolumeStatus }) {
  switch (status) {
    case "completed":
      return <CheckCircle className="h-4 w-4 flex-shrink-0 text-green-500" />;
    case "failed":
      return <XCircle className="h-4 w-4 flex-shrink-0 text-red-500" />;
    case "generating":
      return <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-blue-500" />;
    case "pending":
    default:
      return <Clock className="h-4 w-4 flex-shrink-0 text-gray-400" />;
  }
}

// ============================================================
// Volume card (complete view)
// ============================================================

function VolumeCard({
  volume,
  solicitationId,
  companyId,
}: {
  volume: DraftVolume;
  solicitationId: string;
  companyId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await fetch(
        `/api/solicitations/${solicitationId}/draft/volumes/${volume.id}`,
        { headers: { "X-Company-Id": companyId } }
      );
      if (!res.ok) {
        const errBody = await res.text();
        console.error("Download API error:", res.status, errBody);
        throw new Error(`Download failed: ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const safeName = (volume.volume_name as string)
        .replace(/[^a-zA-Z0-9 _\-]/g, "")
        .trim()
        .replace(/\s+/g, "_");
      a.href = url;
      a.download = `${safeName}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("DOCX download error:", err);
    } finally {
      setDownloading(false);
    }
  };

  if (volume.status === "failed") {
    return (
      <div className="overflow-hidden rounded-xl border border-red-200 bg-red-50 shadow-sm">
        <div className="flex items-center gap-3 px-5 py-4">
          <XCircle className="h-5 w-5 flex-shrink-0 text-red-500" />
          <div className="flex-1">
            <p className="font-semibold text-red-800">{volume.volume_name}</p>
            {volume.error_message && (
              <p className="mt-0.5 text-xs text-red-700">{volume.error_message}</p>
            )}
          </div>
          <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700 border border-red-200">
            Failed
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {/* Card header */}
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <h4 className="font-semibold text-foreground">{volume.volume_name}</h4>
          <button
            onClick={handleDownload}
            disabled={downloading || !volume.file_path}
            title={!volume.file_path ? "DOCX not available — use in-app preview" : undefined}
            className="flex flex-shrink-0 items-center gap-1.5 rounded-md border border-border bg-muted/50 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="h-3.5 w-3.5" />
            {downloading ? "Downloading..." : !volume.file_path ? "DOCX Unavailable" : "Download DOCX"}
          </button>
        </div>

        {/* Page info */}
        {(volume.page_estimate != null || volume.word_count != null) && (
          <div className="mt-3">
            <PageInfo
              pageEstimate={volume.page_estimate}
              pageLimit={volume.page_limit}
              wordCount={volume.word_count}
            />
          </div>
        )}

        {/* Preview toggle */}
        {volume.content_markdown && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-3 flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3.5 w-3.5" />
                Hide Preview
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                Preview
              </>
            )}
          </button>
        )}
      </div>

      {/* Expandable preview */}
      {expanded && volume.content_markdown && (
        <div className="border-t border-border bg-muted/20 px-5 py-4">
          <div className="max-h-[600px] overflow-y-auto">
            <SimpleMarkdown content={volume.content_markdown} />
            {volume.diagram_specs && volume.diagram_specs.length > 0 && (
              <DiagramPreview specs={volume.diagram_specs} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Compliance matrix section
// ============================================================

function ComplianceMatrixSection({ content }: { content: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="border-b border-border bg-muted/30 px-5 py-3.5">
        <h3 className="text-sm font-semibold text-foreground">
          Compliance Matrix — Evaluation Factor Coverage
        </h3>
      </div>
      <div className="overflow-x-auto px-5 py-4">
        <SimpleMarkdown content={content} />
      </div>
    </div>
  );
}

// ============================================================
// Generating view
// ============================================================

function GeneratingView({ volumes }: { volumes: DraftVolume[] }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
        <h2 className="text-lg font-bold text-foreground">Generating Draft...</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Your proposal volumes are being generated one by one. This may take a
        few minutes per volume.
      </p>

      {/* Volume checklist */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="divide-y divide-border">
          {volumes.map((vol) => (
            <div key={vol.id} className="flex items-center gap-3 px-5 py-3.5">
              <VolumeStatusIcon status={vol.status} />
              <span className="flex-1 text-sm font-medium text-foreground">
                {vol.volume_name}
              </span>
              <span
                className={cn(
                  "text-xs",
                  vol.status === "completed" && "text-green-600",
                  vol.status === "failed" && "text-red-600",
                  vol.status === "generating" && "text-blue-600",
                  vol.status === "pending" && "text-muted-foreground"
                )}
              >
                {vol.status === "completed" && "Complete"}
                {vol.status === "failed" && "Failed"}
                {vol.status === "generating" && "Generating..."}
                {vol.status === "pending" && "Waiting"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Complete view
// ============================================================

function CompleteView({
  volumes,
  solicitationId,
  companyId,
  onRegenerate,
}: {
  volumes: DraftVolume[];
  solicitationId: string;
  companyId: string;
  onRegenerate: () => void;
}) {
  const contentVolumes = volumes.filter(
    (v) => v.volume_name !== "Compliance Matrix"
  );
  const complianceVolume = volumes.find(
    (v) => v.volume_name === "Compliance Matrix"
  );

  const completedCount = volumes.filter((v) => v.status === "completed").length;
  const failedCount = volumes.filter((v) => v.status === "failed").length;
  const totalWordCount = volumes.reduce((sum, v) => sum + (v.word_count ?? 0), 0);

  const allSucceeded = failedCount === 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        {allSucceeded ? (
          <CheckCircle className="h-5 w-5 text-green-500" />
        ) : (
          <AlertCircle className="h-5 w-5 text-amber-500" />
        )}
        <h2 className="text-lg font-bold text-foreground">
          {allSucceeded
            ? "Draft Generated"
            : "Draft Generation Complete (with issues)"}
        </h2>
      </div>

      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card px-5 py-3 shadow-sm">
        <div className="text-sm">
          <span className="font-semibold text-green-700">{completedCount}</span>
          <span className="ml-1 text-muted-foreground">
            volume{completedCount !== 1 ? "s" : ""} completed
          </span>
        </div>
        {failedCount > 0 && (
          <div className="text-sm">
            <span className="font-semibold text-red-600">{failedCount}</span>
            <span className="ml-1 text-muted-foreground">failed</span>
          </div>
        )}
        {totalWordCount > 0 && (
          <div className="text-sm text-muted-foreground">
            {totalWordCount.toLocaleString()} total words
          </div>
        )}
      </div>

      {/* Volume cards */}
      <div className="space-y-3">
        {contentVolumes.map((vol) => (
          <VolumeCard
            key={vol.id}
            volume={vol}
            solicitationId={solicitationId}
            companyId={companyId}
          />
        ))}
      </div>

      {/* Compliance matrix */}
      {complianceVolume?.content_markdown && (
        <ComplianceMatrixSection content={complianceVolume.content_markdown} />
      )}

      {/* Action buttons */}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onRegenerate}
          className="flex items-center gap-2 rounded-lg border border-border bg-muted px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted/80"
        >
          <RotateCcw className="h-4 w-4" />
          Edit Strategy & Regenerate
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Main DraftGenerationView component
// ============================================================

export function DraftGenerationView({
  solicitationId,
  companyId,
  onTabChange,
}: DraftGenerationViewProps) {
  const [view, setView] = useState<ViewState>("strategy");
  const [volumes, setVolumes] = useState<DraftVolume[]>([]);
  const [lastGraphicsProfile, setLastGraphicsProfile] = useState<GraphicsProfile>("minimal");
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ============================================================
  // Initial load — determine starting view from draft status
  // ============================================================

  const initializeView = useCallback(async () => {
    try {
      const res = await fetch(`/api/solicitations/${solicitationId}/draft`, {
        headers: { "X-Company-Id": companyId },
      });
      if (!res.ok) return;
      const data: DraftGetResponse = await res.json();

      if (!data.draft) {
        setView("strategy");
        return;
      }

      if (data.draft.status === "generating" || data.draft.status === "pending") {
        setVolumes(data.volumes);
        setView("generating");
        startPolling();
        return;
      }

      if (data.draft.status === "completed" || data.draft.status === "failed") {
        setVolumes(data.volumes);
        setView("complete");
      }
    } catch {
      // Non-fatal — default to strategy view
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solicitationId, companyId]);

  useEffect(() => {
    initializeView();
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [initializeView]);

  // ============================================================
  // Polling
  // ============================================================

  const startPolling = useCallback(() => {
    if (pollingRef.current) clearInterval(pollingRef.current);

    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/solicitations/${solicitationId}/draft`, {
          headers: { "X-Company-Id": companyId },
        });
        if (!res.ok) return;
        const data: DraftGetResponse = await res.json();

        setVolumes(data.volumes);

        // Stop polling when terminal state reached
        if (
          data.draft?.status === "completed" ||
          data.draft?.status === "failed"
        ) {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          setView("complete");
        }
      } catch {
        // Non-fatal — keep polling
      }
    }, 3000);
  }, [solicitationId, companyId]);

  // ============================================================
  // Transition handlers
  // ============================================================

  const handleGenerationStarted = useCallback((graphicsProfile: GraphicsProfile) => {
    setLastGraphicsProfile(graphicsProfile);
    // After POST succeeds, reset volumes and start polling
    setVolumes([]);
    setView("generating");
    startPolling();
    // Immediately fetch to get the fresh volume list
    fetch(`/api/solicitations/${solicitationId}/draft`, {
      headers: { "X-Company-Id": companyId },
    })
      .then((r) => r.json())
      .then((data: DraftGetResponse) => {
        setVolumes(data.volumes);
      })
      .catch(() => {});
  }, [solicitationId, companyId, startPolling]);

  const handleRegenerate = useCallback(() => {
    // Go back to strategy view so user can edit strategy, diagrams, etc. before regenerating
    setView("strategy");
  }, []);

  // ============================================================
  // Render
  // ============================================================

  if (view === "strategy") {
    return (
      <StrategyBuilder
        solicitationId={solicitationId}
        companyId={companyId}
        onGenerationStarted={handleGenerationStarted}
        onTabChange={onTabChange}
      />
    );
  }

  if (view === "generating") {
    return (
      <div className="space-y-4">
        <GeneratingView volumes={volumes} />

        {/* Retry option if polling stalled */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => {
              if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
              }
              initializeView();
            }}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground underline transition-colors"
          >
            <RefreshCw className="h-3 w-3" />
            Refresh status
          </button>
        </div>
      </div>
    );
  }

  // complete view (draft)
  return (
    <CompleteView
      volumes={volumes}
      solicitationId={solicitationId}
      companyId={companyId}
      onRegenerate={handleRegenerate}
    />
  );
}
