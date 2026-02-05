"use client";

import { useEffect, useState } from "react";
import { FileText, Loader2, BarChart3, X, CheckCircle, Clock, FileCheck } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { cn } from "@/lib/utils";

/** High-contrast colors per client status so they stand out from each other. */
const CLIENT_STATUS_STYLES: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  Pending: {
    bg: "bg-slate-100 dark:bg-slate-800/60",
    text: "text-slate-700 dark:text-slate-300",
    border: "border-slate-300 dark:border-slate-600",
  },
  Submitted: {
    bg: "bg-blue-100 dark:bg-blue-900/50",
    text: "text-blue-800 dark:text-blue-200",
    border: "border-blue-400 dark:border-blue-600",
  },
  "Under review": {
    bg: "bg-amber-100 dark:bg-amber-900/50",
    text: "text-amber-800 dark:text-amber-200",
    border: "border-amber-400 dark:border-amber-600",
  },
  "In progress": {
    bg: "bg-primary/15 dark:bg-primary/25",
    text: "text-primary dark:text-primary",
    border: "border-primary/50 dark:border-primary/60",
  },
  "Ready for review": {
    bg: "bg-violet-100 dark:bg-violet-900/50",
    text: "text-violet-800 dark:text-violet-200",
    border: "border-violet-400 dark:border-violet-600",
  },
  Complete: {
    bg: "bg-emerald-100 dark:bg-emerald-900/50",
    text: "text-emerald-800 dark:text-emerald-200",
    border: "border-emerald-400 dark:border-emerald-600",
  },
};

function getClientStatusStyle(status: string) {
  return (
    CLIENT_STATUS_STYLES[status] ?? CLIENT_STATUS_STYLES["Pending"]
  );
}

interface PortalDocument {
  id: string;
  filename: string;
  document_type: string;
  created_at: string;
  updated_at: string;
  client_status: string;
  proposal: {
    responseId: string;
    canDownload: boolean;
  } | null;
}

interface PortalStats {
  total: number;
  readyForYou: number;
  byStatus: Record<string, number>;
  lastUpdated: string | null;
  newThisMonth: number;
}

export default function PortalDashboardPage() {
  const [documents, setDocuments] = useState<PortalDocument[]>([]);
  const [stats, setStats] = useState<PortalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statsModalOpen, setStatsModalOpen] = useState(false);

  useEffect(() => {
    const fetchDocs = async () => {
      try {
        const res = await fetch("/api/portal/documents");
        if (!res.ok) {
          setError("Failed to load proposals");
          return;
        }
        const data = await res.json();
        setDocuments(data.documents ?? []);
        setStats(data.stats ?? null);
      } catch {
        setError("Failed to load proposals");
      } finally {
        setLoading(false);
      }
    };
    fetchDocs();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading your proposals...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Your proposals</h1>
          <p className="text-muted-foreground mt-1">
            Status is updated by our team. You only see updates we push to you.
          </p>
        </div>
        {stats && stats.total > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2 shrink-0"
            onClick={() => setStatsModalOpen(true)}
          >
            <BarChart3 className="h-4 w-4" />
            View stats
          </Button>
        )}
      </div>

      {stats && documents.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard
            label="Total proposals"
            value={stats.total}
            icon={FileText}
            className="bg-primary/5 border-primary/20"
          />
          <StatCard
            label="Complete"
            value={stats.readyForYou}
            icon={CheckCircle}
            className="bg-success/5 border-success/20"
          />
          <StatCard
            label="New this month"
            value={stats.newThisMonth}
            icon={Clock}
            className="bg-muted/50 border-border"
          />
          <StatCard
            label="Last updated"
            value={
              stats.lastUpdated
                ? new Date(stats.lastUpdated).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : "—"
            }
            icon={FileCheck}
            className="bg-muted/50 border-border"
          />
        </div>
      )}

      {statsModalOpen && stats && (
        <StatsModal stats={stats} onClose={() => setStatsModalOpen(false)} />
      )}

      {documents.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
          <h2 className="mt-4 text-lg font-semibold text-foreground">No proposals yet</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            When our team adds a proposal for your company, it will appear here with its status.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className={cn(
                "rounded-lg border border-border bg-card p-4 sm:p-5",
                "flex items-start gap-3"
              )}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground truncate">{doc.filename}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Uploaded {new Date(doc.created_at).toLocaleDateString()}
                </p>
                <div className="mt-2">
                  {(() => {
                    const style = getClientStatusStyle(doc.client_status);
                    return (
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-xs font-medium border",
                          style.bg,
                          style.text,
                          style.border
                        )}
                      >
                        {doc.client_status}
                      </Badge>
                    );
                  })()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  className,
}: {
  label: string;
  value: number | string;
  icon: typeof FileText;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4 flex items-center gap-3",
        className
      )}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-background">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-foreground tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground truncate">{label}</p>
      </div>
    </div>
  );
}

function StatsModal({
  stats,
  onClose,
}: {
  stats: PortalStats;
  onClose: () => void;
}) {
  const statusEntries = Object.entries(stats.byStatus).sort(
    (a, b) => b[1] - a[1]
  );
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-border bg-card shadow-xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Proposal stats
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
              <p className="text-3xl font-bold text-foreground tabular-nums">
                {stats.total}
              </p>
              <p className="text-sm text-muted-foreground">Total proposals</p>
            </div>
            <div className="rounded-lg bg-success/5 border border-success/20 p-4">
              <p className="text-3xl font-bold text-foreground tabular-nums">
                {stats.readyForYou}
              </p>
              <p className="text-sm text-muted-foreground">Complete</p>
            </div>
            <div className="rounded-lg bg-muted/50 border border-border p-4">
              <p className="text-3xl font-bold text-foreground tabular-nums">
                {stats.newThisMonth}
              </p>
              <p className="text-sm text-muted-foreground">New this month</p>
            </div>
            <div className="rounded-lg bg-muted/50 border border-border p-4">
              <p className="text-lg font-bold text-foreground tabular-nums leading-tight">
                {stats.lastUpdated
                  ? new Date(stats.lastUpdated).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "—"}
              </p>
              <p className="text-sm text-muted-foreground">Last updated</p>
            </div>
          </div>
          {statusEntries.length > 0 && (
            <div>
              <p className="text-sm font-medium text-foreground mb-3">
                By status
              </p>
              <div className="space-y-2">
                {statusEntries.map(([status, count]) => {
                  const style = getClientStatusStyle(status);
                  return (
                    <div
                      key={status}
                      className={cn(
                        "flex items-center justify-between rounded-lg border px-3 py-2",
                        style.bg,
                        style.border
                      )}
                    >
                      <span className={cn("text-sm font-medium", style.text)}>
                        {status}
                      </span>
                      <span
                        className={cn(
                          "text-sm font-semibold tabular-nums",
                          style.text
                        )}
                      >
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <Button className="w-full mt-6" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  );
}
