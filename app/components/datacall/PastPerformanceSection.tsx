"use client";

import { Trash2, PlusCircle } from "lucide-react";
import type {
  DataCallSection,
  PastPerformanceRef,
  DataCallFile,
} from "@/lib/supabase/tier2-types";

// ============================================================
// Types
// ============================================================

export interface PastPerformanceSectionProps {
  section: DataCallSection;
  data: PastPerformanceRef[];
  onChange: (data: PastPerformanceRef[]) => void;
  files: DataCallFile[];
  companyId: string;
  solicitationId: string;
}

// ============================================================
// Helpers
// ============================================================

function RequiredMark() {
  return (
    <span className="ml-0.5 text-red-500" aria-hidden="true">
      *
    </span>
  );
}

function Citation({ text }: { text: string }) {
  return (
    <span className="mt-0.5 block text-xs italic text-muted-foreground">
      {text}
    </span>
  );
}

function emptyRef(): PastPerformanceRef {
  return {
    project_name: "",
    client_agency: "",
    contract_number: "",
    contract_value: "",
    period_of_performance: "",
    relevance_summary: "",
    contact_name: "",
    contact_email: "",
    contact_phone: "",
  };
}

// ============================================================
// Single reference card
// ============================================================

interface RefCardProps {
  index: number;
  ref_: PastPerformanceRef;
  section: DataCallSection;
  showRemove: boolean;
  onChange: (updated: PastPerformanceRef) => void;
  onRemove: () => void;
}

function RefCard({
  index,
  ref_,
  section,
  showRemove,
  onChange,
  onRemove,
}: RefCardProps) {
  const fieldMeta = Object.fromEntries(section.fields.map((f) => [f.key, f]));

  const update = <K extends keyof PastPerformanceRef>(
    key: K,
    value: PastPerformanceRef[K]
  ) => {
    onChange({ ...ref_, [key]: value });
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      {/* Card header */}
      <div className="mb-4 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground">
          Reference {index + 1}
        </h4>
        {showRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors"
            aria-label={`Remove reference ${index + 1}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove
          </button>
        )}
      </div>

      <div className="space-y-4">
        {/* project_name */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-foreground">
            {fieldMeta["project_name"]?.label ?? "Project Name"}
            {fieldMeta["project_name"]?.required !== false && <RequiredMark />}
          </label>
          {fieldMeta["project_name"]?.rfp_citation && (
            <Citation text={fieldMeta["project_name"].rfp_citation} />
          )}
          <input
            type="text"
            value={ref_.project_name}
            onChange={(e) => update("project_name", e.target.value)}
            placeholder="e.g., Enterprise Cloud Migration"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* client_agency */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-foreground">
            {fieldMeta["client_agency"]?.label ?? "Client / Agency"}
            {fieldMeta["client_agency"]?.required !== false && <RequiredMark />}
          </label>
          {fieldMeta["client_agency"]?.rfp_citation && (
            <Citation text={fieldMeta["client_agency"].rfp_citation} />
          )}
          <input
            type="text"
            value={ref_.client_agency}
            onChange={(e) => update("client_agency", e.target.value)}
            placeholder="e.g., Department of Defense"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* contract_number and contract_value on same row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-foreground">
              {fieldMeta["contract_number"]?.label ?? "Contract Number"}
              {fieldMeta["contract_number"]?.required !== false && (
                <RequiredMark />
              )}
            </label>
            {fieldMeta["contract_number"]?.rfp_citation && (
              <Citation text={fieldMeta["contract_number"].rfp_citation} />
            )}
            <input
              type="text"
              value={ref_.contract_number}
              onChange={(e) => update("contract_number", e.target.value)}
              placeholder="e.g., W911NF-21-C-0001"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-foreground">
              {fieldMeta["contract_value"]?.label ?? "Contract Value"}
            </label>
            {fieldMeta["contract_value"]?.rfp_citation && (
              <Citation text={fieldMeta["contract_value"].rfp_citation} />
            )}
            <input
              type="text"
              value={ref_.contract_value}
              onChange={(e) => update("contract_value", e.target.value)}
              placeholder="e.g., $2.4M"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* period_of_performance */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-foreground">
            {fieldMeta["period_of_performance"]?.label ?? "Period of Performance"}
            {fieldMeta["period_of_performance"]?.required !== false && (
              <RequiredMark />
            )}
          </label>
          {fieldMeta["period_of_performance"]?.rfp_citation && (
            <Citation text={fieldMeta["period_of_performance"].rfp_citation} />
          )}
          <input
            type="text"
            value={ref_.period_of_performance}
            onChange={(e) => update("period_of_performance", e.target.value)}
            placeholder="e.g., Jan 2021 — Dec 2023"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* relevance_summary */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-foreground">
            {fieldMeta["relevance_summary"]?.label ?? "Relevance Summary"}
            {fieldMeta["relevance_summary"]?.required !== false && (
              <RequiredMark />
            )}
          </label>
          {fieldMeta["relevance_summary"]?.rfp_citation && (
            <Citation text={fieldMeta["relevance_summary"].rfp_citation} />
          )}
          <textarea
            value={ref_.relevance_summary}
            onChange={(e) => update("relevance_summary", e.target.value)}
            placeholder={
              section.description
                ? `Describe relevance to this requirement. ${section.description.slice(0, 80)}...`
                : "Describe how this reference is relevant to the current RFP..."
            }
            rows={3}
            className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Contact row */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-foreground">
              {fieldMeta["contact_name"]?.label ?? "Contact Name"}
              {fieldMeta["contact_name"]?.required !== false && <RequiredMark />}
            </label>
            {fieldMeta["contact_name"]?.rfp_citation && (
              <Citation text={fieldMeta["contact_name"].rfp_citation} />
            )}
            <input
              type="text"
              value={ref_.contact_name}
              onChange={(e) => update("contact_name", e.target.value)}
              placeholder="COR / POC name"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-foreground">
              {fieldMeta["contact_email"]?.label ?? "Contact Email"}
              {fieldMeta["contact_email"]?.required !== false && <RequiredMark />}
            </label>
            {fieldMeta["contact_email"]?.rfp_citation && (
              <Citation text={fieldMeta["contact_email"].rfp_citation} />
            )}
            <input
              type="email"
              value={ref_.contact_email}
              onChange={(e) => update("contact_email", e.target.value)}
              placeholder="email@agency.gov"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-foreground">
              {fieldMeta["contact_phone"]?.label ?? "Contact Phone"}
            </label>
            {fieldMeta["contact_phone"]?.rfp_citation && (
              <Citation text={fieldMeta["contact_phone"].rfp_citation} />
            )}
            <input
              type="tel"
              value={ref_.contact_phone}
              onChange={(e) => update("contact_phone", e.target.value)}
              placeholder="(555) 555-5555"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// PastPerformanceSection
// ============================================================

export function PastPerformanceSection({
  section,
  data,
  onChange,
}: PastPerformanceSectionProps) {
  // Ensure we always have an array to work with
  const refs: PastPerformanceRef[] = Array.isArray(data) && data.length > 0
    ? data
    : Array.from({ length: section.dynamic_count ?? 3 }, () => emptyRef());

  const handleCardChange = (index: number, updated: PastPerformanceRef) => {
    const next = [...refs];
    next[index] = updated;
    onChange(next);
  };

  const handleAdd = () => {
    onChange([...refs, emptyRef()]);
  };

  const handleRemove = (index: number) => {
    const next = refs.filter((_, i) => i !== index);
    onChange(next.length > 0 ? next : [emptyRef()]);
  };

  return (
    <div className="space-y-4">
      {/* Section description info banner */}
      {section.description && (
        <div className="rounded-md border-l-4 border-blue-400 bg-blue-50 py-3 pl-4 pr-3">
          <p className="text-sm text-blue-800">{section.description}</p>
        </div>
      )}

      {/* Dynamic count citation */}
      {section.dynamic_count_source && (
        <p className="text-xs italic text-muted-foreground">
          {section.dynamic_count_source}
        </p>
      )}

      {/* Reference cards */}
      <div className="space-y-4">
        {refs.map((ref_, i) => (
          <RefCard
            key={i}
            index={i}
            ref_={ref_}
            section={section}
            showRemove={refs.length > 1}
            onChange={(updated) => handleCardChange(i, updated)}
            onRemove={() => handleRemove(i)}
          />
        ))}
      </div>

      {/* Add Reference button */}
      <button
        type="button"
        onClick={handleAdd}
        className="flex items-center gap-2 rounded-lg border border-dashed border-border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:border-blue-400 hover:text-blue-600 transition-colors"
      >
        <PlusCircle className="h-4 w-4" />
        Add Reference
      </button>
    </div>
  );
}
