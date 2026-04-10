"use client";

import { useState } from "react";
import {
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Download,
  ChevronDown,
  ChevronUp,
  Pencil,
  History,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  TouchupVolume,
  TouchupVolumeStatus,
  TouchupVolumeVersion,
  ComplianceTier,
} from "@/lib/supabase/touchup-types";
import {
  TOUCHUP_VOLUME_STATUS_LABELS,
  TOUCHUP_VOLUME_STATUS_COLORS,
  COMPLIANCE_TIER_LABELS,
  COMPLIANCE_TIER_COLORS,
} from "@/lib/supabase/touchup-types";
import { GapAnalysisSection } from "./GapAnalysisSection";

// ── Status Badge ─────────────────────────────────────────────

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

// ── Severity Badge ───────────────────────────────────────────

function SeverityBadge({ tier }: { tier: ComplianceTier }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        COMPLIANCE_TIER_COLORS[tier]
      )}
    >
      {tier === "fatal" && <AlertCircle className="h-2.5 w-2.5 mr-0.5" />}
      {COMPLIANCE_TIER_LABELS[tier]}
    </span>
  );
}

// ── Version History ──────────────────────────────────────────

function VersionHistory({
  versions,
  solicitationId,
  companyId,
  volumeId,
}: {
  versions: TouchupVolumeVersion[];
  solicitationId: string;
  companyId: string;
  volumeId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [expandedGapId, setExpandedGapId] = useState<string | null>(null);

  if (versions.length === 0) return null;

  const handleVersionDownload = async (version: TouchupVolumeVersion) => {
    const res = await fetch(
      `/api/solicitations/${solicitationId}/touchup/volumes/${volumeId}?version=${version.version_number}`,
      { headers: { "X-Company-Id": companyId } }
    );
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Touchup_v${version.version_number}.docx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
      >
        <History className="h-3.5 w-3.5" />
        {expanded ? "Hide" : "Show"} Version History ({versions.length} previous)
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {expanded && (
        <div className="mt-2 space-y-2">
          {versions.map((ver) => (
              <div
                key={ver.id}
                className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-gray-200 px-2 py-0.5 text-xs font-bold text-gray-700">
                      v{ver.version_number}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                        ver.action === "rewritten"
                          ? "text-blue-600 bg-blue-50 border-blue-200"
                          : "text-purple-600 bg-purple-50 border-purple-200"
                      )}
                    >
                      {ver.action === "rewritten" ? "Rewritten" : "Analyzed"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Clock className="h-3 w-3" />
                      {new Date(ver.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Compact stats row */}
                <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-gray-500">
                  {ver.gap_analysis && (
                    <>
                      <span>
                        {ver.gap_analysis.requirements_coverage?.filter(r => r.status === "missing").length || 0} missing
                      </span>
                      {(ver.fabrication_flags?.length ?? 0) > 0 && (
                        <span className="text-red-500">{ver.fabrication_flags!.length} fabrication(s)</span>
                      )}
                      {(ver.placeholder_count ?? 0) > 0 && (
                        <span>{ver.placeholder_count} placeholder(s)</span>
                      )}
                    </>
                  )}
                  {ver.word_count != null && <span>{ver.word_count.toLocaleString()} words</span>}
                  {ver.page_estimate != null && <span>~{ver.page_estimate} pages</span>}
                </div>

                {/* Expandable gap analysis for analyzed versions */}
                {ver.gap_analysis && (
                  <button
                    type="button"
                    onClick={() => setExpandedGapId(expandedGapId === ver.id ? null : ver.id)}
                    className="mt-1.5 text-xs text-gray-500 hover:text-gray-700 underline"
                  >
                    {expandedGapId === ver.id ? "Hide details" : "View gap details"}
                  </button>
                )}

                {expandedGapId === ver.id && ver.gap_analysis && (
                  <div className="mt-2 space-y-2 text-xs">
                    {/* Missing requirements */}
                    {(ver.gap_analysis.requirements_coverage?.filter(r => r.status === "missing") || []).length > 0 && (
                      <div className="space-y-1">
                        <p className="font-medium text-red-700">Missing:</p>
                        {ver.gap_analysis.requirements_coverage
                          ?.filter(r => r.status === "missing")
                          .map((r, i) => (
                            <div key={i} className="text-red-600 bg-red-50/50 rounded px-2 py-0.5">
                              <span className="font-medium">{r.requirement_id}:</span> {r.gap_description || r.requirement_text}
                            </div>
                          ))}
                      </div>
                    )}
                    {/* Fabrications */}
                    {(ver.gap_analysis.data_verification?.filter(d => d.source === "fabricated") || []).length > 0 && (
                      <div className="space-y-1">
                        <p className="font-medium text-red-700">Fabrications:</p>
                        {ver.gap_analysis.data_verification
                          ?.filter(d => d.source === "fabricated")
                          .map((f, i) => (
                            <div key={i} className="text-red-600 bg-red-50/50 rounded px-2 py-0.5">
                              {f.claim}{f.correction && <span className="block text-red-700">→ {f.correction}</span>}
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )}

                {/* DOCX download for rewritten versions */}
                {ver.action === "rewritten" && ver.file_path && (
                  <button
                    type="button"
                    onClick={() => handleVersionDownload(ver)}
                    className="mt-2 flex items-center gap-1 rounded bg-green-50 border border-green-200 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100 transition-colors"
                  >
                    <Download className="h-3 w-3" />
                    Download v{ver.version_number} DOCX
                  </button>
                )}
              </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Props ────────────────────────────────────────────────────

export interface VolumeScoreCardProps {
  volume: TouchupVolume;
  solicitationId: string;
  companyId: string;
  onRewrite: (touchupVolumeId: string) => void;
  rewritingId: string | null;
}

// ── Component ────────────────────────────────────────────────

export function VolumeScoreCard({
  volume,
  solicitationId,
  companyId,
  onRewrite,
  rewritingId,
}: VolumeScoreCardProps) {
  const [previewOpen, setPreviewOpen] = useState(false);

  const handleDownload = async () => {
    const res = await fetch(
      `/api/solicitations/${solicitationId}/touchup/volumes/${volume.id}`,
      { headers: { "X-Company-Id": companyId } }
    );
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Touchup_${volume.volume_name.replace(/\s+/g, "_")}.docx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-sm font-semibold text-gray-900">{volume.volume_name}</span>
        <StatusBadge status={volume.status} />
        {volume.version_number > 1 && (
          <span className="text-xs text-gray-400 font-mono">v{volume.version_number}</span>
        )}
      </div>

      {/* Analyzing in progress */}
      {volume.status === "scoring" && (
        <div className="flex items-center gap-2 text-sm text-purple-600 mt-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Analyzing against RFP requirements and company data...
        </div>
      )}

      {/* Analyzed — show gap analysis + rewrite button */}
      {volume.status === "scored" && volume.gap_analysis && (
        <div className="mt-2">
          <div className="flex flex-wrap gap-3 text-xs text-gray-600">
            <span>
              {volume.gap_analysis.requirements_coverage?.filter(r => r.status === "covered").length || 0} covered
              {" / "}
              {volume.gap_analysis.requirements_coverage?.filter(r => r.status === "partial").length || 0} partial
              {" / "}
              {volume.gap_analysis.requirements_coverage?.filter(r => r.status === "missing").length || 0} missing
            </span>
            {(volume.fabrication_flags?.length ?? 0) > 0 && (
              <span className="text-red-600 font-medium">
                {volume.fabrication_flags!.length} fabrication(s)
              </span>
            )}
            {(volume.placeholder_count ?? 0) > 0 && (
              <span>{volume.placeholder_count} placeholder(s)</span>
            )}
          </div>

          <GapAnalysisSection volume={volume} />

          <div className="mt-4">
            <button
              type="button"
              onClick={() => onRewrite(volume.id)}
              disabled={rewritingId === volume.id}
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
                rewritingId === volume.id
                  ? "cursor-not-allowed bg-blue-100 text-blue-400"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              )}
            >
              {rewritingId === volume.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Pencil className="h-4 w-4" />
              )}
              {rewritingId === volume.id ? "Starting rewrite..." : "Rewrite This Volume"}
            </button>
          </div>
        </div>
      )}

      {/* Rewriting in progress */}
      {volume.status === "rewriting" && (
        <div className="flex items-center gap-2 text-sm text-blue-600 mt-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Rewriting to address identified gaps...
        </div>
      )}

      {/* Completed — show results + download */}
      {volume.status === "completed" && volume.volume_order !== 999 && (
        <div className="mt-2 space-y-3">
          <div className="flex flex-wrap gap-3 text-xs text-gray-600">
            {volume.word_count != null && <span>{volume.word_count.toLocaleString()} words</span>}
            {volume.page_estimate != null && volume.page_limit != null && (
              <span>{volume.page_estimate} / {volume.page_limit} pages</span>
            )}
            {volume.page_estimate != null && volume.page_limit == null && (
              <span>~{volume.page_estimate} pages</span>
            )}
            {(volume.human_input_count ?? 0) > 0 && (
              <span className="text-amber-600 font-medium">
                {volume.human_input_count} human input(s) needed
              </span>
            )}
            {volume.regression_reversions && volume.regression_reversions.length > 0 && (
              <span className="text-purple-600">
                {volume.regression_reversions.length} section(s) kept from original
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {volume.file_path && (
              <button
                type="button"
                onClick={handleDownload}
                className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                Download DOCX
              </button>
            )}
            {volume.content_markdown && (
              <button
                type="button"
                onClick={() => setPreviewOpen(!previewOpen)}
                className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 underline transition-colors"
              >
                {previewOpen ? "Hide Preview" : "Preview Markdown"}
              </button>
            )}
          </div>

          {previewOpen && volume.content_markdown && (
            <div className="mt-2 max-h-96 overflow-y-auto rounded border border-gray-200 bg-gray-50 p-3 text-xs font-mono whitespace-pre-wrap">
              {volume.content_markdown.slice(0, 5000)}
              {volume.content_markdown.length > 5000 && "\n\n... (truncated for preview)"}
            </div>
          )}
        </div>
      )}

      {/* Failed */}
      {volume.status === "failed" && (
        <div className="mt-2 flex items-start gap-2 text-sm text-red-600">
          <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{volume.error_message || "An error occurred during processing."}</span>
        </div>
      )}

      {/* Version History */}
      {(volume.versions?.length ?? 0) > 0 && (
        <VersionHistory
          versions={volume.versions!}
          solicitationId={solicitationId}
          companyId={companyId}
          volumeId={volume.id}
        />
      )}
    </div>
  );
}
