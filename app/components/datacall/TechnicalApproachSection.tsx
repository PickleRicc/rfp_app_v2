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
// TechnicalApproachSection — renders ALL fields from section.fields
// ============================================================

export function TechnicalApproachSection({
  section,
  data,
  onChange,
}: TechnicalApproachSectionProps) {
  const update = (key: string, value: string) => {
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

      {/* Render every field from the schema dynamically */}
      {section.fields.map((field) => (
        <div key={field.key} className="space-y-1">
          <label className="block text-sm font-medium text-foreground">
            {field.label}
            {field.required && <RequiredMark />}
          </label>
          {field.rfp_citation && <Citation text={field.rfp_citation} />}
          <textarea
            value={(data?.[field.key] as string) ?? ""}
            onChange={(e) => update(field.key, e.target.value)}
            placeholder={field.placeholder ?? ""}
            rows={field.key === "approach_summary" ? 5 : 4}
            style={{ minHeight: "100px" }}
            className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      ))}
    </div>
  );
}
