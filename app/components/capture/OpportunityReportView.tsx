"use client";

import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  TrendingUp,
  Shield,
  Target,
  BarChart3,
  Lightbulb,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  OpportunityReport,
  FitRating,
  ReportFinding,
  GoNoGoFactor,
  PastPerformanceAlignment,
  RequirementCoverage,
} from "@/lib/supabase/capture-types";
import { FIT_RATING_LABELS, FIT_RATING_COLORS } from "@/lib/supabase/capture-types";

interface OpportunityReportViewProps {
  report: OpportunityReport;
  score: number;
  fitRating: FitRating;
}

function ScoreGauge({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 45;
  const progress = (score / 100) * circumference;
  const color =
    score >= 75
      ? "text-emerald-500"
      : score >= 50
      ? "text-blue-500"
      : score >= 25
      ? "text-amber-500"
      : "text-red-500";

  return (
    <div className="relative flex h-32 w-32 items-center justify-center">
      <svg className="h-32 w-32 -rotate-90" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          className="text-muted/30"
        />
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${progress} ${circumference}`}
          className={color}
        />
      </svg>
      <div className="absolute text-center">
        <p className={cn("text-2xl font-bold", color)}>{score}</p>
        <p className="text-xs text-muted-foreground">/ 100</p>
      </div>
    </div>
  );
}

function SeverityIcon({ severity }: { severity: "high" | "medium" | "low" }) {
  if (severity === "high")
    return <ArrowUpRight className="h-4 w-4 text-red-500" />;
  if (severity === "medium")
    return <Minus className="h-4 w-4 text-amber-500" />;
  return <ArrowDownRight className="h-4 w-4 text-blue-500" />;
}

function FindingCard({ finding }: { finding: ReportFinding }) {
  const borderColor =
    finding.severity === "high"
      ? "border-l-red-400"
      : finding.severity === "medium"
      ? "border-l-amber-400"
      : "border-l-blue-400";

  return (
    <div
      className={cn(
        "rounded-lg border border-border border-l-4 bg-muted/20 p-4",
        borderColor
      )}
    >
      <div className="flex items-start gap-2">
        <SeverityIcon severity={finding.severity} />
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">
            {finding.title}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {finding.description}
          </p>
          {finding.evidence && (
            <p className="mt-2 text-xs italic text-muted-foreground">
              Evidence: {finding.evidence}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function GoNoGoRow({ factor }: { factor: GoNoGoFactor }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <div className="mt-0.5">
        {factor.assessment === "go" ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
        ) : factor.assessment === "caution" ? (
          <AlertTriangle className="h-5 w-5 text-amber-500" />
        ) : (
          <XCircle className="h-5 w-5 text-red-500" />
        )}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-foreground">{factor.factor}</p>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-medium",
              factor.assessment === "go"
                ? "bg-emerald-100 text-emerald-700"
                : factor.assessment === "caution"
                ? "bg-amber-100 text-amber-700"
                : "bg-red-100 text-red-700"
            )}
          >
            {factor.assessment === "go"
              ? "Go"
              : factor.assessment === "caution"
              ? "Caution"
              : "No-Go"}
          </span>
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {factor.rationale}
        </p>
      </div>
    </div>
  );
}

function AlignmentBar({ score }: { score: number }) {
  const color =
    score >= 80
      ? "bg-emerald-500"
      : score >= 50
      ? "bg-blue-500"
      : score >= 25
      ? "bg-amber-500"
      : "bg-red-500";

  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 rounded-full bg-muted">
        <div
          className={cn("h-2 rounded-full transition-all", color)}
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </div>
      <span className="text-xs font-medium text-muted-foreground">
        {score}%
      </span>
    </div>
  );
}

export function OpportunityReportView({
  report,
  score,
  fitRating,
}: OpportunityReportViewProps) {
  return (
    <div className="space-y-6">
      {/* Executive summary card */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border bg-muted/30 px-6 py-4">
          <h2 className="text-base font-semibold text-foreground">
            Executive Summary
          </h2>
        </div>
        <div className="p-6">
          <div className="flex flex-col items-center gap-6 sm:flex-row">
            <ScoreGauge score={score} />
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "rounded-full border px-3 py-1 text-sm font-semibold",
                    FIT_RATING_COLORS[fitRating]
                  )}
                >
                  {FIT_RATING_LABELS[fitRating]}
                </span>
                {report.estimated_win_probability && (
                  <span className="text-sm text-muted-foreground">
                    Est. Win Probability:{" "}
                    <span className="font-medium text-foreground">
                      {report.estimated_win_probability}
                    </span>
                  </span>
                )}
              </div>
              <p className="text-sm text-foreground">
                {report.executive_summary}
              </p>
              {report.competitive_positioning && (
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium">Competitive Positioning: </span>
                  {report.competitive_positioning}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Go/No-Go Decision Matrix */}
      {report.go_no_go_factors && report.go_no_go_factors.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border bg-muted/30 px-6 py-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <h2 className="text-base font-semibold text-foreground">
                Go / No-Go Decision Factors
              </h2>
            </div>
          </div>
          <div className="divide-y divide-border px-6">
            {report.go_no_go_factors.map((factor, i) => (
              <GoNoGoRow key={i} factor={factor} />
            ))}
          </div>
        </div>
      )}

      {/* Strengths & Weaknesses */}
      <div className="grid gap-6 lg:grid-cols-2">
        {report.strengths && report.strengths.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="border-b border-border bg-muted/30 px-6 py-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                <h2 className="text-base font-semibold text-foreground">
                  Strengths ({report.strengths.length})
                </h2>
              </div>
            </div>
            <div className="space-y-3 p-6">
              {report.strengths.map((s, i) => (
                <FindingCard key={i} finding={s} />
              ))}
            </div>
          </div>
        )}

        {report.weaknesses && report.weaknesses.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="border-b border-border bg-muted/30 px-6 py-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <h2 className="text-base font-semibold text-foreground">
                  Weaknesses ({report.weaknesses.length})
                </h2>
              </div>
            </div>
            <div className="space-y-3 p-6">
              {report.weaknesses.map((w, i) => (
                <FindingCard key={i} finding={w} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Risks */}
      {report.risks && report.risks.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border bg-muted/30 px-6 py-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <h2 className="text-base font-semibold text-foreground">
                Risks ({report.risks.length})
              </h2>
            </div>
          </div>
          <div className="space-y-3 p-6">
            {report.risks.map((r, i) => (
              <FindingCard key={i} finding={r} />
            ))}
          </div>
        </div>
      )}

      {/* Past Performance Alignment */}
      {report.past_performance_alignment &&
        report.past_performance_alignment.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="border-b border-border bg-muted/30 px-6 py-4">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                <h2 className="text-base font-semibold text-foreground">
                  Past Performance Alignment
                </h2>
              </div>
            </div>
            <div className="divide-y divide-border">
              {report.past_performance_alignment.map((alignment, i) => (
                <div key={i} className="p-4 px-6">
                  <div className="mb-2 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {alignment.past_performance_title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Mapped to: {alignment.rfp_requirement}
                      </p>
                    </div>
                  </div>
                  <AlignmentBar score={alignment.alignment_score} />
                  <p className="mt-2 text-xs text-muted-foreground">
                    {alignment.reasoning}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

      {/* Requirement Coverage */}
      {report.requirement_coverage &&
        report.requirement_coverage.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="border-b border-border bg-muted/30 px-6 py-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                <h2 className="text-base font-semibold text-foreground">
                  Requirement Coverage
                </h2>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/20">
                    <th className="px-6 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Requirement
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Coverage
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Evidence
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {report.requirement_coverage.map((req, i) => (
                    <tr key={i}>
                      <td className="px-6 py-3">
                        <p className="text-sm text-foreground">
                          {req.requirement}
                        </p>
                        {req.source_section && (
                          <p className="text-xs text-muted-foreground">
                            Source: {req.source_section}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-0.5 text-xs font-medium",
                            req.coverage_status === "fully_covered"
                              ? "bg-emerald-100 text-emerald-700"
                              : req.coverage_status === "partially_covered"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-red-100 text-red-700"
                          )}
                        >
                          {req.coverage_status === "fully_covered"
                            ? "Fully Covered"
                            : req.coverage_status === "partially_covered"
                            ? "Partially"
                            : "Not Covered"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {req.supporting_evidence}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      {/* Recommendations */}
      {report.recommendations && report.recommendations.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border bg-muted/30 px-6 py-4">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              <h2 className="text-base font-semibold text-foreground">
                Recommendations
              </h2>
            </div>
          </div>
          <div className="p-6">
            <ul className="space-y-2">
              {report.recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                    {i + 1}
                  </span>
                  <p className="text-sm text-foreground">{rec}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
