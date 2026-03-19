"use client";

import { useState } from "react";
import {
  Search,
  Loader2,
  AlertCircle,
  Clock,
  Building2,
  Tag,
  FileText,
  Download,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Target,
} from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { SET_ASIDE_CODES } from "@/lib/samgov/client";
import type { TangoOpportunity } from "@/lib/samgov/client";

const PAGE_SIZE = 25;

function formatDate(d: string | null | undefined): string {
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

function daysUntil(d: string | null | undefined): number | null {
  if (!d) return null;
  const diff = new Date(d).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function DeadlineBadge({ deadline }: { deadline: string | null | undefined }) {
  const days = daysUntil(deadline);
  if (days === null) return <span className="text-muted-foreground">—</span>;
  const color =
    days < 7
      ? "text-red-600"
      : days < 21
      ? "text-amber-600"
      : "text-muted-foreground";
  return (
    <span className={`flex items-center gap-1 text-xs ${color}`}>
      <Clock className="h-3 w-3" />
      {formatDate(deadline)}
      {days >= 0 && (
        <span className="ml-1 font-medium">({days}d left)</span>
      )}
    </span>
  );
}

function exportToCSV(opportunities: TangoOpportunity[], filename = "opportunities.csv") {
  const headers = [
    "Title",
    "Department",
    "Sub-tier",
    "Office",
    "Solicitation Number",
    "Notice ID",
    "NAICS Code",
    "PSC Code",
    "Set-Aside",
    "Notice Type",
    "Posted Date",
    "Response Deadline",
    "Active",
  ];

  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };

  const rows = opportunities.map((o) => [
    escape(o.title),
    escape(o["department"] ?? o["agency"] ?? ""),
    escape(o["sub_tier"] ?? ""),
    escape(o["office"] ?? ""),
    escape(o.solicitation_number ?? ""),
    escape(o.opportunity_id),
    escape(o.naics_code ?? ""),
    escape(o.psc_code ?? ""),
    escape(o["set_aside_description"] ?? o["set_aside"] ?? ""),
    escape(o["type"] ?? o["notice_type"] ?? ""),
    escape(o["posted_date"] ?? ""),
    escape(o.response_deadline ?? ""),
    escape(o.active ?? true),
  ]);

  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function OpportunitiesPage() {
  const [keyword, setKeyword] = useState("");
  const [naics, setNaics] = useState("");
  const [setAside, setSetAside] = useState("");
  const [page, setPage] = useState(1);

  const [results, setResults] = useState<TangoOpportunity[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Track current search params so pagination re-uses them
  const [activeParams, setActiveParams] = useState<{
    keyword: string;
    naics: string;
    setAside: string;
  } | null>(null);

  const doSearch = async (params: { keyword: string; naics: string; setAside: string }, pageNum: number) => {
    setLoading(true);
    setError(null);

    const qs = new URLSearchParams();
    if (params.keyword) qs.set("keyword", params.keyword);
    if (params.naics) qs.set("naics", params.naics);
    if (params.setAside) qs.set("set_aside", params.setAside);
    qs.set("page", String(pageNum));
    qs.set("limit", String(PAGE_SIZE));

    try {
      const res = await fetch(`/api/opportunities/search?${qs}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Search failed");
      }
      const data = await res.json();
      setResults(data.opportunities || []);
      setTotalRecords(data.totalRecords || 0);
      setPage(pageNum);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
      setHasSearched(true);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword.trim() && !naics.trim() && !setAside) return;
    const params = { keyword: keyword.trim(), naics: naics.trim(), setAside };
    setActiveParams(params);
    await doSearch(params, 1);
  };

  const handlePage = async (newPage: number) => {
    if (!activeParams) return;
    await doSearch(activeParams, newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const totalPages = Math.ceil(totalRecords / PAGE_SIZE);

  const csvFilename = `opportunities-${activeParams?.keyword || activeParams?.naics || "search"}-${new Date().toISOString().slice(0, 10)}.csv`;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Opportunity Search</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Search active federal contract opportunities on SAM.gov by keyword, NAICS code, or set-aside.
        </p>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="mb-8">
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Keyword (e.g. cybersecurity, cloud services, logistics...)"
                className="w-full rounded-lg border border-border bg-background py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <Button
              type="submit"
              disabled={(!keyword.trim() && !naics.trim() && !setAside) || loading}
              className="gap-2 shrink-0"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Target className="h-4 w-4" />
              )}
              Search
            </Button>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                NAICS Code
              </label>
              <input
                type="text"
                value={naics}
                onChange={(e) => setNaics(e.target.value)}
                placeholder="e.g. 541511, 336411"
                maxLength={6}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Set-Aside
              </label>
              <select
                value={setAside}
                onChange={(e) => setSetAside(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Any</option>
                {Object.entries(SET_ASIDE_CODES).map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </form>

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        </div>
      )}

      {/* Results */}
      {hasSearched && !loading && (
        <>
          {/* Results header */}
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {results.length === 0
                ? "No opportunities found. Try a different keyword or NAICS code."
                : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, totalRecords)} of ${totalRecords.toLocaleString()} opportunities`}
            </p>
            {results.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportToCSV(results, csvFilename)}
                className="gap-2 text-xs"
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </Button>
            )}
          </div>

          {/* Opportunity cards */}
          {results.length > 0 && (
            <div className="space-y-3 mb-6">
              {results.map((opp) => {
                const department = (opp["department"] as string | undefined) || (opp["agency"] as string | undefined);
                const setAsideLabel = (opp["set_aside_description"] as string | undefined) || (opp["set_aside"] as string | undefined);
                return (
                <div
                  key={opp.opportunity_id}
                  className="rounded-xl border border-border bg-card p-4 hover:bg-muted/20 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground leading-snug">
                        {opp.title}
                      </p>

                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                        {department && (
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {department}
                          </span>
                        )}
                        {opp.solicitation_number && (
                          <span className="flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {opp.solicitation_number}
                          </span>
                        )}
                        {opp.naics_code && (
                          <span className="flex items-center gap-1">
                            <Tag className="h-3 w-3" />
                            NAICS {opp.naics_code}
                          </span>
                        )}
                        {setAsideLabel && (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-blue-800 font-medium">
                            {setAsideLabel}
                          </span>
                        )}
                      </div>

                      <div className="mt-2">
                        <DeadlineBadge deadline={opp.response_deadline} />
                      </div>

                      {opp.description && (
                        <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                          {opp.description}
                        </p>
                      )}
                    </div>

                    <a
                      href={`https://sam.gov/opp/${opp.opportunity_id}/view`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                    >
                      SAM.gov
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              );})}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePage(page - 1)}
                disabled={page <= 1 || loading}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </Button>
              <span className="text-sm text-muted-foreground px-2">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePage(page + 1)}
                disabled={page >= totalPages || loading}
                className="gap-1"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}

      {/* Loading overlay for pagination */}
      {loading && hasSearched && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* Empty state */}
      {!hasSearched && (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
          <Target className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm font-medium text-foreground">Search for opportunities</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter a keyword, NAICS code, or set-aside type to find active federal contract opportunities.
          </p>
        </div>
      )}
    </div>
  );
}
