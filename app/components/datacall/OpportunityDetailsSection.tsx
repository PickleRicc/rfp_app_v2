"use client";

import type {
  DataCallSection,
  OpportunityDetails,
} from "@/lib/supabase/tier2-types";

// ============================================================
// Types
// ============================================================

export interface OpportunityDetailsSectionProps {
  section: DataCallSection;
  data: OpportunityDetails;
  onChange: (data: OpportunityDetails) => void;
}

// ============================================================
// Helpers
// ============================================================

function RequiredMark() {
  return <span className="ml-0.5 text-red-500" aria-hidden="true">*</span>;
}

function Citation({ text }: { text: string }) {
  return (
    <span className="mt-0.5 block text-xs italic text-muted-foreground">
      {text}
    </span>
  );
}

// ============================================================
// OpportunityDetailsSection
// ============================================================

export function OpportunityDetailsSection({
  section,
  data,
  onChange,
}: OpportunityDetailsSectionProps) {
  // Build a field lookup from the schema so we have rfp_citation and required per field
  const fieldMeta = Object.fromEntries(section.fields.map((f) => [f.key, f]));

  const update = <K extends keyof OpportunityDetails>(
    key: K,
    value: OpportunityDetails[K]
  ) => {
    onChange({ ...data, [key]: value });
  };

  return (
    <div className="space-y-5">
      {/* prime_or_sub */}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-foreground">
          {fieldMeta["prime_or_sub"]?.label ?? "Prime or Sub"}
          {fieldMeta["prime_or_sub"]?.required && <RequiredMark />}
        </label>
        {fieldMeta["prime_or_sub"]?.rfp_citation && (
          <Citation text={fieldMeta["prime_or_sub"].rfp_citation} />
        )}
        <select
          value={data?.prime_or_sub ?? ""}
          onChange={(e) =>
            update(
              "prime_or_sub",
              (e.target.value as OpportunityDetails["prime_or_sub"]) || null
            )
          }
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select role...</option>
          <option value="prime">Prime</option>
          <option value="sub">Sub</option>
          <option value="teaming">Teaming Partner</option>
        </select>
      </div>

      {/* teaming_partners */}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-foreground">
          {fieldMeta["teaming_partners"]?.label ?? "Teaming Partners"}
          {fieldMeta["teaming_partners"]?.required && <RequiredMark />}
        </label>
        {fieldMeta["teaming_partners"]?.rfp_citation && (
          <Citation text={fieldMeta["teaming_partners"].rfp_citation} />
        )}
        <textarea
          value={(data?.teaming_partners ?? []).join("\n")}
          onChange={(e) =>
            update(
              "teaming_partners",
              e.target.value
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean)
            )
          }
          placeholder="One partner per line..."
          rows={3}
          className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-muted-foreground">One partner name per line</p>
      </div>

      {/* contract_type */}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-foreground">
          {fieldMeta["contract_type"]?.label ?? "Contract Type"}
          {fieldMeta["contract_type"]?.required && <RequiredMark />}
        </label>
        {fieldMeta["contract_type"]?.rfp_citation && (
          <Citation text={fieldMeta["contract_type"].rfp_citation} />
        )}
        <input
          type="text"
          value={data?.contract_type ?? ""}
          onChange={(e) => update("contract_type", e.target.value || null)}
          placeholder={
            (fieldMeta["contract_type"]?.default_value as string) ||
            "e.g., FFP, CPFF, T&M"
          }
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* naics_code */}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-foreground">
          {fieldMeta["naics_code"]?.label ?? "NAICS Code"}
          {fieldMeta["naics_code"]?.required && <RequiredMark />}
        </label>
        {fieldMeta["naics_code"]?.rfp_citation && (
          <Citation text={fieldMeta["naics_code"].rfp_citation} />
        )}
        <input
          type="text"
          value={data?.naics_code ?? ""}
          onChange={(e) => update("naics_code", e.target.value || null)}
          placeholder={
            (fieldMeta["naics_code"]?.default_value as string) || "e.g., 541330"
          }
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* size_standard */}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-foreground">
          {fieldMeta["size_standard"]?.label ?? "Size Standard"}
          {fieldMeta["size_standard"]?.required && <RequiredMark />}
        </label>
        {fieldMeta["size_standard"]?.rfp_citation && (
          <Citation text={fieldMeta["size_standard"].rfp_citation} />
        )}
        <input
          type="text"
          value={data?.size_standard ?? ""}
          onChange={(e) => update("size_standard", e.target.value || null)}
          placeholder={
            (fieldMeta["size_standard"]?.default_value as string) || "e.g., $47M"
          }
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* set_aside */}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-foreground">
          {fieldMeta["set_aside"]?.label ?? "Set-Aside"}
          {fieldMeta["set_aside"]?.required && <RequiredMark />}
        </label>
        {fieldMeta["set_aside"]?.rfp_citation && (
          <Citation text={fieldMeta["set_aside"].rfp_citation} />
        )}
        <input
          type="text"
          value={data?.set_aside ?? ""}
          onChange={(e) => update("set_aside", e.target.value || null)}
          placeholder={
            (fieldMeta["set_aside"]?.default_value as string) ||
            "e.g., SDVOSB, 8(a), Full and Open"
          }
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
  );
}
