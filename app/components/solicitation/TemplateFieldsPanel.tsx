"use client";

import { cn } from "@/lib/utils";
import {
  Type,
  Hash,
  Calendar,
  ToggleLeft,
  List,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import type {
  SolicitationDocument,
  TemplateFieldMapping,
  TemplateFieldType,
  TemplateFieldTag,
} from "@/lib/supabase/solicitation-types";

// ============================================================
// Field type icons
// ============================================================

const FIELD_TYPE_ICONS: Record<TemplateFieldType, React.ReactNode> = {
  text: <Type className="h-3.5 w-3.5" />,
  number: <Hash className="h-3.5 w-3.5" />,
  date: <Calendar className="h-3.5 w-3.5" />,
  boolean: <ToggleLeft className="h-3.5 w-3.5" />,
  selection: <List className="h-3.5 w-3.5" />,
};

const FIELD_TYPE_LABELS: Record<TemplateFieldType, string> = {
  text: "Text",
  number: "Number",
  date: "Date",
  boolean: "Yes/No",
  selection: "Selection",
};

// ============================================================
// Tag badge styles
// ============================================================

const TAG_CONFIG: Record<TemplateFieldTag, { label: string; classes: string }> = {
  action_required: {
    label: "Action Required",
    classes: "bg-red-100 text-red-700 border border-red-200",
  },
  reference_only: {
    label: "Reference Only",
    classes: "bg-gray-100 text-gray-600 border border-gray-200",
  },
};

// ============================================================
// Props
// ============================================================

interface TemplateFieldsPanelProps {
  /** Documents that have template field mappings */
  documents: SolicitationDocument[];
  /** Template fields keyed by document ID */
  templateFields: Record<string, TemplateFieldMapping[]>;
}

/**
 * TemplateFieldsPanel
 *
 * Displays fillable template documents with their structured field listings.
 *
 * For each document:
 * - "Fillable" badge per user decision
 * - "Action Required" or "Reference Only" document-level tag
 * - Field table: name, data type hint, required indicator, auto-fill suggestion, section ref
 *
 * Per user decisions:
 * - "Fillable badge on templates highlighted in document list"
 * - "Required fields listed with data type hints: field name, expected format"
 * - "System suggests auto-populated values from other uploaded docs — user reviews and confirms pre-fills"
 * - "'Action Required' tag for forms the user must fill out, 'Reference Only' tag for reference documents"
 */
export function TemplateFieldsPanel({
  documents,
  templateFields,
}: TemplateFieldsPanelProps) {
  if (documents.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">
          No fillable templates detected in this solicitation package.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Template fields are extracted from pricing templates, DD254 forms,
          CDRLs, and other fillable documents.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {documents.map((doc) => {
        const fields = templateFields[doc.id] ?? [];

        // Determine document-level Action Required / Reference Only tag
        // Action Required if any field is action_required
        const hasActionRequired = fields.some((f) => f.tag === "action_required");
        const documentTag: TemplateFieldTag = hasActionRequired
          ? "action_required"
          : "reference_only";
        const tagConfig = TAG_CONFIG[documentTag];

        return (
          <div
            key={doc.id}
            className="overflow-hidden rounded-xl border border-border bg-card"
          >
            {/* Document header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/30 px-5 py-4">
              <div className="flex items-center gap-3">
                {/* Document name */}
                <p
                  className="max-w-[300px] truncate font-medium text-foreground"
                  title={doc.filename}
                >
                  {doc.filename}
                </p>

                {/* Fillable badge — per user decision */}
                <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-700">
                  Fillable
                </span>
              </div>

              {/* Action Required / Reference Only tag */}
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-medium",
                  tagConfig.classes
                )}
              >
                {tagConfig.label}
              </span>
            </div>

            {/* Fields */}
            {fields.length === 0 ? (
              <div className="px-5 py-4">
                <p className="text-sm text-muted-foreground">
                  No fields extracted for this document.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/10">
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Field
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Type
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Required
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Auto-fill
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Section
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {fields.map((field) => (
                      <FieldRow key={field.id} field={field} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// FieldRow — individual template field row
// ============================================================

function FieldRow({ field }: { field: TemplateFieldMapping }) {
  const fieldType = field.field_type ?? "text";
  const typeIcon = FIELD_TYPE_ICONS[fieldType];
  const typeLabel = FIELD_TYPE_LABELS[fieldType];

  return (
    <tr className="hover:bg-muted/20 transition-colors">
      {/* Field name */}
      <td className="px-5 py-3">
        <span className="font-medium text-foreground">{field.field_name}</span>
      </td>

      {/* Data type hint — per user decision: "data type hints: expected format" */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="text-muted-foreground">{typeIcon}</span>
          <span>{typeLabel}</span>
        </div>
      </td>

      {/* Required indicator */}
      <td className="px-4 py-3">
        {field.is_required ? (
          <div className="flex items-center gap-1 text-xs">
            <AlertCircle className="h-3.5 w-3.5 text-red-500" />
            <span className="font-medium text-red-600">Required</span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Optional</span>
        )}
      </td>

      {/* Auto-fill suggestion — per user decision: "system suggests auto-populated values" */}
      <td className="px-4 py-3">
        {field.auto_fill_source ? (
          <div className="space-y-0.5">
            <div className="flex items-center gap-1 text-xs text-green-700">
              <Sparkles className="h-3 w-3 flex-shrink-0 text-green-500" />
              <span className="text-xs text-muted-foreground">
                From:{" "}
                <span className="font-mono text-green-700">
                  {field.auto_fill_source.split(".").pop()}
                </span>
              </span>
            </div>
            {field.auto_fill_value && (
              <span className="block rounded bg-green-50 px-2 py-0.5 text-xs font-medium text-green-800">
                {field.auto_fill_value}
              </span>
            )}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>

      {/* Section reference */}
      <td className="px-4 py-3">
        {field.section_reference ? (
          <span className="text-xs text-muted-foreground">
            {field.section_reference}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
    </tr>
  );
}
