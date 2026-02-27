"use client";

import type { DataCallSection } from "@/lib/supabase/tier2-types";

// ============================================================
// Types
// ============================================================

export interface DynamicArraySectionProps {
  section: DataCallSection;
  /** Array of objects — each object is one card in the section */
  data: Record<string, string>[];
  onChange: (data: Record<string, string>[]) => void;
  /** Keys that are read-only labels (pre-filled from extraction, not editable) */
  readOnlyKeys?: string[];
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
// DynamicArraySection
// ============================================================

/**
 * Generic component for rendering dynamic array sections in the data call form.
 * Used for Service Area Approaches, Site Staffing Plan, and Technology Selections.
 *
 * Each item in the array renders as a card with fields from the section schema.
 * Some fields (like area_code, area_name, site_name) are read-only labels
 * pre-filled from extractions; the rest are editable textareas.
 */
export function DynamicArraySection({
  section,
  data,
  onChange,
  readOnlyKeys = [],
}: DynamicArraySectionProps) {
  const updateItem = (index: number, key: string, value: string) => {
    const updated = [...data];
    updated[index] = { ...updated[index], [key]: value };
    onChange(updated);
  };

  // Separate label fields (read-only) from editable fields
  const labelFields = section.fields.filter((f) => readOnlyKeys.includes(f.key));
  const editableFields = section.fields.filter((f) => !readOnlyKeys.includes(f.key));

  return (
    <div className="space-y-5">
      {/* Section description info banner */}
      {section.description && (
        <div className="rounded-md border-l-4 border-blue-400 bg-blue-50 py-3 pl-4 pr-3">
          <p className="text-sm text-blue-800">{section.description}</p>
        </div>
      )}

      {/* Item count summary */}
      <p className="text-sm text-muted-foreground">
        {data.length} {data.length === 1 ? "item" : "items"} to complete
        {section.dynamic_count_source && (
          <span className="ml-1 text-xs italic">
            — {section.dynamic_count_source}
          </span>
        )}
      </p>

      {/* Cards */}
      {data.map((item, index) => {
        // Build a card title from label fields
        const cardTitle = labelFields
          .map((f) => item[f.key] || "")
          .filter(Boolean)
          .join(" — ") || `Item ${index + 1}`;

        return (
          <div
            key={index}
            className="rounded-lg border border-border bg-card shadow-sm"
          >
            {/* Card header */}
            <div className="border-b border-border bg-muted/30 px-4 py-3">
              <h4 className="text-sm font-semibold text-foreground">
                {cardTitle}
              </h4>
              {/* Show read-only label fields as metadata */}
              {labelFields.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                  {labelFields.map((f) => (
                    <span key={f.key} className="text-xs text-muted-foreground">
                      <span className="font-medium">{f.label}:</span>{" "}
                      {item[f.key] || "—"}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Card body — editable fields */}
            <div className="space-y-4 px-4 py-4">
              {editableFields.map((field) => {
                const value = item[field.key] ?? "";
                const isTextarea =
                  field.type === "textarea" ||
                  field.key.includes("narrative") ||
                  field.key.includes("summary") ||
                  field.key.includes("experience") ||
                  field.key.includes("usage") ||
                  field.key.includes("roles") ||
                  field.key.includes("requirements") ||
                  field.key.includes("differentiator");

                return (
                  <div key={field.key} className="space-y-1">
                    <label className="block text-sm font-medium text-foreground">
                      {field.label}
                      {field.required && <RequiredMark />}
                    </label>
                    {field.rfp_citation && (
                      <Citation text={field.rfp_citation} />
                    )}
                    {field.placeholder && (
                      <p className="text-xs text-muted-foreground">
                        {field.placeholder}
                      </p>
                    )}
                    {isTextarea ? (
                      <textarea
                        value={value}
                        onChange={(e) =>
                          updateItem(index, field.key, e.target.value)
                        }
                        placeholder={field.placeholder ?? ""}
                        rows={3}
                        style={{ minHeight: "80px" }}
                        className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <input
                        type="text"
                        value={value}
                        onChange={(e) =>
                          updateItem(index, field.key, e.target.value)
                        }
                        placeholder={field.placeholder ?? ""}
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Empty state */}
      {data.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-6 text-center">
          <p className="text-sm text-muted-foreground">
            No items to display. This section will be populated once the
            extraction pipeline identifies relevant data from the solicitation
            documents.
          </p>
        </div>
      )}
    </div>
  );
}
