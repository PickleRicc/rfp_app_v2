"use client";

import type {
  DataCallSection,
  TechnicalApproach,
} from "@/lib/supabase/tier2-types";

// ============================================================
// Types
// ============================================================

export interface TechnicalApproachSectionProps {
  section: DataCallSection;
  data: TechnicalApproach;
  onChange: (data: TechnicalApproach) => void;
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

// ============================================================
// TechnicalApproachSection
// ============================================================

export function TechnicalApproachSection({
  section,
  data,
  onChange,
}: TechnicalApproachSectionProps) {
  const fieldMeta = Object.fromEntries(section.fields.map((f) => [f.key, f]));

  const update = <K extends keyof TechnicalApproach>(
    key: K,
    value: TechnicalApproach[K]
  ) => {
    onChange({ ...data, [key]: value });
  };

  return (
    <div className="space-y-5">
      {/* Section description info banner */}
      {section.description && (
        <div className="rounded-md border-l-4 border-blue-400 bg-blue-50 py-3 pl-4 pr-3">
          <p className="text-sm text-blue-800">{section.description}</p>
        </div>
      )}

      {/* approach_summary */}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-foreground">
          {fieldMeta["approach_summary"]?.label ?? "Technical Approach Summary"}
          {fieldMeta["approach_summary"]?.required && <RequiredMark />}
        </label>
        {fieldMeta["approach_summary"]?.rfp_citation && (
          <Citation text={fieldMeta["approach_summary"].rfp_citation} />
        )}
        <textarea
          value={data?.approach_summary ?? ""}
          onChange={(e) => update("approach_summary", e.target.value)}
          placeholder={
            fieldMeta["approach_summary"]?.placeholder ??
            "Describe your overall technical approach to this requirement..."
          }
          rows={5}
          style={{ minHeight: "100px" }}
          className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* tools_and_platforms */}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-foreground">
          {fieldMeta["tools_and_platforms"]?.label ?? "Tools & Platforms"}
          {fieldMeta["tools_and_platforms"]?.required && <RequiredMark />}
        </label>
        {fieldMeta["tools_and_platforms"]?.rfp_citation && (
          <Citation text={fieldMeta["tools_and_platforms"].rfp_citation} />
        )}
        <textarea
          value={data?.tools_and_platforms ?? ""}
          onChange={(e) => update("tools_and_platforms", e.target.value)}
          placeholder={
            fieldMeta["tools_and_platforms"]?.placeholder ??
            "List tools, platforms, and technologies you plan to use..."
          }
          rows={4}
          style={{ minHeight: "100px" }}
          className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* staffing_model */}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-foreground">
          {fieldMeta["staffing_model"]?.label ?? "Staffing Model"}
          {fieldMeta["staffing_model"]?.required && <RequiredMark />}
        </label>
        {fieldMeta["staffing_model"]?.rfp_citation && (
          <Citation text={fieldMeta["staffing_model"].rfp_citation} />
        )}
        <textarea
          value={data?.staffing_model ?? ""}
          onChange={(e) => update("staffing_model", e.target.value)}
          placeholder={
            fieldMeta["staffing_model"]?.placeholder ??
            "Describe your proposed staffing model..."
          }
          rows={4}
          style={{ minHeight: "100px" }}
          className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* assumptions */}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-foreground">
          {fieldMeta["assumptions"]?.label ?? "Assumptions"}
          {fieldMeta["assumptions"]?.required && <RequiredMark />}
        </label>
        {fieldMeta["assumptions"]?.rfp_citation && (
          <Citation text={fieldMeta["assumptions"].rfp_citation} />
        )}
        <textarea
          value={data?.assumptions ?? ""}
          onChange={(e) => update("assumptions", e.target.value)}
          placeholder={
            fieldMeta["assumptions"]?.placeholder ?? "List key assumptions..."
          }
          rows={4}
          style={{ minHeight: "100px" }}
          className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* risks */}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-foreground">
          {fieldMeta["risks"]?.label ?? "Risks & Mitigations"}
          {fieldMeta["risks"]?.required && <RequiredMark />}
        </label>
        {fieldMeta["risks"]?.rfp_citation && (
          <Citation text={fieldMeta["risks"].rfp_citation} />
        )}
        <textarea
          value={data?.risks ?? ""}
          onChange={(e) => update("risks", e.target.value)}
          placeholder={
            fieldMeta["risks"]?.placeholder ??
            "Identify risks and mitigation strategies..."
          }
          rows={4}
          style={{ minHeight: "100px" }}
          className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
  );
}
