"use client";

import {
  Search,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Building2,
  Tag,
  Mail,
  Phone,
  MapPin,
  ChevronDown,
  TrendingUp,
  Target,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  OpportunityFinderReport,
  ScoredOpportunity,
} from "@/lib/supabase/capture-types";
import { useState } from "react";

interface OpportunityFinderResultsProps {
  report: OpportunityFinderReport;
}

function ActionBadge({
  action,
}: {
  action: ScoredOpportunity["recommended_action"];
}) {
  const config = {
    pursue: {
      label: "Pursue",
      classes: "bg-emerald-100 text-emerald-800 border-emerald-200",
      Icon: CheckCircle2,
    },
    evaluate: {
      label: "Evaluate",
      classes: "bg-blue-100 text-blue-800 border-blue-200",
      Icon: Search,
    },
    monitor: {
      label: "Monitor",
      classes: "bg-amber-100 text-amber-800 border-amber-200",
      Icon: Clock,
    },
    skip: {
      label: "Skip",
      classes: "bg-gray-100 text-gray-600 border-gray-200",
      Icon: XCircle,
    },
  };
  const c = config[action] || config.skip;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        c.classes
      )}
    >
      <c.Icon className="h-3 w-3" />
      {c.label}
    </span>
  );
}

function PriorityBadge({
  priority,
}: {
  priority: ScoredOpportunity["pursuit_priority"];
}) {
  const classes = {
    high: "bg-red-100 text-red-700",
    medium: "bg-amber-100 text-amber-700",
    low: "bg-gray-100 text-gray-600",
  };
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-medium",
        classes[priority]
      )}
    >
      {priority.charAt(0).toUpperCase() + priority.slice(1)} Priority
    </span>
  );
}

function ScoreBar({ score }: { score: number }) {
  const color =
    score >= 80
      ? "bg-emerald-500"
      : score >= 60
      ? "bg-blue-500"
      : score >= 40
      ? "bg-amber-500"
      : "bg-red-500";

  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-20 rounded-full bg-muted">
        <div
          className={cn("h-2 rounded-full transition-all", color)}
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </div>
      <span className="text-xs font-bold text-foreground">{score}</span>
    </div>
  );
}

function formatDeadline(deadline: string | undefined): string {
  if (!deadline) return "Not specified";
  try {
    const d = new Date(deadline);
    const now = new Date();
    const diffDays = Math.ceil(
      (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    const formatted = d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    if (diffDays < 0) return `${formatted} (Past)`;
    if (diffDays <= 7) return `${formatted} (${diffDays}d left)`;
    if (diffDays <= 30) return `${formatted} (${diffDays}d left)`;
    return formatted;
  } catch {
    return deadline;
  }
}

function OpportunityCard({ scored }: { scored: ScoredOpportunity }) {
  const [expanded, setExpanded] = useState(false);
  const opp = scored.opportunity;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-md">
      {/* Header */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <ActionBadge action={scored.recommended_action} />
              <PriorityBadge priority={scored.pursuit_priority} />
              <ScoreBar score={scored.relevance_score} />
            </div>
            <h3 className="mt-2 text-base font-semibold text-foreground leading-tight">
              {opp.title}
            </h3>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {opp.department}
                {opp.sub_tier ? ` > ${opp.sub_tier}` : ""}
              </span>
              {opp.solicitation_number && (
                <span className="font-mono">{opp.solicitation_number}</span>
              )}
              {opp.naics_code && (
                <span className="inline-flex items-center gap-1">
                  <Tag className="h-3 w-3" />
                  NAICS: {opp.naics_code}
                  {scored.naics_match && (
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  )}
                </span>
              )}
            </div>
          </div>
          <a
            href={`https://sam.gov/opp/${opp.notice_id}/view`}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-lg border border-border bg-muted/50 p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="View on SAM.gov"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>

        {/* Key info row */}
        <div className="mt-3 flex flex-wrap gap-2">
          {opp.set_aside_description && (
            <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-800">
              {opp.set_aside_description}
              {scored.set_aside_match && " (Match)"}
            </span>
          )}
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
            {opp.type}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            Due: {formatDeadline(opp.response_deadline)}
          </span>
        </div>

        {/* Match reasons */}
        <div className="mt-3 space-y-1">
          <p className="text-xs font-semibold text-foreground">
            Why This Matches:
          </p>
          <ul className="space-y-0.5">
            {scored.match_reasons.map((reason, i) => (
              <li
                key={i}
                className="flex items-start gap-1.5 text-xs text-muted-foreground"
              >
                <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
                {reason}
              </li>
            ))}
          </ul>
        </div>

        {/* Capability alignment */}
        <p className="mt-2 text-xs text-foreground">
          <span className="font-medium">Alignment: </span>
          {scored.capability_alignment}
        </p>

        {/* Risk factors */}
        {scored.risk_factors.length > 0 && (
          <div className="mt-2 space-y-0.5">
            {scored.risk_factors.map((risk, i) => (
              <div
                key={i}
                className="flex items-start gap-1.5 text-xs text-amber-700"
              >
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
                {risk}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Expandable details */}
      <div className="border-t border-border">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center justify-between px-5 py-2.5 text-xs text-muted-foreground transition-colors hover:bg-muted/30"
        >
          <span>Solicitation Details</span>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 transition-transform",
              expanded && "rotate-180"
            )}
          />
        </button>

        {expanded && (
          <div className="space-y-3 border-t border-border px-5 py-4">
            {opp.description && (
              <div>
                <p className="text-xs font-semibold text-foreground">
                  Description
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground whitespace-pre-line">
                  {opp.description}
                </p>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold text-foreground">
                  Posted Date
                </p>
                <p className="text-xs text-muted-foreground">
                  {opp.posted_date}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">
                  Response Deadline
                </p>
                <p className="text-xs text-muted-foreground">
                  {opp.response_deadline || "Not specified"}
                </p>
              </div>
              {opp.classification_code && (
                <div>
                  <p className="text-xs font-semibold text-foreground">
                    PSC Code
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {opp.classification_code}
                  </p>
                </div>
              )}
              {opp.place_of_performance && (
                <div>
                  <p className="text-xs font-semibold text-foreground">
                    Place of Performance
                  </p>
                  <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {[
                      opp.place_of_performance.city,
                      opp.place_of_performance.state,
                      opp.place_of_performance.zip,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                </div>
              )}
            </div>

            {/* Point of contact */}
            {opp.point_of_contact && opp.point_of_contact.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-foreground mb-1">
                  Point of Contact
                </p>
                {opp.point_of_contact.map((poc, i) => (
                  <div
                    key={i}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground"
                  >
                    {poc.full_name && (
                      <span className="font-medium text-foreground">
                        {poc.full_name}
                      </span>
                    )}
                    {poc.title && <span>{poc.title}</span>}
                    {poc.email && (
                      <a
                        href={`mailto:${poc.email}`}
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        <Mail className="h-3 w-3" />
                        {poc.email}
                      </a>
                    )}
                    {poc.phone && (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {poc.phone}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* SAM.gov link */}
            <a
              href={`https://sam.gov/opp/${opp.notice_id}/view`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-muted"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View Full Solicitation on SAM.gov
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export function OpportunityFinderResults({
  report,
}: OpportunityFinderResultsProps) {
  const [filter, setFilter] = useState<"all" | "pursue" | "evaluate" | "monitor">("all");

  const pursueCount = report.scored_opportunities.filter(
    (s) => s.recommended_action === "pursue"
  ).length;
  const evaluateCount = report.scored_opportunities.filter(
    (s) => s.recommended_action === "evaluate"
  ).length;
  const monitorCount = report.scored_opportunities.filter(
    (s) => s.recommended_action === "monitor"
  ).length;

  const filtered =
    filter === "all"
      ? report.scored_opportunities
      : report.scored_opportunities.filter(
          (s) => s.recommended_action === filter
        );

  return (
    <div className="space-y-6">
      {/* Summary card */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border bg-muted/30 px-6 py-4">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold text-foreground">
              Opportunity Search Results
            </h2>
          </div>
        </div>
        <div className="p-6">
          <p className="text-sm text-foreground">{report.search_summary}</p>

          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-border bg-muted/20 p-3 text-center">
              <p className="text-2xl font-bold text-foreground">
                {report.total_matches}
              </p>
              <p className="text-xs text-muted-foreground">Total Matches</p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-center">
              <p className="text-2xl font-bold text-emerald-700">
                {pursueCount}
              </p>
              <p className="text-xs text-emerald-600">Pursue Now</p>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-center">
              <p className="text-2xl font-bold text-blue-700">
                {evaluateCount}
              </p>
              <p className="text-xs text-blue-600">Evaluate</p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center">
              <p className="text-2xl font-bold text-amber-700">
                {monitorCount}
              </p>
              <p className="text-xs text-amber-600">Monitor</p>
            </div>
          </div>
        </div>
      </div>

      {/* Company profile that was parsed */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border bg-muted/30 px-6 py-4">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold text-foreground">
              Parsed Company Profile
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            AI-extracted from your uploaded data — used to search and score
            opportunities
          </p>
        </div>
        <div className="p-6 space-y-3">
          <div>
            <p className="text-sm font-medium text-foreground">
              {report.parsed_profile.company_name}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {report.parsed_profile.capabilities_summary}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold text-foreground">
                NAICS Codes
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                {report.parsed_profile.naics_codes.map((code) => (
                  <span
                    key={code}
                    className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-mono text-primary"
                  >
                    {code}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">
                Set-Aside Qualifications
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                {report.parsed_profile.set_aside_codes.length > 0 ? (
                  report.parsed_profile.set_aside_codes.map((code) => (
                    <span
                      key={code}
                      className="rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700"
                    >
                      {code}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">None</span>
                )}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">
                Search Keywords
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                {report.parsed_profile.keywords.map((kw) => (
                  <span
                    key={kw}
                    className="rounded-full bg-muted px-2 py-0.5 text-xs text-foreground"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">
                Agency Experience
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {report.parsed_profile.agency_experience.join(", ") || "None listed"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      {report.scored_opportunities.length > 0 && (
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Filter:</span>
          {(
            [
              { key: "all" as const, label: "All", count: report.total_matches },
              { key: "pursue" as const, label: "Pursue", count: pursueCount },
              { key: "evaluate" as const, label: "Evaluate", count: evaluateCount },
              { key: "monitor" as const, label: "Monitor", count: monitorCount },
            ] as const
          ).map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                filter === f.key
                  ? "border-primary bg-primary text-white"
                  : "border-border bg-card text-muted-foreground hover:bg-muted"
              )}
            >
              {f.label} ({f.count})
            </button>
          ))}
        </div>
      )}

      {/* Opportunity cards */}
      {filtered.length > 0 ? (
        <div className="space-y-4">
          {filtered.map((scored) => (
            <OpportunityCard key={scored.opportunity.notice_id} scored={scored} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
          <Search className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm font-medium text-foreground">
            No opportunities found
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {filter !== "all"
              ? `No opportunities with "${filter}" recommendation. Try "All" filter.`
              : "No matching opportunities were found. Try uploading more company data or check back later."}
          </p>
        </div>
      )}
    </div>
  );
}
