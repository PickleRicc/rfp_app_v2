"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SmeContribution } from "@/lib/supabase/tier2-types";

// ============================================================
// Constants
// ============================================================

const TEXTAREA_MIN_ROWS = 5;
const CONTENT_PREVIEW_LENGTH = 120;

// ============================================================
// Types
// ============================================================

export interface SmeContributionsSectionProps {
  solicitationId: string;
  companyId: string;
  /** Volume names from Section L — populates the volume dropdown */
  availableVolumes: string[];
  /** RFP-derived topic suggestions from Section M factors and SOW service areas */
  suggestedTopics?: string[];
  /** Field labels from other data call sections, used for overlap detection */
  dataCallFieldLabels?: string[];
  /** Whether the current user has staff (PM) permissions to approve */
  isStaff: boolean;
  /** Called when approved count changes so parent can update section completion */
  onApprovedCountChange?: (count: number) => void;
}

// ============================================================
// Overlap detection helper
// ============================================================

/**
 * Check if a contribution topic closely matches any data call field label.
 * Returns true if a case-insensitive substring match is found in either direction.
 */
function hasDataCallOverlap(topic: string, fieldLabels: string[]): boolean {
  const t = topic.toLowerCase().trim();
  if (t.length < 4) return false; // Avoid matching trivially short strings
  return fieldLabels.some((label) => {
    const l = label.toLowerCase().trim();
    return l.length >= 4 && (t.includes(l) || l.includes(t));
  });
}

// ============================================================
// Sub-components
// ============================================================

function StatusBadge({ approved }: { approved: boolean }) {
  if (approved) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
        <CheckCircle2 size={11} />
        Approved
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
      <Clock size={11} />
      Pending Review
    </span>
  );
}

function ContributionCard({
  contribution,
  isStaff,
  onApprove,
  onRevoke,
  onDelete,
  approving,
  dataCallFieldLabels,
}: {
  contribution: SmeContribution;
  isStaff: boolean;
  onApprove: (id: string) => void;
  onRevoke: (id: string) => void;
  onDelete: (id: string) => void;
  approving: string | null;
  dataCallFieldLabels?: string[];
}) {
  const [expanded, setExpanded] = useState(false);
  const isLong = contribution.content.length > CONTENT_PREVIEW_LENGTH;
  const displayContent =
    !isLong || expanded
      ? contribution.content
      : contribution.content.slice(0, CONTENT_PREVIEW_LENGTH) + "…";

  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-4 transition-colors",
        contribution.approved ? "border-green-200" : "border-border"
      )}
    >
      {/* Header row */}
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-foreground">
              {contribution.topic}
            </span>
            <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              {contribution.volume_name}
            </span>
            <StatusBadge approved={contribution.approved} />
            {dataCallFieldLabels &&
              dataCallFieldLabels.length > 0 &&
              hasDataCallOverlap(contribution.topic, dataCallFieldLabels) && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                  <AlertTriangle size={10} />
                  May overlap with data call field
                </span>
              )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {contribution.contributor_name}
            {contribution.contributor_title ? ` — ${contribution.contributor_title}` : ""}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex shrink-0 items-center gap-1.5">
          {isStaff && !contribution.approved && (
            <button
              onClick={() => onApprove(contribution.id)}
              disabled={approving === contribution.id}
              className="rounded-md bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {approving === contribution.id ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                "Approve"
              )}
            </button>
          )}
          {isStaff && contribution.approved && (
            <button
              onClick={() => onRevoke(contribution.id)}
              className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted"
            >
              Revoke
            </button>
          )}
          <button
            onClick={() => onDelete(contribution.id)}
            className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            aria-label="Delete contribution"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Content preview */}
      <p className="whitespace-pre-wrap text-sm text-foreground/80">{displayContent}</p>
      {isLong && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-1 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
        >
          {expanded ? (
            <>
              <ChevronUp size={12} /> Show less
            </>
          ) : (
            <>
              <ChevronDown size={12} /> Show more
            </>
          )}
        </button>
      )}
    </div>
  );
}

// ============================================================
// New contribution form
// ============================================================

interface NewContributionForm {
  volume_name: string;
  topic: string;
  content: string;
  contributor_name: string;
  contributor_title: string;
}

const EMPTY_FORM: NewContributionForm = {
  volume_name: "",
  topic: "",
  content: "",
  contributor_name: "",
  contributor_title: "",
};

function AddContributionForm({
  availableVolumes,
  suggestedTopics,
  onSubmit,
  onCancel,
  submitting,
}: {
  availableVolumes: string[];
  suggestedTopics?: string[];
  onSubmit: (form: NewContributionForm) => void;
  onCancel: () => void;
  submitting: boolean;
}) {
  const [form, setForm] = useState<NewContributionForm>(EMPTY_FORM);

  const set = <K extends keyof NewContributionForm>(key: K, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const canSubmit =
    form.volume_name && form.topic.trim() && form.content.trim() && form.contributor_name.trim();

  return (
    <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50/40 p-4">
      <p className="text-sm font-medium text-foreground">New SME Contribution</p>

      {/* Volume + Topic row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">
            Proposal Volume <span className="text-red-500">*</span>
          </label>
          <select
            value={form.volume_name}
            onChange={(e) => set("volume_name", e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select volume…</option>
            {availableVolumes.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">
            Topic / Area <span className="text-red-500">*</span>
          </label>
          {suggestedTopics && suggestedTopics.length > 0 ? (
            <>
              <input
                list="sme-topic-suggestions"
                type="text"
                value={form.topic}
                onChange={(e) => set("topic", e.target.value)}
                placeholder="Start typing or select a suggested topic..."
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <datalist id="sme-topic-suggestions">
                {suggestedTopics.map((topic, i) => (
                  <option key={i} value={topic} />
                ))}
              </datalist>
              <p className="text-[11px] text-muted-foreground">
                Suggested topics are derived from Section M evaluation factors and SOW service areas.
              </p>
            </>
          ) : (
            <input
              type="text"
              value={form.topic}
              onChange={(e) => set("topic", e.target.value)}
              placeholder="e.g. Zero Trust Architecture"
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}
        </div>
      </div>

      {/* Contributor row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">
            Your Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.contributor_name}
            onChange={(e) => set("contributor_name", e.target.value)}
            placeholder="Full name"
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">Title</label>
          <input
            type="text"
            value={form.contributor_title}
            onChange={(e) => set("contributor_title", e.target.value)}
            placeholder="e.g. ZTA Architect"
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Content */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-foreground">
          Your Content <span className="text-red-500">*</span>
        </label>
        <p className="text-xs text-muted-foreground">
          Write your technical narrative, key points, or solution details. This will be injected
          directly into the proposal draft for this volume.
        </p>
        <textarea
          value={form.content}
          onChange={(e) => set("content", e.target.value)}
          placeholder="Describe your solution approach, key technical points, differentiators, or any specific content you want reflected in the proposal..."
          rows={TEXTAREA_MIN_ROWS}
          className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
        >
          Cancel
        </button>
        <button
          onClick={() => canSubmit && onSubmit(form)}
          disabled={!canSubmit || submitting}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? (
            <span className="flex items-center gap-1.5">
              <Loader2 size={13} className="animate-spin" /> Submitting…
            </span>
          ) : (
            "Submit Contribution"
          )}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Main component
// ============================================================

export function SmeContributionsSection({
  solicitationId,
  companyId,
  availableVolumes,
  suggestedTopics,
  dataCallFieldLabels,
  isStaff,
  onApprovedCountChange,
}: SmeContributionsSectionProps) {
  const [contributions, setContributions] = useState<SmeContribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [approving, setApproving] = useState<string | null>(null);

  const headers = {
    "Content-Type": "application/json",
    "X-Company-Id": companyId,
  };

  const fetchContributions = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/solicitations/${solicitationId}/sme-contributions`,
        { headers: { "X-Company-Id": companyId } }
      );
      if (!res.ok) throw new Error("Failed to load contributions");
      const data = await res.json();
      setContributions(data.contributions ?? []);
    } catch {
      setError("Could not load SME contributions.");
    } finally {
      setLoading(false);
    }
  }, [solicitationId, companyId]);

  useEffect(() => {
    fetchContributions();
  }, [fetchContributions]);

  useEffect(() => {
    const approvedCount = contributions.filter((c) => c.approved).length;
    onApprovedCountChange?.(approvedCount);
  }, [contributions, onApprovedCountChange]);

  const handleSubmit = async (form: NewContributionForm) => {
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/solicitations/${solicitationId}/sme-contributions`,
        { method: "POST", headers, body: JSON.stringify(form) }
      );
      if (!res.ok) throw new Error("Submit failed");
      const data = await res.json();
      setContributions((prev) => [...prev, data.contribution]);
      setShowForm(false);
    } catch {
      setError("Failed to submit contribution. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (id: string) => {
    setApproving(id);
    try {
      const res = await fetch(
        `/api/solicitations/${solicitationId}/sme-contributions/${id}`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({ approved: true, approved_by: "Proposal Manager" }),
        }
      );
      if (!res.ok) throw new Error("Approval failed");
      const data = await res.json();
      setContributions((prev) =>
        prev.map((c) => (c.id === id ? data.contribution : c))
      );
    } catch {
      setError("Failed to approve contribution.");
    } finally {
      setApproving(null);
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      const res = await fetch(
        `/api/solicitations/${solicitationId}/sme-contributions/${id}`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({ approved: false }),
        }
      );
      if (!res.ok) throw new Error("Revoke failed");
      const data = await res.json();
      setContributions((prev) =>
        prev.map((c) => (c.id === id ? data.contribution : c))
      );
    } catch {
      setError("Failed to revoke approval.");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(
        `/api/solicitations/${solicitationId}/sme-contributions/${id}`,
        { method: "DELETE", headers: { "X-Company-Id": companyId } }
      );
      setContributions((prev) => prev.filter((c) => c.id !== id));
    } catch {
      setError("Failed to delete contribution.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 size={18} className="animate-spin" />
      </div>
    );
  }

  const approvedCount = contributions.filter((c) => c.approved).length;
  const pendingCount = contributions.filter((c) => !c.approved).length;

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="rounded-md border-l-4 border-blue-400 bg-blue-50 py-3 pl-4 pr-3">
        <div className="flex items-start gap-2">
          <BookOpen size={15} className="mt-0.5 shrink-0 text-blue-600" />
          <div>
            <p className="text-sm font-medium text-blue-800">SME Contributions</p>
            <p className="text-xs text-blue-700">
              Subject matter experts can add detailed technical narratives here.{" "}
              {isStaff
                ? "Review and approve each contribution before generating the draft — approved content is injected directly into the AI prompt as authoritative source material."
                : "Your content will be reviewed by the Proposal Manager before being included in the draft."}
            </p>
          </div>
        </div>
      </div>

      {/* Stats row */}
      {contributions.length > 0 && (
        <div className="flex gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1 text-green-700">
            <CheckCircle2 size={12} /> {approvedCount} approved
          </span>
          {pendingCount > 0 && (
            <span className="flex items-center gap-1 text-amber-700">
              <Clock size={12} /> {pendingCount} pending review
            </span>
          )}
        </div>
      )}

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
      )}

      {/* Contribution cards */}
      {contributions.length === 0 && !showForm && (
        <p className="py-4 text-center text-sm text-muted-foreground">
          No contributions yet. Add the first one below.
        </p>
      )}

      <div className="space-y-3">
        {contributions.map((c) => (
          <ContributionCard
            key={c.id}
            contribution={c}
            isStaff={isStaff}
            onApprove={handleApprove}
            onRevoke={handleRevoke}
            onDelete={handleDelete}
            approving={approving}
            dataCallFieldLabels={dataCallFieldLabels}
          />
        ))}
      </div>

      {/* Add form or button */}
      {showForm ? (
        <AddContributionForm
          availableVolumes={availableVolumes}
          suggestedTopics={suggestedTopics}
          onSubmit={handleSubmit}
          onCancel={() => setShowForm(false)}
          submitting={submitting}
        />
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-3 text-sm text-muted-foreground transition-colors hover:border-blue-400 hover:text-blue-600"
        >
          <Plus size={15} />
          Add SME Contribution
        </button>
      )}
    </div>
  );
}
