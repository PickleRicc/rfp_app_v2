"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TouchupVolume, ComplianceTier } from "@/lib/supabase/touchup-types";
import {
  FABRICATION_TYPE_LABELS,
  PLACEHOLDER_TYPE_LABELS,
  COMPLIANCE_TIER_LABELS,
  COMPLIANCE_TIER_COLORS,
} from "@/lib/supabase/touchup-types";

// ── Severity Badge (local copy — also used by VolumeScoreCard) ──

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

// ── Props ────────────────────────────────────────────────────

interface GapAnalysisSectionProps {
  volume: TouchupVolume;
}

// ── Component ────────────────────────────────────────────────

export function GapAnalysisSection({ volume }: GapAnalysisSectionProps) {
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
