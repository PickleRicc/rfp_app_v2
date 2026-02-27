"use client";

import { useState, useEffect } from "react";
import {
  Loader2,
  AlertCircle,
  RefreshCw,
  Building2,
  Trophy,
  BookOpen,
  ClipboardList,
  Users,
  CheckCircle2,
  ArrowLeft,
  Zap,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  DraftGetResponse,
  StrategyConfirmation as StrategyConfirmationData,
} from "@/lib/supabase/draft-types";

// ============================================================
// Types
// ============================================================

export type GraphicsProfile = "minimal" | "standard";

export interface StrategyConfirmationProps {
  solicitationId: string;
  companyId: string;
  onGenerationStarted: (graphicsProfile: GraphicsProfile) => void;
  onTabChange?: (tabId: string) => void;
}

// ============================================================
// Prime/Sub role badge
// ============================================================

function RoleBadge({ role }: { role: string | null }) {
  const config: Record<string, { label: string; classes: string }> = {
    prime:    { label: "Prime",    classes: "bg-blue-100 text-blue-800 border-blue-200" },
    sub:      { label: "Sub",      classes: "bg-purple-100 text-purple-800 border-purple-200" },
    teaming:  { label: "Teaming", classes: "bg-amber-100 text-amber-800 border-amber-200" },
  };

  if (!role) {
    return (
      <span className="rounded-full border border-gray-200 bg-gray-100 px-3 py-0.5 text-xs font-medium text-gray-500">
        Not specified
      </span>
    );
  }

  const c = config[role] ?? { label: role, classes: "bg-gray-100 text-gray-700 border-gray-200" };
  return (
    <span className={cn("rounded-full border px-3 py-0.5 text-xs font-semibold", c.classes)}>
      {c.label}
    </span>
  );
}

// ============================================================
// Section card wrapper
// ============================================================

function SectionCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center gap-2.5 border-b border-border bg-muted/30 px-5 py-3.5">
        <span className="text-muted-foreground">{icon}</span>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

// ============================================================
// Field row for key-value pairs
// ============================================================

function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:gap-4">
      <dt className="w-40 flex-shrink-0 text-xs font-medium text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm text-foreground">{value}</dd>
    </div>
  );
}

// ============================================================
// Main StrategyConfirmation component
// ============================================================

export function StrategyConfirmation({
  solicitationId,
  companyId,
  onGenerationStarted,
  onTabChange,
}: StrategyConfirmationProps) {
  const [data, setData] = useState<DraftGetResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [graphicsProfile, setGraphicsProfile] = useState<GraphicsProfile>("minimal");

  // ============================================================
  // Load strategy confirmation data
  // ============================================================

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/solicitations/${solicitationId}/draft`, {
        headers: { "X-Company-Id": companyId },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed: ${res.status}`);
      }
      const json: DraftGetResponse = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load strategy.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solicitationId, companyId]);

  // ============================================================
  // Confirm & Generate handler
  // ============================================================

  const handleGenerate = async () => {
    if (posting) return;
    setPosting(true);
    setPostError(null);
    try {
      const res = await fetch(`/api/solicitations/${solicitationId}/draft`, {
        method: "POST",
        headers: {
          "X-Company-Id": companyId,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ graphicsProfile }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed: ${res.status}`);
      }
      onGenerationStarted(graphicsProfile);
    } catch (err) {
      setPostError(err instanceof Error ? err.message : "Failed to start generation.");
      setPosting(false);
    }
  };

  // ============================================================
  // Loading / error states
  // ============================================================

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">
          Loading strategy summary...
        </span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-700">
              {error ?? "Failed to load strategy summary."}
            </p>
            <button
              type="button"
              onClick={loadData}
              className="mt-2 flex items-center gap-1.5 text-xs font-medium text-red-600 underline hover:text-red-800"
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { strategy, draft } = data;
  const isExistingDraft =
    draft?.status === "completed" || draft?.status === "failed";
  const isGenerating = draft?.status === "generating";

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-bold text-foreground">
          Strategy Confirmation
        </h2>
        <p className="text-sm text-muted-foreground">
          Review the strategy summary below. This information will be used to
          generate your proposal draft. To make changes, return to the Data Call
          tab.
        </p>
      </div>

      {/* Existing draft warning */}
      {isExistingDraft && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-semibold text-amber-800">
              An existing draft will be replaced.
            </p>
            <p className="mt-0.5 text-xs text-amber-700">
              Regenerating will overwrite the current draft with no version
              history.
            </p>
          </div>
        </div>
      )}

      {/* ---- Card 1: Opportunity Overview ---- */}
      <SectionCard
        icon={<Building2 className="h-4 w-4" />}
        title="Opportunity Overview"
      >
        <dl className="divide-y divide-border/60">
          <FieldRow
            label="Prime / Sub Role"
            value={<RoleBadge role={strategy.prime_or_sub} />}
          />
          <FieldRow
            label="Contract Type"
            value={strategy.contract_type ?? (
              <span className="italic text-muted-foreground">Not specified</span>
            )}
          />
          <FieldRow
            label="NAICS Code"
            value={strategy.naics_code ?? (
              <span className="italic text-muted-foreground">Not specified</span>
            )}
          />
          <FieldRow
            label="Set-Aside"
            value={strategy.set_aside ?? (
              <span className="italic text-muted-foreground">None</span>
            )}
          />
          <FieldRow
            label="Teaming Partners"
            value={
              Array.isArray(strategy.teaming_partners) && strategy.teaming_partners.length > 0
                ? strategy.teaming_partners.join(", ")
                : <span className="italic text-muted-foreground">None</span>
            }
          />
        </dl>
      </SectionCard>

      {/* ---- Card 2: Win Themes & Differentiators ---- */}
      <SectionCard
        icon={<Trophy className="h-4 w-4" />}
        title="Win Themes & Differentiators"
      >
        {Array.isArray(strategy.enterprise_win_themes) && strategy.enterprise_win_themes.length > 0 ? (
          <ul className="space-y-1.5">
            {strategy.enterprise_win_themes.map((theme, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" />
                <span>{theme}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm italic text-muted-foreground">
            No win themes entered. Add them in your company profile (Tier 1).
          </p>
        )}
        {strategy.key_differentiators_summary && (
          <div className="mt-4 rounded-lg bg-muted/40 p-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              Key Differentiators
            </p>
            <p className="text-sm text-foreground">
              {strategy.key_differentiators_summary}
            </p>
          </div>
        )}
      </SectionCard>

      {/* ---- Card 3: Volume Structure ---- */}
      <SectionCard
        icon={<BookOpen className="h-4 w-4" />}
        title="Volume Structure"
      >
        {strategy.volume_structure.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2 pr-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    #
                  </th>
                  <th className="pb-2 pr-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Volume Name
                  </th>
                  <th className="pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Page Limit
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {strategy.volume_structure.map((vol, i) => (
                  <tr key={i}>
                    <td className="py-2 pr-4 text-muted-foreground">{i + 1}</td>
                    <td className="py-2 pr-4 font-medium text-foreground">{vol.name}</td>
                    <td className="py-2 text-muted-foreground">
                      {vol.page_limit != null ? `${vol.page_limit} pages` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm italic text-muted-foreground">
            No volume structure extracted. Default 4-volume structure will be
            used.
          </p>
        )}
      </SectionCard>

      {/* ---- Card 4: Evaluation Factors ---- */}
      <SectionCard
        icon={<ClipboardList className="h-4 w-4" />}
        title="Evaluation Factors"
      >
        {strategy.evaluation_factors.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2 pr-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Factor
                  </th>
                  <th className="pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Weight
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {strategy.evaluation_factors.map((factor, i) => (
                  <tr key={i}>
                    <td className="py-2 pr-4 font-medium text-foreground">
                      {factor.name}
                    </td>
                    <td className="py-2 text-muted-foreground">
                      {factor.weight ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm italic text-muted-foreground">
            No evaluation factors extracted from Section M.
          </p>
        )}
      </SectionCard>

      {/* ---- Card 5: Key Personnel ---- */}
      <SectionCard
        icon={<Users className="h-4 w-4" />}
        title="Key Personnel"
      >
        {strategy.key_personnel.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2 pr-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Role
                  </th>
                  <th className="pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Proposed Name
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {strategy.key_personnel.map((person, i) => (
                  <tr key={i}>
                    <td className="py-2 pr-4 font-medium text-foreground">{person.role}</td>
                    <td className="py-2 text-muted-foreground">{person.name || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm italic text-muted-foreground">
            No key personnel entered in the Data Call.
          </p>
        )}
      </SectionCard>

      {/* ---- Past Performance summary ---- */}
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-5 py-3.5 shadow-sm">
        <Trophy className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">Past Performance</span>
        <span className="ml-auto text-sm text-muted-foreground">
          {strategy.past_performance_count}{" "}
          reference{strategy.past_performance_count !== 1 ? "s" : ""} provided
        </span>
      </div>

      {/* ---- Graphics Profile ---- */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-2.5 border-b border-border bg-muted/30 px-5 py-3.5">
          <span className="text-sm font-semibold text-foreground">Graphics Profile</span>
        </div>
        <div className="px-5 py-4">
          <p className="mb-3 text-xs text-muted-foreground">
            Controls whether diagrams (org charts, timelines, process flows) are embedded in the generated DOCX.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setGraphicsProfile("minimal")}
              className={cn(
                "flex-1 rounded-lg border px-4 py-3 text-left transition-colors",
                graphicsProfile === "minimal"
                  ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                  : "border-border bg-card hover:bg-muted/50"
              )}
            >
              <p className="text-sm font-semibold text-foreground">Minimal</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Text only — no embedded diagrams
              </p>
            </button>
            <button
              type="button"
              onClick={() => setGraphicsProfile("standard")}
              className={cn(
                "flex-1 rounded-lg border px-4 py-3 text-left transition-colors",
                graphicsProfile === "standard"
                  ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                  : "border-border bg-card hover:bg-muted/50"
              )}
            >
              <p className="text-sm font-semibold text-foreground">Standard</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Includes org charts, timelines, and process flows
              </p>
            </button>
          </div>
        </div>
      </div>

      {/* ---- Post error ---- */}
      {postError && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
          <p className="text-sm text-red-700">{postError}</p>
        </div>
      )}

      {/* ---- Bottom action bar ---- */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4">
        {/* Back to Data Call */}
        <button
          type="button"
          onClick={() => onTabChange?.("data-call")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Data Call
        </button>

        {/* Primary action */}
        {isExistingDraft ? (
          <button
            type="button"
            onClick={handleGenerate}
            disabled={posting || isGenerating}
            className={cn(
              "flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors",
              posting || isGenerating
                ? "cursor-not-allowed bg-amber-400 text-white"
                : "bg-amber-500 text-white hover:bg-amber-600"
            )}
          >
            {posting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
            {posting ? "Starting..." : "Regenerate Draft"}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleGenerate}
            disabled={posting || isGenerating}
            className={cn(
              "flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors",
              posting || isGenerating
                ? "cursor-not-allowed bg-blue-400 text-white"
                : "bg-blue-600 text-white hover:bg-blue-700"
            )}
          >
            {posting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            {posting ? "Starting generation..." : "Confirm & Generate"}
          </button>
        )}
      </div>
    </div>
  );
}
