"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Download,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Sparkles,
  FileBarChart,
  Pencil,
  Info,
  ArrowUp,
  ArrowDown,
  History,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  TouchupGetResponse,
  TouchupAnalysis,
  TouchupVolume,
  TouchupVolumeVersion,
  TouchupVolumeStatus,
  DraftVolumeForTouchup,
  ComputedAggregates,
  PackageConsistencyResult,
  PackageConsistencyCheck,
  HumanEffortEstimate,
  ComplianceTier,
} from "@/lib/supabase/touchup-types";
import {
  TOUCHUP_VOLUME_STATUS_LABELS,
  TOUCHUP_VOLUME_STATUS_COLORS,
  COMPLIANCE_TIER_LABELS,
  COMPLIANCE_TIER_COLORS,
  FABRICATION_TYPE_LABELS,
  PLACEHOLDER_TYPE_LABELS,
  getScoreColorClass,
} from "@/lib/supabase/touchup-types";

// ============================================================
// Types
// ============================================================

interface TouchupTabProps {
  solicitationId: string;
  companyId: string;
}

// ============================================================
// Volume Status Badge
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
// Score Badge
// ============================================================

function ScoreBadge({ score, label }: { score: number; label?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        getScoreColorClass(score)
      )}
    >
      {label && <span className="font-normal opacity-70">{label}</span>}
      {score}/100
    </span>
  );
}

// ============================================================
// Severity Tier Badge
// ============================================================

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

// ============================================================
// Human Effort Badge
// ============================================================

function HumanEffortBadge({ estimate }: { estimate: HumanEffortEstimate }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 mt-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-700">Human Effort Estimate</span>
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold",
            estimate.pass_fail === "pass"
              ? "bg-green-100 text-green-700"
              : "bg-red-100 text-red-700"
          )}
        >
          {estimate.total_hours}h total
          {estimate.pass_fail !== "pass" && " — OVER THRESHOLD"}
        </span>
      </div>
      {estimate.by_category.length > 0 && (
        <div className="space-y-1">
          {estimate.by_category.map((cat, i) => (
            <div key={i} className="flex items-center justify-between text-xs text-gray-600">
              <span>{cat.category} ({cat.count})</span>
              <span className="font-mono">{cat.hours}h</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Package Consistency Card
// ============================================================

function PackageConsistencyCard({
  result,
  packageScore,
  onScorePackage,
  scoringPackage,
  hasScoredVolumes,
}: {
  result: PackageConsistencyResult | null;
  packageScore: number | null;
  onScorePackage: () => void;
  scoringPackage: boolean;
  hasScoredVolumes: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-indigo-900 flex items-center gap-2">
          <FileBarChart className="h-4 w-4" />
          Package Consistency
        </h3>
        <div className="flex items-center gap-2">
          {packageScore != null && (
            <ScoreBadge score={packageScore} label="consistency" />
          )}
          {result && (
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold",
                result.overall_consistent
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              )}
            >
              {result.overall_consistent ? "Consistent" : "Inconsistent"}
            </span>
          )}
        </div>
      </div>

      {!result && (
        <div className="flex items-center gap-3 mt-3">
          <button
            type="button"
            onClick={onScorePackage}
            disabled={!hasScoredVolumes || scoringPackage}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
              !hasScoredVolumes || scoringPackage
                ? "cursor-not-allowed bg-indigo-100 text-indigo-400"
                : "bg-indigo-600 text-white hover:bg-indigo-700"
            )}
          >
            {scoringPackage ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {scoringPackage ? "Scoring..." : "Score Package Consistency"}
          </button>
          {!hasScoredVolumes && (
            <span className="text-xs text-gray-500">Score at least 2 volumes first</span>
          )}
        </div>
      )}

      {result && (
        <>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-indigo-700 hover:text-indigo-900 font-medium mt-1"
          >
            {expanded ? "Hide" : "Show"} {result.checks.length} checks
          </button>

          {expanded && (
            <div className="mt-3 space-y-2">
              {result.checks.map((check, i) => (
                <div
                  key={i}
                  className={cn(
                    "rounded border px-3 py-2 text-xs",
                    check.status === "consistent"
                      ? "border-green-200 bg-green-50 text-green-800"
                      : "border-red-200 bg-red-50 text-red-800"
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold">{check.check_type.replace(/_/g, " ")}</span>
                    <div className="flex items-center gap-1.5">
                      <SeverityBadge tier={check.severity_tier} />
                      <span
                        className={cn(
                          "font-bold",
                          check.status === "consistent" ? "text-green-600" : "text-red-600"
                        )}
                      >
                        {check.status === "consistent" ? "✓" : "✗"}
                      </span>
                    </div>
                  </div>
                  <p>{check.details}</p>
                  {check.volumes_affected.length > 0 && (
                    <p className="mt-1 text-[10px] text-gray-500">
                      Affects: {check.volumes_affected.join(", ")}
                    </p>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={onScorePackage}
                disabled={scoringPackage}
                className="mt-2 flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
              >
                <RefreshCw className="h-3 w-3" />
                Re-score Package
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ============================================================
// Gap Analysis Detail (expandable)
// ============================================================

function GapAnalysisDetail({ volume }: { volume: TouchupVolume }) {
  const [expanded, setExpanded] = useState(false);
  const ga = volume.gap_analysis;
  if (!ga) return null;

  const missing = ga.requirements_coverage?.filter(r => r.status === "missing") || [];
  const partial = ga.requirements_coverage?.filter(r => r.status === "partial") || [];
  const covered = ga.requirements_coverage?.filter(r => r.status === "covered") || [];
  const fabrications = ga.data_verification?.filter(d => d.source === "fabricated") || [];
  const missingContent = ga.missing_content || [];
  const placeholders = ga.placeholder_items || [];

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 transition-colors"
      >
        {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        {expanded ? "Hide" : "Show"} Gap Analysis Details
      </button>

      {expanded && (
        <div className="mt-3 space-y-4 text-sm">
          {/* Requirements Coverage */}
          <div>
            <h4 className="font-semibold text-gray-800 mb-2">
              Requirements Coverage ({covered.length} covered, {partial.length} partial, {missing.length} missing)
            </h4>
            {missing.length > 0 && (
              <div className="space-y-1 mb-2">
                <p className="text-xs font-medium text-red-700">Missing:</p>
                {missing.map((r, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-xs text-red-600 bg-red-50 rounded px-2 py-1">
                    <div className="flex-1">
                      <span className="font-medium">{r.requirement_id}:</span> {r.gap_description || r.requirement_text}
                    </div>
                    {r.severity_tier && <SeverityBadge tier={r.severity_tier} />}
                  </div>
                ))}
              </div>
            )}
            {partial.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-amber-700">Partial:</p>
                {partial.map((r, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-xs text-amber-600 bg-amber-50 rounded px-2 py-1">
                    <div className="flex-1">
                      <span className="font-medium">{r.requirement_id}:</span> {r.gap_description || r.requirement_text}
                    </div>
                    {r.severity_tier && <SeverityBadge tier={r.severity_tier} />}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Fabrications */}
          {fabrications.length > 0 && (
            <div>
              <h4 className="font-semibold text-red-800 mb-2">Fabricated Claims ({fabrications.length})</h4>
              {fabrications.map((f, i) => (
                <div key={i} className="text-xs text-red-600 bg-red-50 rounded px-2 py-1 mb-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <span className="font-medium">Claim:</span> {f.claim}
                      {f.correction && (
                        <span className="block text-red-700 mt-0.5">Correction: {f.correction}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {f.fabrication_type && (
                        <span className="inline-flex items-center rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-red-800">
                          {FABRICATION_TYPE_LABELS[f.fabrication_type]}
                        </span>
                      )}
                      {f.severity_tier && <SeverityBadge tier={f.severity_tier} />}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Missing Content */}
          {missingContent.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-800 mb-2">Missing Content ({missingContent.length})</h4>
              {missingContent.map((m, i) => (
                <div key={i} className="text-xs text-gray-600 bg-gray-50 rounded px-2 py-1 mb-1">
                  <span className="font-medium">{m.topic}:</span> {m.recommended_action}
                  {m.source_data_available && (
                    <span className="ml-1 text-green-600">(data available)</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Placeholders */}
          {placeholders.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-800 mb-2">Placeholders ({placeholders.length})</h4>
              {placeholders.map((p, i) => (
                <div key={i} className="text-xs text-gray-600 bg-gray-50 rounded px-2 py-1 mb-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      {p.placeholder_text}
                      {p.data_available && p.suggested_fill && (
                        <span className="block text-green-600 mt-0.5">Suggested: {p.suggested_fill}</span>
                      )}
                    </div>
                    {p.placeholder_type && (
                      <span
                        className={cn(
                          "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase flex-shrink-0",
                          p.placeholder_type === "auto_fillable"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-blue-100 text-blue-800"
                        )}
                      >
                        {PLACEHOLDER_TYPE_LABELS[p.placeholder_type]}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Score Delta Indicator
// ============================================================

function ScoreDelta({ current, previous }: { current: number | null; previous: number | null }) {
  if (current == null || previous == null) return null;
  const delta = current - previous;
  if (delta === 0) return <span className="text-xs text-gray-400">±0</span>;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-semibold",
        delta > 0 ? "text-green-600" : "text-red-600"
      )}
    >
      {delta > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
      {delta > 0 ? `+${delta}` : delta}
    </span>
  );
}

// ============================================================
// Version History (collapsible timeline)
// ============================================================

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
  const [expandedGapIdx, setExpandedGapIdx] = useState<number | null>(null);

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
          {versions.map((ver, idx) => {
            const prevVersion = versions[idx + 1];
            const prevScore = prevVersion?.compliance_score ?? null;

            return (
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
                      {ver.action === "rewritten" ? "Rewritten" : "Scored"}
                      {ver.score_version ? ` (${ver.score_version})` : ""}
                    </span>
                    {ver.compliance_score != null && (
                      <>
                        <ScoreBadge score={ver.compliance_score} />
                        <ScoreDelta current={ver.compliance_score} previous={prevScore} />
                      </>
                    )}
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

                {/* Expandable gap analysis for scored versions */}
                {ver.gap_analysis && (
                  <button
                    type="button"
                    onClick={() => setExpandedGapIdx(expandedGapIdx === idx ? null : idx)}
                    className="mt-1.5 text-xs text-gray-500 hover:text-gray-700 underline"
                  >
                    {expandedGapIdx === idx ? "Hide details" : "View gap details"}
                  </button>
                )}

                {expandedGapIdx === idx && ver.gap_analysis && (
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
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Volume Card
// ============================================================

function VolumeCard({
  volume,
  solicitationId,
  companyId,
  onRewrite,
  rewritingId,
  onRescore,
  rescoringId,
}: {
  volume: TouchupVolume;
  solicitationId: string;
  companyId: string;
  onRewrite: (touchupVolumeId: string) => void;
  rewritingId: string | null;
  onRescore: (originalVolumeId: string, version: "draft" | "touchup", versionNumber?: number) => void;
  rescoringId: string | null;
}) {
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
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-900">{volume.volume_name}</span>
          <StatusBadge status={volume.status} />
          {volume.version_number > 1 && (
            <span className="text-xs text-gray-400 font-mono">v{volume.version_number}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {volume.compliance_score != null && (
            <>
              <ScoreBadge score={volume.compliance_score} label="draft" />
              {(volume.versions?.length ?? 0) > 0 && (
                <ScoreDelta
                  current={volume.compliance_score}
                  previous={volume.versions![0].compliance_score}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Scoring in progress */}
      {volume.status === "scoring" && (
        <div className="flex items-center gap-2 text-sm text-purple-600 mt-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Scoring against RFP requirements and company data...
        </div>
      )}

      {/* Scored — show gap analysis + rewrite button */}
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

          <GapAnalysisDetail volume={volume} />

          {volume.gap_analysis?.human_effort_estimate && (
            <HumanEffortBadge estimate={volume.gap_analysis.human_effort_estimate} />
          )}

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
          Rewriting with gap fixes and regression guard...
        </div>
      )}

      {/* Completed — show results + download */}
      {volume.status === "completed" && volume.volume_order !== 999 && (
        <div className="mt-2 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            {volume.compliance_score != null && (
              <ScoreBadge score={volume.compliance_score} label="before" />
            )}
            {volume.touchup_score != null && (
              <ScoreBadge score={volume.touchup_score} label="after" />
            )}
          </div>

          {/* Re-score options — version-aware */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-gray-500">Re-score:</span>
            <button
              type="button"
              onClick={() => onRescore(volume.original_volume_id, "draft")}
              disabled={rescoringId === volume.original_volume_id}
              className="rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-50 transition-colors"
            >
              Original Draft
            </button>
            {/* Historical rewritten versions */}
            {(volume.versions || [])
              .filter(v => v.action === "rewritten" && v.content_markdown)
              .map(v => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => onRescore(volume.original_volume_id, "touchup", v.version_number)}
                  disabled={rescoringId === volume.original_volume_id}
                  className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition-colors"
                >
                  v{v.version_number}
                </button>
              ))}
            {/* Current version (latest) */}
            {volume.content_markdown && (
              <button
                type="button"
                onClick={() => onRescore(volume.original_volume_id, "touchup", volume.version_number)}
                disabled={rescoringId === volume.original_volume_id}
                className="rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50 transition-colors"
              >
                v{volume.version_number} (latest)
              </button>
            )}
            {rescoringId === volume.original_volume_id && (
              <Loader2 className="h-3 w-3 animate-spin text-gray-400" />
            )}
          </div>

          <div className="flex flex-wrap gap-3 text-xs text-gray-600">
            {volume.word_count != null && <span>{volume.word_count.toLocaleString()} words</span>}
            {volume.page_estimate != null && <span>~{volume.page_estimate} pages</span>}
            {volume.page_limit != null && (
              <span className={cn(
                "font-medium",
                volume.page_limit_status === "over" ? "text-red-600" :
                volume.page_limit_status === "warning" ? "text-amber-600" : "text-green-600"
              )}>
                {volume.page_limit} page limit
              </span>
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

// ============================================================
// Aggregates Banner
// ============================================================

function AggregatesBanner({ aggregates }: { aggregates: ComputedAggregates }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
        <div className="text-2xl font-bold text-gray-900">
          {aggregates.overall_compliance_score != null ? `${aggregates.overall_compliance_score}%` : "—"}
        </div>
        <div className="text-xs text-gray-500">Avg. Compliance</div>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
        <div className="text-2xl font-bold text-gray-900">{aggregates.total_gaps}</div>
        <div className="text-xs text-gray-500">Total Gaps</div>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
        <div className="text-2xl font-bold text-gray-900">
          {aggregates.scored_count}/{aggregates.total_count}
        </div>
        <div className="text-xs text-gray-500">Scored</div>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
        <div className="text-2xl font-bold text-gray-900">
          {aggregates.rewritten_count}/{aggregates.total_count}
        </div>
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
  const [aggregates, setAggregates] = useState<ComputedAggregates | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [scoring, setScoring] = useState(false);
  const [rewritingId, setRewritingId] = useState<string | null>(null);
  const [rescoringId, setRescoringId] = useState<string | null>(null);
  const [generatingMatrix, setGeneratingMatrix] = useState(false);
  const [scoringPackage, setScoringPackage] = useState(false);
  const [packageConsistency, setPackageConsistency] = useState<PackageConsistencyResult | null>(null);
  const [packageScore, setPackageScore] = useState<number | null>(null);
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
      setAggregates(data.aggregates);

      if (data.touchup) {
        const ta = data.touchup as TouchupAnalysis;
        setPackageConsistency(ta.package_consistency ?? null);
        setPackageScore(ta.package_score ?? null);
      }
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

  const handleScore = async () => {
    if (selectedIds.size === 0) return;
    setScoring(true);
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
      setScoring(false);
    }
  };

  const handleRescore = async (originalVolumeId: string, version: "draft" | "touchup", versionNumber?: number) => {
    setRescoringId(originalVolumeId);
    try {
      const res = await fetch(
        `/api/solicitations/${solicitationId}/touchup`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Company-Id": companyId },
          body: JSON.stringify({
            action: "score",
            volumeIds: [originalVolumeId],
            scoreVersion: version,
            ...(versionNumber ? { scoreVersionNumber: versionNumber } : {}),
          }),
        }
      );
      if (res.ok) {
        await fetchData();
      }
    } catch {
      // Non-fatal
    } finally {
      setRescoringId(null);
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

  const handleScorePackage = async () => {
    setScoringPackage(true);
    try {
      const res = await fetch(
        `/api/solicitations/${solicitationId}/touchup`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Company-Id": companyId },
          body: JSON.stringify({ action: "score-package" }),
        }
      );
      if (res.ok) {
        setTimeout(fetchData, 5000);
      }
    } catch {
      // Non-fatal
    } finally {
      setScoringPackage(false);
    }
  };

  const scoredVolumeCount = touchupVolumes.filter(v => v.compliance_score != null).length;

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

  const hasScoredOrCompleted = touchupVolumes.some(
    v => v.status === "scored" || v.status === "completed"
  );

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
            Score volumes against compliance requirements, then rewrite to fill gaps.
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

      {/* Aggregates (when we have data) */}
      {aggregates && aggregates.scored_count > 0 && (
        <AggregatesBanner aggregates={aggregates} />
      )}

      {/* Package Consistency (shows after 2+ volumes scored) */}
      {scoredVolumeCount >= 2 && (
        <PackageConsistencyCard
          result={packageConsistency}
          packageScore={packageScore}
          onScorePackage={handleScorePackage}
          scoringPackage={scoringPackage}
          hasScoredVolumes={scoredVolumeCount >= 2}
        />
      )}

      {/* Volume Selector */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-800">Select Volumes to Score</h3>
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
            onClick={handleScore}
            disabled={selectedIds.size === 0 || scoring}
            className={cn(
              "flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors",
              selectedIds.size === 0 || scoring
                ? "cursor-not-allowed bg-purple-100 text-purple-400 border border-purple-200"
                : "bg-purple-600 text-white hover:bg-purple-700"
            )}
          >
            {scoring ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {scoring ? "Starting..." : `Score ${selectedIds.size} Volume(s)`}
          </button>

          {selectedIds.size > 0 && touchupVolumes.some(v => selectedIds.has(v.original_volume_id) && (v.status === "scored" || v.status === "completed")) && (
            <div className="flex items-center gap-1.5 text-xs text-amber-600">
              <Info className="h-3.5 w-3.5" />
              Re-scoring will reset previous results
            </div>
          )}
        </div>
      </div>

      {/* Volume Cards */}
      {touchupVolumes.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-800">Volume Results</h3>
          {touchupVolumes.map(vol => (
            <VolumeCard
              key={vol.id}
              volume={vol}
              solicitationId={solicitationId}
              companyId={companyId}
              onRewrite={handleRewrite}
              rewritingId={rewritingId}
              onRescore={handleRescore}
              rescoringId={rescoringId}
            />
          ))}
        </div>
      )}

      {/* Generate Compliance Matrix */}
      {hasScoredOrCompleted && (
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
