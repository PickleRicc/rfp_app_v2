"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2,
  AlertCircle,
  Telescope,
  Search,
  DollarSign,
  Brain,
  FileText,
  Clock,
  ArrowRight,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Target,
  Building2,
  TrendingUp,
  Plus,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/app/components/ui/button";
import Link from "next/link";
import type {
  CompanyResearch,
  ResearchStatus,
} from "@/lib/supabase/research-types";
import {
  RESEARCH_STATUS_LABELS,
  RESEARCH_STATUS_COLORS,
} from "@/lib/supabase/research-types";

function StatusBadge({ status }: { status: ResearchStatus }) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-0.5 text-xs font-medium",
        RESEARCH_STATUS_COLORS[status]
      )}
    >
      {RESEARCH_STATUS_LABELS[status]}
    </span>
  );
}

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount.toFixed(0)}`;
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return d;
  }
}

function Section({
  title,
  icon: Icon,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {open && <div className="border-t border-border px-5 py-4">{children}</div>}
    </div>
  );
}

function MarkdownContent({ content }: { content: string }) {
  if (!content)
    return (
      <p className="text-sm text-muted-foreground italic">No data available.</p>
    );
  return (
    <div className="prose prose-sm max-w-none text-foreground">
      {content.split("\n").map((line, i) => {
        if (line.startsWith("- ") || line.startsWith("* ")) {
          return (
            <p key={i} className="text-sm text-muted-foreground pl-4 my-0.5">
              <span className="text-primary mr-1.5">•</span>
              {line.replace(/^[-*]\s*/, "")}
            </p>
          );
        }
        if (line.startsWith("**") && line.endsWith("**")) {
          return (
            <p
              key={i}
              className="text-sm font-semibold text-foreground mt-3 mb-1"
            >
              {line.replace(/\*\*/g, "")}
            </p>
          );
        }
        if (!line.trim()) return null;
        return (
          <p key={i} className="text-sm text-muted-foreground my-1">
            {line}
          </p>
        );
      })}
    </div>
  );
}

// ── Export ────────────────────────────────────────────────

function exportResearchReport(report: CompanyResearch) {
  const spending = report.spending_report as CompanyResearch["spending_report"];
  const perplexity = report.perplexity_report as CompanyResearch["perplexity_report"];
  const opportunities = report.matched_opportunities as CompanyResearch["matched_opportunities"];

  const lines: string[] = [];
  const divider = "─".repeat(60);

  lines.push(`COMPANY RESEARCH REPORT`);
  lines.push(divider);
  lines.push(`Company: ${report.search_company_name}`);
  if (report.search_cage_code) lines.push(`CAGE Code: ${report.search_cage_code}`);
  if (report.search_uei) lines.push(`UEI: ${report.search_uei}`);
  lines.push(`Generated: ${new Date(report.created_at).toLocaleString()}`);
  lines.push("");

  if (report.executive_briefing) {
    lines.push("EXECUTIVE BRIEFING");
    lines.push(divider);
    lines.push(report.executive_briefing);
    lines.push("");
  }

  if (report.key_talking_points?.length) {
    lines.push("KEY TALKING POINTS");
    lines.push(divider);
    report.key_talking_points.forEach((p, i) => lines.push(`${i + 1}. ${p}`));
    lines.push("");
  }

  if (report.recommended_services?.length) {
    lines.push("RECOMMENDED SERVICES TO PITCH");
    lines.push(divider);
    lines.push(report.recommended_services.join(", "));
    lines.push("");
  }

  if (spending && spending.total_awards > 0) {
    lines.push("FEDERAL SPENDING SUMMARY");
    lines.push(divider);
    lines.push(`Total Awards: ${spending.total_awards}`);
    lines.push(`Total Obligation: ${formatCurrency(spending.total_obligation)}`);
    if (spending.agency_breakdown?.length) {
      lines.push("");
      lines.push("Top Agencies:");
      spending.agency_breakdown.slice(0, 8).forEach((a) => {
        lines.push(`  ${a.agency_name} — ${formatCurrency(a.total_obligation)} (${a.award_count} awards)`);
      });
    }
    if (spending.recent_awards?.length) {
      lines.push("");
      lines.push("Recent Awards:");
      spending.recent_awards.slice(0, 5).forEach((a) => {
        lines.push(`  ${a.description || a.award_id} — ${formatCurrency(a.total_obligation)}`);
        if (a.awarding_agency_name) lines.push(`    Agency: ${a.awarding_agency_name}`);
        if (a.date_signed) lines.push(`    Signed: ${formatDate(a.date_signed)}`);
      });
    }
    lines.push("");
  }

  if (perplexity) {
    const sections: [string, string | undefined][] = [
      ["COMPANY OVERVIEW", perplexity.company_overview],
      ["LEADERSHIP", perplexity.leadership],
      ["RECENT CONTRACTS & WINS", perplexity.recent_contracts_and_wins],
      ["PARTNERSHIPS & TEAMING", perplexity.partnerships_and_teaming],
      ["COMPETITIVE LANDSCAPE", perplexity.competitive_landscape],
      ["TECHNOLOGY & CAPABILITIES", perplexity.technology_and_capabilities],
      ["NEWS & DEVELOPMENTS", perplexity.news_and_developments],
      ["FINANCIAL HEALTH", perplexity.financial_health],
    ];
    for (const [title, content] of sections) {
      if (content) {
        lines.push(title);
        lines.push(divider);
        lines.push(content);
        lines.push("");
      }
    }
    if (perplexity.sources?.length) {
      lines.push("SOURCES");
      lines.push(divider);
      perplexity.sources.forEach((s) => lines.push(s));
      lines.push("");
    }
  }

  if (opportunities?.length) {
    lines.push(`MATCHING OPPORTUNITIES (${opportunities.length})`);
    lines.push(divider);
    opportunities.forEach((opp, i) => {
      lines.push(`${i + 1}. ${opp.title}`);
      lines.push(`   Department: ${opp.department}`);
      if (opp.solicitation_number) lines.push(`   Solicitation: ${opp.solicitation_number}`);
      if (opp.naics_code) lines.push(`   NAICS: ${opp.naics_code}`);
      if (opp.set_aside) lines.push(`   Set-Aside: ${opp.set_aside}`);
      if (opp.response_deadline) lines.push(`   Deadline: ${formatDate(opp.response_deadline)}`);
      lines.push(`   Action: ${opp.recommended_action} (Score: ${opp.relevance_score})`);
      lines.push("");
    });
  }

  const text = lines.join("\n");
  const blob = new Blob([text], { type: "text/plain;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const slug = report.search_company_name.replace(/\s+/g, "_").toLowerCase();
  a.download = `research_${slug}_${new Date().toISOString().slice(0, 10)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportOpportunitiesCSV(opportunities: CompanyResearch["matched_opportunities"], companyName: string) {
  if (!opportunities?.length) return;
  const headers = ["Title", "Department", "Solicitation Number", "Notice ID", "NAICS Code", "Set-Aside", "Response Deadline", "Recommended Action", "Relevance Score"];
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = opportunities.map((o) => [
    escape(o.title),
    escape(o.department),
    escape(o.solicitation_number ?? ""),
    escape(o.notice_id),
    escape(o.naics_code ?? ""),
    escape(o.set_aside ?? ""),
    escape(o.response_deadline ?? ""),
    escape(o.recommended_action),
    escape(o.relevance_score),
  ]);
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const slug = companyName.replace(/\s+/g, "_").toLowerCase();
  a.download = `opportunities_${slug}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Main Page ─────────────────────────────────────────────

export default function ResearchPage() {
  // Search form
  const [companyName, setCompanyName] = useState("");
  const [cageCode, setCageCode] = useState("");
  const [uei, setUei] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // State
  const [activeReport, setActiveReport] = useState<CompanyResearch | null>(null);
  const [pastReports, setPastReports] = useState<CompanyResearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load past reports on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/research");
        if (res.ok) {
          const data = await res.json();
          setPastReports(data.reports || []);
        }
      } catch {
        // Ignore
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Poll active report while researching
  const pollReport = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/research?id=${id}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.report) {
        setActiveReport(data.report);
        if (data.report.status === "complete" || data.report.status === "failed") {
          // Refresh the list
          const listRes = await fetch("/api/research");
          if (listRes.ok) {
            const listData = await listRes.json();
            setPastReports(listData.reports || []);
          }
        }
      }
    } catch {
      // Ignore poll errors
    }
  }, []);

  useEffect(() => {
    if (
      !activeReport ||
      (activeReport.status !== "pending" && activeReport.status !== "researching")
    )
      return;

    const interval = setInterval(() => pollReport(activeReport.id), 5000);
    return () => clearInterval(interval);
  }, [activeReport, pollReport]);

  // Start research
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) return;

    setSearching(true);
    setError(null);

    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: companyName.trim(),
          cage_code: cageCode.trim() || undefined,
          uei: uei.trim() || undefined,
        }),
      });

      if (res.status === 409) {
        const data = await res.json();
        // Already in progress — load it
        await pollReport(data.researchId);
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to start research");
      }

      const data = await res.json();
      setActiveReport(data.research);
      setCompanyName("");
      setCageCode("");
      setUei("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start research");
    } finally {
      setSearching(false);
    }
  };

  // View a past report
  const viewReport = async (report: CompanyResearch) => {
    setActiveReport(report);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const isResearching =
    activeReport?.status === "pending" ||
    activeReport?.status === "researching";

  const spending = activeReport?.spending_report as CompanyResearch["spending_report"];
  const perplexity = activeReport?.perplexity_report as CompanyResearch["perplexity_report"];
  const opportunities = activeReport?.matched_opportunities as CompanyResearch["matched_opportunities"];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Company Research</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Look up any company — pull their federal contract history, run AI
          research, and find matching opportunities to pitch them on.
        </p>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="mb-8">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Enter company name (e.g. Booz Allen Hamilton, Leidos, SAIC...)"
                className="w-full rounded-lg border border-border bg-background py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <Button type="submit" disabled={!companyName.trim() || searching} className="gap-2 shrink-0">
              {searching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Telescope className="h-4 w-4" />
              )}
              Research
            </Button>
          </div>

          {/* Advanced fields */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {showAdvanced ? "Hide" : "Show"} advanced fields (CAGE code, UEI)
          </button>

          {showAdvanced && (
            <div className="mt-3 flex gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  CAGE Code
                </label>
                <input
                  type="text"
                  value={cageCode}
                  onChange={(e) => setCageCode(e.target.value)}
                  placeholder="e.g. 1WAV9"
                  maxLength={5}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  UEI Number
                </label>
                <input
                  type="text"
                  value={uei}
                  onChange={(e) => setUei(e.target.value)}
                  placeholder="e.g. J1NSCHZ3HL86"
                  maxLength={12}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          )}
        </div>
      </form>

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        </div>
      )}

      {/* Researching state */}
      {isResearching && (
        <div className="mb-6 rounded-xl border border-purple-200 bg-purple-50 p-6 text-center">
          <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-purple-600" />
          <p className="text-sm font-medium text-purple-800">
            Researching {activeReport?.search_company_name}...
          </p>
          <p className="mt-1 text-xs text-purple-600">
            Pulling federal contract data from USASpending.gov, running AI web
            research via Perplexity, and searching for matching opportunities.
            This takes 30-60 seconds.
          </p>
        </div>
      )}

      {/* Active report */}
      {activeReport?.status === "complete" && (
        <div className="space-y-4 mb-10">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground">
              {activeReport.search_company_name}
            </h2>
            <div className="flex items-center gap-2">
              <StatusBadge status={activeReport.status as ResearchStatus} />
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportResearchReport(activeReport)}
                className="gap-1.5 text-xs"
              >
                <Download className="h-3.5 w-3.5" />
                Export Report
              </Button>
              {(activeReport.matched_opportunities as CompanyResearch["matched_opportunities"])?.length ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportOpportunitiesCSV(
                    activeReport.matched_opportunities as CompanyResearch["matched_opportunities"],
                    activeReport.search_company_name
                  )}
                  className="gap-1.5 text-xs"
                >
                  <Download className="h-3.5 w-3.5" />
                  Export Opps CSV
                </Button>
              ) : null}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveReport(null)}
                className="text-xs text-muted-foreground"
              >
                Clear
              </Button>
            </div>
          </div>

          {/* Executive Briefing */}
          {activeReport.executive_briefing && (
            <Section title="Executive Briefing" icon={Brain} defaultOpen={true}>
              <div className="space-y-4">
                <MarkdownContent content={activeReport.executive_briefing} />

                {activeReport.key_talking_points?.length ? (
                  <div className="mt-4 rounded-lg bg-primary/5 p-4">
                    <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary mb-3">
                      <Lightbulb className="h-3.5 w-3.5" />
                      Key Talking Points
                    </h4>
                    <ul className="space-y-2">
                      {activeReport.key_talking_points.map((point, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-sm text-foreground"
                        >
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                            {i + 1}
                          </span>
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {activeReport.recommended_services?.length ? (
                  <div className="flex flex-wrap gap-2 mt-3">
                    <span className="text-xs font-medium text-muted-foreground">
                      Pitch these services:
                    </span>
                    {activeReport.recommended_services.map((s, i) => (
                      <span
                        key={i}
                        className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </Section>
          )}

          {/* USASpending */}
          {spending && spending.total_awards > 0 && (
            <Section
              title={`Federal Spending — ${spending.total_awards} Awards (${formatCurrency(spending.total_obligation)})`}
              icon={DollarSign}
            >
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-lg border border-border p-3 text-center">
                    <p className="text-lg font-bold text-foreground">
                      {spending.total_awards}
                    </p>
                    <p className="text-xs text-muted-foreground">Total Awards</p>
                  </div>
                  <div className="rounded-lg border border-border p-3 text-center">
                    <p className="text-lg font-bold text-foreground">
                      {formatCurrency(spending.total_obligation)}
                    </p>
                    <p className="text-xs text-muted-foreground">Total Value</p>
                  </div>
                  <div className="rounded-lg border border-border p-3 text-center">
                    <p className="text-lg font-bold text-foreground">
                      {spending.agency_breakdown?.length || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Agencies</p>
                  </div>
                  <div className="rounded-lg border border-border p-3 text-center">
                    <p className="text-lg font-bold text-foreground">
                      {spending.naics_breakdown?.length || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">NAICS Codes</p>
                  </div>
                </div>

                {spending.agency_breakdown?.length ? (
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      Top Agencies
                    </h4>
                    <div className="space-y-1.5">
                      {spending.agency_breakdown.slice(0, 8).map((a, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between text-sm"
                        >
                          <span className="text-foreground truncate mr-3">
                            {a.agency_name}
                          </span>
                          <span className="shrink-0 text-muted-foreground">
                            {formatCurrency(a.total_obligation)} ({a.award_count}{" "}
                            awards)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {spending.recent_awards?.length ? (
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      Recent Awards
                    </h4>
                    <div className="space-y-2">
                      {spending.recent_awards.slice(0, 5).map((a, i) => (
                        <div
                          key={i}
                          className="rounded-lg border border-border p-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium text-foreground line-clamp-2">
                              {a.description || a.award_id}
                            </p>
                            <span className="shrink-0 text-sm font-semibold text-foreground">
                              {formatCurrency(a.total_obligation)}
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                            {a.awarding_agency_name && (
                              <span>{a.awarding_agency_name}</span>
                            )}
                            {a.naics_code && <span>NAICS: {a.naics_code}</span>}
                            {a.date_signed && (
                              <span>Signed: {formatDate(a.date_signed)}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </Section>
          )}

          {/* Perplexity Research */}
          {perplexity && perplexity.company_overview && (
            <>
              <Section title="Company Overview & Leadership" icon={Building2}>
                <div className="space-y-4">
                  <MarkdownContent content={perplexity.company_overview} />
                  {perplexity.leadership && (
                    <>
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-4">
                        Leadership & Key Decision Makers
                      </h4>
                      <MarkdownContent content={perplexity.leadership} />
                    </>
                  )}
                </div>
              </Section>

              <Section title="Contracts & Competitive Intel" icon={TrendingUp}>
                <div className="space-y-4">
                  {perplexity.recent_contracts_and_wins && (
                    <>
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Recent Contracts & Wins
                      </h4>
                      <MarkdownContent content={perplexity.recent_contracts_and_wins} />
                    </>
                  )}
                  {perplexity.competitive_landscape && (
                    <>
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-4">
                        Competitive Landscape
                      </h4>
                      <MarkdownContent content={perplexity.competitive_landscape} />
                    </>
                  )}
                  {perplexity.partnerships_and_teaming && (
                    <>
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-4">
                        Partnerships & Teaming
                      </h4>
                      <MarkdownContent content={perplexity.partnerships_and_teaming} />
                    </>
                  )}
                </div>
              </Section>

              {(perplexity.technology_and_capabilities ||
                perplexity.news_and_developments ||
                perplexity.financial_health) && (
                <Section
                  title="Tech, News & Financial Health"
                  icon={FileText}
                  defaultOpen={false}
                >
                  <div className="space-y-4">
                    {perplexity.technology_and_capabilities && (
                      <>
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Technology & Capabilities
                        </h4>
                        <MarkdownContent content={perplexity.technology_and_capabilities} />
                      </>
                    )}
                    {perplexity.news_and_developments && (
                      <>
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-4">
                          News & Developments
                        </h4>
                        <MarkdownContent content={perplexity.news_and_developments} />
                      </>
                    )}
                    {perplexity.financial_health && (
                      <>
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-4">
                          Financial Health
                        </h4>
                        <MarkdownContent content={perplexity.financial_health} />
                      </>
                    )}
                  </div>
                </Section>
              )}

              {perplexity.sources?.length ? (
                <Section title="Sources" icon={ExternalLink} defaultOpen={false}>
                  <ul className="space-y-1">
                    {perplexity.sources.map((s, i) => (
                      <li key={i} className="text-xs text-muted-foreground truncate">
                        <a
                          href={s}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {s}
                        </a>
                      </li>
                    ))}
                  </ul>
                </Section>
              ) : null}
            </>
          )}

          {/* Matching Opportunities */}
          {opportunities?.length ? (
            <Section
              title={`Matching Opportunities (${opportunities.length})`}
              icon={Target}
            >
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground mb-3">
                  Active SAM.gov opportunities matching this company&apos;s NAICS
                  codes. Use these to pitch them on our proposal services.
                </p>
                {opportunities.map((opp, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-border p-3 hover:bg-muted/20 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground line-clamp-2">
                          {opp.title}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                          <span>{opp.department}</span>
                          {opp.solicitation_number && (
                            <span>{opp.solicitation_number}</span>
                          )}
                          {opp.naics_code && <span>NAICS: {opp.naics_code}</span>}
                          {opp.response_deadline && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDate(opp.response_deadline)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          <p className="text-xs text-muted-foreground text-center pt-2">
            Research generated {formatDate(activeReport.created_at)}
          </p>
        </div>
      )}

      {/* Failed state */}
      {activeReport?.status === "failed" && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <AlertCircle className="mx-auto mb-2 h-5 w-5 text-red-500" />
          <p className="text-sm text-red-700">
            Research failed: {activeReport.error_message || "Unknown error"}
          </p>
        </div>
      )}

      {/* Past Research History */}
      {!loading && pastReports.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Past Research
          </h2>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Company
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Awards
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Date
                  </th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pastReports.map((r) => {
                  const sp = r.spending_report as CompanyResearch["spending_report"];
                  return (
                    <tr
                      key={r.id}
                      className="group transition-colors hover:bg-muted/20"
                    >
                      <td className="px-5 py-3">
                        <span className="font-semibold text-foreground">
                          {r.search_company_name}
                        </span>
                        {r.search_cage_code && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            CAGE: {r.search_cage_code}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={r.status as ResearchStatus} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {sp?.total_awards != null ? (
                          <span>
                            {sp.total_awards} ({formatCurrency(sp.total_obligation)})
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatDate(r.created_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {r.status === "complete" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => viewReport(r)}
                            className="gap-1.5 text-xs"
                          >
                            View
                            <ArrowRight className="h-3 w-3" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && pastReports.length === 0 && !activeReport && (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
          <Telescope className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm font-medium text-foreground">
            No research yet.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Search for any company above to pull federal spending data, run AI
            web research, and find matching opportunities.
          </p>
        </div>
      )}
    </div>
  );
}
