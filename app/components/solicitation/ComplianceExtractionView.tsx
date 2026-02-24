"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Scale,
  Building2,
  BarChart3,
  Loader2,
  CheckCircle,
  XCircle,
  RefreshCw,
  PlusCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  ComplianceExtraction,
  ComplianceExtractionsByCategory,
  ExtractionCategory,
  ExtractionConfidence,
  ExtractionStatus,
  SectionLFields,
  SectionMFields,
  AdminDataFields,
  RatingScaleFields,
} from "@/lib/supabase/compliance-types";
import {
  EXTRACTION_CATEGORY_LABELS,
} from "@/lib/supabase/compliance-types";

// ============================================================
// Types
// ============================================================

export interface ComplianceExtractionViewProps {
  solicitationId: string;
  companyId: string;
}

// ============================================================
// Constants
// ============================================================

const CATEGORY_ICONS: Record<ExtractionCategory, React.ReactNode> = {
  section_l: <ClipboardList className="h-5 w-5" />,
  section_m: <Scale className="h-5 w-5" />,
  admin_data: <Building2 className="h-5 w-5" />,
  rating_scales: <BarChart3 className="h-5 w-5" />,
};

const CATEGORY_ORDER: ExtractionCategory[] = [
  "section_l",
  "section_m",
  "admin_data",
  "rating_scales",
];

const CONFIDENCE_BORDER: Record<ExtractionConfidence, string> = {
  high: "border-l-4 border-green-400",
  medium: "border-l-4 border-amber-400",
  low: "border-l-4 border-red-400",
};

const WEIGHT_BADGE_COLORS: Record<string, string> = {
  "Most Important": "bg-green-100 text-green-800",
  "Significantly More Important": "bg-green-100 text-green-800",
  "Equal": "bg-blue-100 text-blue-800",
  "Approximately Equal": "bg-blue-100 text-blue-800",
  "Less Important": "bg-gray-100 text-gray-700",
};

// ============================================================
// Utility helpers
// ============================================================

function getCategoryStatus(extractions: ComplianceExtraction[]): ExtractionStatus {
  if (extractions.length === 0) return "pending";
  if (extractions.some((e) => e.extraction_status === "extracting")) return "extracting";
  if (extractions.some((e) => e.extraction_status === "pending")) return "pending";
  if (extractions.every((e) => e.extraction_status === "failed")) return "failed";
  return "completed";
}

function isLoadingCategory(extractions: ComplianceExtraction[]): boolean {
  const status = getCategoryStatus(extractions);
  return status === "pending" || status === "extracting";
}

function countOverrides(extractions: ComplianceExtraction[]): number {
  return extractions.filter((e) => e.is_user_override).length;
}

function getWeightBadgeClass(weightDescription: string | undefined | null): string {
  if (!weightDescription) return "bg-gray-100 text-gray-700";
  for (const [key, cls] of Object.entries(WEIGHT_BADGE_COLORS)) {
    if (weightDescription.toLowerCase().includes(key.toLowerCase())) return cls;
  }
  return "bg-gray-100 text-gray-700";
}

function valueIsEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string" && value.trim() === "") return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

function displayString(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (value === null || value === undefined) return "";
  return JSON.stringify(value);
}

// ============================================================
// Inline editable value wrapper
// ============================================================

interface EditableValueProps {
  extraction: ComplianceExtraction;
  displayNode: React.ReactNode;
  editValue: string;
  onSave: (extraction: ComplianceExtraction, newValue: string) => void;
  onRevert: (extraction: ComplianceExtraction) => void;
  multiline?: boolean;
}

function EditableValue({
  extraction,
  displayNode,
  editValue,
  onSave,
  onRevert,
  multiline = false,
}: EditableValueProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(editValue);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  const openEdit = () => {
    setDraft(editValue);
    setEditing(true);
  };

  const save = () => {
    if (draft !== editValue) {
      onSave(extraction, draft);
    }
    setEditing(false);
  };

  const cancel = () => setEditing(false);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editing]);

  const confidenceBorder = extraction.confidence
    ? CONFIDENCE_BORDER[extraction.confidence]
    : "";

  return (
    <div
      className={cn(
        "group relative cursor-pointer rounded px-2 py-1 transition-colors hover:bg-muted/30",
        confidenceBorder,
        "pl-3"
      )}
      onClick={!editing ? openEdit : undefined}
    >
      {editing ? (
        <div onClick={(e) => e.stopPropagation()}>
          {multiline ? (
            <textarea
              ref={inputRef as React.Ref<HTMLTextAreaElement>}
              value={draft}
              rows={3}
              className="w-full rounded border border-border bg-background p-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") cancel();
              }}
              onBlur={save}
            />
          ) : (
            <input
              ref={inputRef as React.Ref<HTMLInputElement>}
              type="text"
              value={draft}
              className="w-full rounded border border-border bg-background p-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
                if (e.key === "Escape") cancel();
              }}
              onBlur={save}
            />
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            Enter to save (or click away), Esc to cancel
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap items-start gap-2">
          <span className="flex-1">
            {displayNode}
          </span>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {extraction.is_user_override && (
              <>
                <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-700">
                  User Override
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRevert(extraction);
                  }}
                  className="text-xs text-muted-foreground underline hover:text-foreground"
                >
                  Revert
                </button>
              </>
            )}
            {/* Conflict indicator when user override + amendment */}
            {extraction.is_user_override && extraction.amendment_source_id && (
              <span className="rounded-full bg-orange-100 px-1.5 py-0.5 text-xs font-medium text-orange-700">
                Conflict
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Amendment display wrapper
// ============================================================

interface AmendmentValueProps {
  extraction: ComplianceExtraction;
  children: React.ReactNode;
  originalDisplay: React.ReactNode;
}

function AmendmentValue({ extraction, children, originalDisplay }: AmendmentValueProps) {
  if (!extraction.amendment_source_id || !extraction.amendment_note) {
    return <>{children}</>;
  }

  return (
    <div className="space-y-1">
      {/* Original value with strikethrough */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground line-through">
          {originalDisplay}
        </span>
        <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-800">
          {extraction.amendment_note}
        </span>
      </div>
      {/* New value */}
      <div>{children}</div>
    </div>
  );
}

// ============================================================
// Not-found placeholder
// ============================================================

interface NotFoundProps {
  onClick: () => void;
}

function NotFound({ onClick }: NotFoundProps) {
  return (
    <span
      className="cursor-pointer text-sm italic text-gray-400 hover:text-gray-600"
      onClick={onClick}
      title="Click to add a value"
    >
      Not found
    </span>
  );
}

// ============================================================
// Skeleton loader
// ============================================================

function SkeletonRows({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex gap-3 animate-pulse">
          <div className="h-4 w-1/3 rounded bg-muted" />
          <div className="h-4 w-1/2 rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Section L renderer
// ============================================================

interface SectionLRendererProps {
  extractions: ComplianceExtraction[];
  onSave: (extraction: ComplianceExtraction, newValue: string) => void;
  onRevert: (extraction: ComplianceExtraction) => void;
}

function SectionLRenderer({ extractions, onSave, onRevert }: SectionLRendererProps) {
  const findField = (name: string) => extractions.find((e) => e.field_name === name);

  const volumeStructureExt = findField("volume_structure");
  const attachmentsExt = findField("required_attachments");
  const formsExt = findField("required_forms");
  const formattingExt = findField("formatting_rules");

  const volumeStructure = volumeStructureExt?.field_value as SectionLFields["volume_structure"] | undefined;
  const attachments = attachmentsExt?.field_value as string[] | undefined;
  const forms = formsExt?.field_value as string[] | undefined;
  const formatting = formattingExt?.field_value as SectionLFields["formatting_rules"] | undefined;

  return (
    <div className="divide-y divide-border">
      {/* Volume structure */}
      <div className="p-4">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Volume Structure
        </h4>
        {volumeStructureExt ? (
          <div className={cn("overflow-x-auto", CONFIDENCE_BORDER[volumeStructureExt.confidence], "pl-3")}>
            {volumeStructure?.volumes && volumeStructure.volumes.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pb-2 pr-4 text-left text-xs font-semibold text-muted-foreground">Volume Name</th>
                    <th className="pb-2 pr-4 text-left text-xs font-semibold text-muted-foreground">Page Limit</th>
                    <th className="pb-2 text-left text-xs font-semibold text-muted-foreground">Format / Rules</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {volumeStructure.volumes.map((vol, i) => (
                    <tr key={i}>
                      <td className="py-2 pr-4 font-medium">{vol.name}</td>
                      <td className="py-2 pr-4 text-muted-foreground">
                        {vol.page_limit ?? <span className="italic text-gray-400">No limit</span>}
                      </td>
                      <td className="py-2 text-muted-foreground">
                        {vol.format_rules ?? <span className="italic text-gray-400">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <span className="italic text-sm text-gray-400">No volumes found</span>
            )}
            {volumeStructureExt.is_user_override && (
              <div className="mt-2 flex items-center gap-2">
                <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-700">User Override</span>
                <button
                  onClick={() => onRevert(volumeStructureExt)}
                  className="text-xs text-muted-foreground underline hover:text-foreground"
                >Revert</button>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm italic text-gray-400">Not found</p>
        )}
      </div>

      {/* Required attachments */}
      <div className="p-4">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Required Attachments
        </h4>
        {attachmentsExt ? (
          <div className={cn(CONFIDENCE_BORDER[attachmentsExt.confidence], "pl-3")}>
            {attachments && attachments.length > 0 ? (
              <ul className="space-y-1 text-sm list-disc list-inside">
                {attachments.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            ) : (
              <span className="italic text-sm text-gray-400">None found</span>
            )}
            {attachmentsExt.is_user_override && (
              <div className="mt-2 flex items-center gap-2">
                <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-700">User Override</span>
                <button onClick={() => onRevert(attachmentsExt)} className="text-xs text-muted-foreground underline hover:text-foreground">Revert</button>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm italic text-gray-400">Not found</p>
        )}
      </div>

      {/* Required forms */}
      <div className="p-4">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Required Forms & Certifications
        </h4>
        {formsExt ? (
          <div className={cn(CONFIDENCE_BORDER[formsExt.confidence], "pl-3")}>
            {forms && forms.length > 0 ? (
              <ul className="space-y-1 text-sm list-disc list-inside">
                {forms.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            ) : (
              <span className="italic text-sm text-gray-400">None found</span>
            )}
            {formsExt.is_user_override && (
              <div className="mt-2 flex items-center gap-2">
                <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-700">User Override</span>
                <button onClick={() => onRevert(formsExt)} className="text-xs text-muted-foreground underline hover:text-foreground">Revert</button>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm italic text-gray-400">Not found</p>
        )}
      </div>

      {/* Formatting rules */}
      <div className="p-4">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Formatting Rules
        </h4>
        {formattingExt ? (
          <div className={cn(CONFIDENCE_BORDER[formattingExt.confidence], "pl-3")}>
            {formatting ? (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                {[
                  { label: "Font", value: formatting.font },
                  { label: "Font Size", value: formatting.font_size },
                  { label: "Margins", value: formatting.margins },
                  { label: "Spacing", value: formatting.spacing },
                ].map(({ label, value }) => (
                  <div key={label} className="contents">
                    <dt className="font-medium text-muted-foreground">{label}</dt>
                    <dd>
                      {value ? (
                        <span>{value}</span>
                      ) : (
                        <span className="italic text-gray-400">Not specified</span>
                      )}
                    </dd>
                  </div>
                ))}
                {formatting.other_rules && formatting.other_rules.length > 0 && (
                  <div className="col-span-2 mt-1">
                    <dt className="mb-1 font-medium text-muted-foreground">Other Rules</dt>
                    <ul className="list-disc list-inside space-y-0.5">
                      {formatting.other_rules.map((rule, i) => (
                        <li key={i} className="text-sm">{rule}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </dl>
            ) : (
              <span className="italic text-sm text-gray-400">Not found</span>
            )}
            {formattingExt.is_user_override && (
              <div className="mt-2 flex items-center gap-2">
                <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-700">User Override</span>
                <button onClick={() => onRevert(formattingExt)} className="text-xs text-muted-foreground underline hover:text-foreground">Revert</button>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm italic text-gray-400">Not found</p>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Section M renderer
// ============================================================

interface SectionMRendererProps {
  extractions: ComplianceExtraction[];
  onSave: (extraction: ComplianceExtraction, newValue: string) => void;
  onRevert: (extraction: ComplianceExtraction) => void;
}

function SectionMRenderer({ extractions, onSave, onRevert }: SectionMRendererProps) {
  const findField = (name: string) => extractions.find((e) => e.field_name === name);

  const evalFactorsExt = findField("evaluation_factors");
  const methodologyExt = findField("evaluation_methodology");
  const thresholdsExt = findField("experience_thresholds");
  const personnelExt = findField("key_personnel_requirements");

  const evalFactors = evalFactorsExt?.field_value as SectionMFields["evaluation_factors"] | undefined;
  const methodology = methodologyExt?.field_value as string | undefined;
  const thresholds = thresholdsExt?.field_value as string[] | undefined;
  const personnel = personnelExt?.field_value as SectionMFields["key_personnel_requirements"] | undefined;

  return (
    <div className="divide-y divide-border">
      {/* Evaluation factors — indented tree */}
      <div className="p-4">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Evaluation Factors
        </h4>
        {evalFactorsExt ? (
          <div className={cn(CONFIDENCE_BORDER[evalFactorsExt.confidence], "pl-3")}>
            {evalFactors && evalFactors.length > 0 ? (
              <div className="space-y-3">
                {evalFactors.map((factor, i) => (
                  <div key={i} className="rounded border border-border bg-muted/20 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm">{factor.name}</span>
                      {factor.weight_description && (
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-semibold",
                            getWeightBadgeClass(factor.weight_description)
                          )}
                        >
                          {factor.weight_description}
                        </span>
                      )}
                    </div>
                    {/* Subfactors */}
                    {factor.subfactors && factor.subfactors.length > 0 && (
                      <div className="mt-2 ml-4 space-y-1 border-l border-border pl-3">
                        {factor.subfactors.map((sub, j) => (
                          <div key={j} className="text-sm">
                            <span className="font-medium text-foreground">{sub.name}</span>
                            {sub.description && (
                              <span className="ml-2 text-muted-foreground">— {sub.description}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <span className="italic text-sm text-gray-400">No factors found</span>
            )}
            {evalFactorsExt.is_user_override && (
              <div className="mt-2 flex items-center gap-2">
                <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-700">User Override</span>
                <button onClick={() => onRevert(evalFactorsExt)} className="text-xs text-muted-foreground underline hover:text-foreground">Revert</button>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm italic text-gray-400">Not found</p>
        )}
      </div>

      {/* Evaluation methodology */}
      <div className="p-4">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Evaluation Methodology
        </h4>
        {methodologyExt ? (
          <EditableValue
            extraction={methodologyExt}
            displayNode={
              methodology ? (
                <span className="text-sm font-medium">
                  {methodology === "best_value" ? "Best Value" :
                   methodology === "tradeoff" ? "Tradeoff" :
                   methodology === "LPTA" ? "LPTA" :
                   methodology}
                </span>
              ) : (
                <NotFound onClick={() => {}} />
              )
            }
            editValue={displayString(methodology)}
            onSave={onSave}
            onRevert={onRevert}
          />
        ) : (
          <p className="text-sm italic text-gray-400">Not found</p>
        )}
      </div>

      {/* Experience thresholds */}
      <div className="p-4">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Experience Thresholds
        </h4>
        {thresholdsExt ? (
          <div className={cn(CONFIDENCE_BORDER[thresholdsExt.confidence], "pl-3")}>
            {thresholds && thresholds.length > 0 ? (
              <ul className="space-y-1 text-sm list-disc list-inside">
                {thresholds.map((item, i) => <li key={i}>{item}</li>)}
              </ul>
            ) : (
              <span className="italic text-sm text-gray-400">None found</span>
            )}
            {thresholdsExt.is_user_override && (
              <div className="mt-2 flex items-center gap-2">
                <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-700">User Override</span>
                <button onClick={() => onRevert(thresholdsExt)} className="text-xs text-muted-foreground underline hover:text-foreground">Revert</button>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm italic text-gray-400">Not found</p>
        )}
      </div>

      {/* Key personnel */}
      <div className="p-4">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Key Personnel Requirements
        </h4>
        {personnelExt ? (
          <div className={cn(CONFIDENCE_BORDER[personnelExt.confidence], "pl-3")}>
            {personnel && personnel.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pb-2 pr-4 text-left text-xs font-semibold text-muted-foreground">Role</th>
                    <th className="pb-2 text-left text-xs font-semibold text-muted-foreground">Qualifications</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {personnel.map((p, i) => (
                    <tr key={i}>
                      <td className="py-2 pr-4 font-medium">{p.role}</td>
                      <td className="py-2 text-muted-foreground">
                        {p.qualifications ?? <span className="italic text-gray-400">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <span className="italic text-sm text-gray-400">None found</span>
            )}
            {personnelExt.is_user_override && (
              <div className="mt-2 flex items-center gap-2">
                <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-700">User Override</span>
                <button onClick={() => onRevert(personnelExt)} className="text-xs text-muted-foreground underline hover:text-foreground">Revert</button>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm italic text-gray-400">Not found</p>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Admin Data renderer
// ============================================================

interface AdminDataRendererProps {
  extractions: ComplianceExtraction[];
  onSave: (extraction: ComplianceExtraction, newValue: string) => void;
  onRevert: (extraction: ComplianceExtraction) => void;
}

function AdminDataRenderer({ extractions, onSave, onRevert }: AdminDataRendererProps) {
  const findField = (name: string) => extractions.find((e) => e.field_name === name);

  const kvFields: Array<{ field_name: string; label: string }> = [
    { field_name: "naics_code", label: "NAICS Code" },
    { field_name: "size_standard", label: "Size Standard" },
    { field_name: "set_aside_designation", label: "Set-Aside Designation" },
    { field_name: "contract_type", label: "Contract Type" },
    { field_name: "period_of_performance", label: "Period of Performance" },
  ];

  const clinExt = findField("clin_structure");
  const clinStructure = clinExt?.field_value as AdminDataFields["clin_structure"] | undefined;

  return (
    <div className="divide-y divide-border">
      {/* Key-value pairs */}
      <div className="p-4">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Contract Details
        </h4>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
          {kvFields.map(({ field_name, label }) => {
            const ext = findField(field_name);
            const val = ext?.field_value;
            return (
              <div key={field_name} className="contents">
                <dt className="text-sm font-medium text-muted-foreground self-start pt-1">{label}</dt>
                <dd>
                  {ext ? (
                    <EditableValue
                      extraction={ext}
                      displayNode={
                        valueIsEmpty(val) ? (
                          <NotFound onClick={() => {}} />
                        ) : (
                          <span className="text-sm">{displayString(val)}</span>
                        )
                      }
                      editValue={displayString(val)}
                      onSave={onSave}
                      onRevert={onRevert}
                    />
                  ) : (
                    <span className="text-sm italic text-gray-400">Not found</span>
                  )}
                </dd>
              </div>
            );
          })}
        </dl>
      </div>

      {/* CLIN Structure */}
      <div className="p-4">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          CLIN Structure
        </h4>
        {clinExt ? (
          <div className={cn("overflow-x-auto", CONFIDENCE_BORDER[clinExt.confidence], "pl-3")}>
            {clinStructure && clinStructure.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pb-2 pr-4 text-left text-xs font-semibold text-muted-foreground">CLIN #</th>
                    <th className="pb-2 pr-4 text-left text-xs font-semibold text-muted-foreground">Description</th>
                    <th className="pb-2 text-left text-xs font-semibold text-muted-foreground">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {clinStructure.map((clin, i) => (
                    <tr key={i}>
                      <td className="py-2 pr-4 font-mono font-medium">{clin.clin_number}</td>
                      <td className="py-2 pr-4">{clin.description}</td>
                      <td className="py-2 text-muted-foreground">
                        {clin.type ?? <span className="italic text-gray-400">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <span className="italic text-sm text-gray-400">No CLINs found</span>
            )}
            {clinExt.is_user_override && (
              <div className="mt-2 flex items-center gap-2">
                <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-700">User Override</span>
                <button onClick={() => onRevert(clinExt)} className="text-xs text-muted-foreground underline hover:text-foreground">Revert</button>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm italic text-gray-400">Not found</p>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Rating Scales renderer
// ============================================================

interface RatingScalesRendererProps {
  extractions: ComplianceExtraction[];
  onSave: (extraction: ComplianceExtraction, newValue: string) => void;
  onRevert: (extraction: ComplianceExtraction) => void;
}

function RatingScalesRenderer({ extractions, onSave, onRevert }: RatingScalesRendererProps) {
  const findField = (name: string) => extractions.find((e) => e.field_name === name);

  const ratingScalesExt = findField("rating_scales");
  const weightingsExt = findField("factor_weightings");

  const ratingScales = ratingScalesExt?.field_value as RatingScaleFields["rating_scales"] | undefined;
  const weightings = weightingsExt?.field_value as RatingScaleFields["factor_weightings"] | undefined;

  return (
    <div className="divide-y divide-border">
      {/* Per-factor rating scales */}
      <div className="p-4">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Rating Scale Definitions
        </h4>
        {ratingScalesExt ? (
          <div className={cn(CONFIDENCE_BORDER[ratingScalesExt.confidence], "pl-3 space-y-4")}>
            {ratingScales && ratingScales.length > 0 ? (
              ratingScales.map((factorScale, i) => (
                <div key={i}>
                  <h5 className="mb-2 text-sm font-semibold">{factorScale.factor_name}</h5>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="pb-1.5 pr-4 text-left text-xs font-semibold text-muted-foreground">Rating</th>
                        <th className="pb-1.5 text-left text-xs font-semibold text-muted-foreground">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {factorScale.scale.map((row, j) => (
                        <tr key={j}>
                          <td className="py-1.5 pr-4 font-medium whitespace-nowrap">{row.rating}</td>
                          <td className="py-1.5 text-muted-foreground">{row.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))
            ) : (
              <span className="italic text-sm text-gray-400">No rating scales found</span>
            )}
            {ratingScalesExt.is_user_override && (
              <div className="mt-2 flex items-center gap-2">
                <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-700">User Override</span>
                <button onClick={() => onRevert(ratingScalesExt)} className="text-xs text-muted-foreground underline hover:text-foreground">Revert</button>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm italic text-gray-400">Not found</p>
        )}
      </div>

      {/* Factor weightings */}
      <div className="p-4">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Factor Weightings
        </h4>
        {weightingsExt ? (
          <div className={cn("overflow-x-auto", CONFIDENCE_BORDER[weightingsExt.confidence], "pl-3")}>
            {weightings && weightings.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pb-2 pr-4 text-left text-xs font-semibold text-muted-foreground">Factor</th>
                    <th className="pb-2 pr-4 text-left text-xs font-semibold text-muted-foreground">Weight / Importance</th>
                    <th className="pb-2 text-left text-xs font-semibold text-muted-foreground">Relative Importance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {weightings.map((w, i) => (
                    <tr key={i}>
                      <td className="py-2 pr-4 font-medium">{w.factor_name}</td>
                      <td className="py-2 pr-4 text-muted-foreground">
                        {w.weight_description ?? <span className="italic text-gray-400">—</span>}
                      </td>
                      <td className="py-2 text-muted-foreground">
                        {w.relative_importance ?? <span className="italic text-gray-400">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <span className="italic text-sm text-gray-400">No weightings found</span>
            )}
            {weightingsExt.is_user_override && (
              <div className="mt-2 flex items-center gap-2">
                <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-700">User Override</span>
                <button onClick={() => onRevert(weightingsExt)} className="text-xs text-muted-foreground underline hover:text-foreground">Revert</button>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm italic text-gray-400">Not found</p>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Accordion section
// ============================================================

interface AccordionSectionProps {
  category: ExtractionCategory;
  extractions: ComplianceExtraction[];
  expanded: boolean;
  onToggle: () => void;
  onReExtract: (category: ExtractionCategory) => void;
  onSave: (extraction: ComplianceExtraction, newValue: string) => void;
  onRevert: (extraction: ComplianceExtraction) => void;
  reExtracting: boolean;
}

function AccordionSection({
  category,
  extractions,
  expanded,
  onToggle,
  onReExtract,
  onSave,
  onRevert,
  reExtracting,
}: AccordionSectionProps) {
  const label = EXTRACTION_CATEGORY_LABELS[category];
  const icon = CATEGORY_ICONS[category];
  const categoryStatus = getCategoryStatus(extractions);
  const isLoading = isLoadingCategory(extractions) || reExtracting;

  const overrideCount = countOverrides(extractions);
  const [showReExtractConfirm, setShowReExtractConfirm] = useState(false);

  const handleReExtractClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (overrideCount > 0) {
      setShowReExtractConfirm(true);
    } else {
      onReExtract(category);
    }
  };

  const confirmReExtract = () => {
    setShowReExtractConfirm(false);
    onReExtract(category);
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {/* Accordion header */}
      <div
        className="flex cursor-pointer items-center justify-between gap-3 p-4 hover:bg-muted/30 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground">{icon}</span>
          <span className="font-semibold text-sm">{label}</span>

          {/* Status indicator */}
          {isLoading && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
          {!isLoading && categoryStatus === "completed" && (
            <CheckCircle className="h-4 w-4 text-green-500" />
          )}
          {!isLoading && categoryStatus === "failed" && (
            <XCircle className="h-4 w-4 text-red-500" />
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Re-extract button */}
          <button
            onClick={handleReExtractClick}
            disabled={isLoading}
            className={cn(
              "flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
              isLoading
                ? "cursor-not-allowed border-border text-muted-foreground opacity-50"
                : "border-border text-muted-foreground hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
            )}
            title="Re-extract this section from source documents"
          >
            <RefreshCw className="h-3 w-3" />
            Re-extract
          </button>

          {/* Expand/collapse chevron */}
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Re-extract confirmation prompt */}
      {showReExtractConfirm && (
        <div className="border-t border-border bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-800">
            You have manually edited{" "}
            <strong>{overrideCount} value{overrideCount !== 1 ? "s" : ""}</strong> in this section.
            Re-extraction will update AI-extracted values but preserve your overrides. You&apos;ll be prompted
            to review any conflicts. Continue?
          </p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={confirmReExtract}
              className="rounded border border-amber-400 bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 hover:bg-amber-200"
            >
              Continue Re-extract
            </button>
            <button
              onClick={() => setShowReExtractConfirm(false)}
              className="rounded border border-border px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Accordion body */}
      {expanded && (
        <div className="border-t border-border">
          {isLoading && !reExtracting ? (
            <SkeletonRows count={5} />
          ) : isLoading && reExtracting ? (
            <div className="flex items-center gap-3 p-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Re-extracting...
            </div>
          ) : categoryStatus === "failed" && extractions.every((e) => e.extraction_status === "failed") ? (
            <FailedCategoryView extractions={extractions} onReExtract={() => onReExtract(category)} />
          ) : extractions.length === 0 ? (
            <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
              <PlusCircle className="h-4 w-4" />
              No data extracted for this section.
            </div>
          ) : (
            <CategoryContent
              category={category}
              extractions={extractions}
              onSave={onSave}
              onRevert={onRevert}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Failed category view
// ============================================================

function FailedCategoryView({
  extractions,
  onReExtract,
}: {
  extractions: ComplianceExtraction[];
  onReExtract: () => void;
}) {
  const errorMsg = extractions.find((e) => e.error_message)?.error_message;
  const categoryLabel = extractions[0]
    ? EXTRACTION_CATEGORY_LABELS[extractions[0].category]
    : "this section";

  return (
    <div className="p-4 space-y-3">
      <p className="text-sm text-red-600">
        {errorMsg
          ? `Extraction failed — ${errorMsg}`
          : `No data found — this document may not contain ${categoryLabel} content`}
      </p>
      <button
        onClick={onReExtract}
        className="flex items-center gap-1 rounded border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
      >
        <RefreshCw className="h-3 w-3" />
        Retry extraction
      </button>
    </div>
  );
}

// ============================================================
// Category content dispatcher
// ============================================================

function CategoryContent({
  category,
  extractions,
  onSave,
  onRevert,
}: {
  category: ExtractionCategory;
  extractions: ComplianceExtraction[];
  onSave: (extraction: ComplianceExtraction, newValue: string) => void;
  onRevert: (extraction: ComplianceExtraction) => void;
}) {
  switch (category) {
    case "section_l":
      return <SectionLRenderer extractions={extractions} onSave={onSave} onRevert={onRevert} />;
    case "section_m":
      return <SectionMRenderer extractions={extractions} onSave={onSave} onRevert={onRevert} />;
    case "admin_data":
      return <AdminDataRenderer extractions={extractions} onSave={onSave} onRevert={onRevert} />;
    case "rating_scales":
      return <RatingScalesRenderer extractions={extractions} onSave={onSave} onRevert={onRevert} />;
  }
}

// ============================================================
// Main component
// ============================================================

/**
 * ComplianceExtractionView
 *
 * Displays extracted compliance data from a solicitation in 4 accordion sections:
 * - Section L: Instructions to Offerors (volumes, formatting, attachments, forms)
 * - Section M: Evaluation Criteria (factors/subfactors, methodology, thresholds, personnel)
 * - Admin Data: NAICS, size standard, set-aside, contract type, PoP, CLINs
 * - Rating Scales: Per-factor rating definitions and factor weightings
 *
 * Features:
 * - 5-second polling while extractions are pending/extracting (max 60 attempts = 5 min)
 * - Confidence color borders (green=high, amber=medium, red=low)
 * - Inline editing with User Override badge tracking
 * - Revert overrides to original AI value
 * - Per-section re-extract with override preservation
 * - Amendment impact display (strikethrough + Amendment badge)
 * - Skeleton loaders during extraction
 * - Error and empty states
 */
export function ComplianceExtractionView({
  solicitationId,
  companyId,
}: ComplianceExtractionViewProps) {
  const [extractions, setExtractions] = useState<ComplianceExtractionsByCategory | null>(null);
  const [solicitationStatus, setSolicitationStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<ExtractionCategory>>(
    new Set(CATEGORY_ORDER)
  );
  const [reExtractingCategories, setReExtractingCategories] = useState<Set<ExtractionCategory>>(
    new Set()
  );

  const pollAttemptsRef = useRef(0);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch extractions from API ──────────────────────────────
  const fetchExtractions = useCallback(async () => {
    if (!companyId) return;
    try {
      const headers = new Headers({ "X-Company-Id": companyId });
      const response = await fetch(`/api/solicitations/${solicitationId}/compliance`, {
        headers,
      });
      if (!response.ok) {
        setError("Failed to load compliance extractions.");
        return false;
      }
      const data = await response.json();
      setExtractions(data.extractions);
      setSolicitationStatus(data.solicitation_status);
      return data.extractions;
    } catch (err) {
      console.error("Fetch compliance error:", err);
      setError("Network error loading compliance data.");
      return false;
    }
  }, [solicitationId, companyId]);

  // ── Determine if polling should continue ───────────────────
  const shouldPoll = useCallback((data: ComplianceExtractionsByCategory | null): boolean => {
    if (!data) return false;
    for (const category of CATEGORY_ORDER) {
      const rows = data[category] || [];
      for (const row of rows) {
        if (row.extraction_status === "pending" || row.extraction_status === "extracting") {
          return true;
        }
      }
    }
    return false;
  }, []);

  // ── Polling loop ────────────────────────────────────────────
  const startPolling = useCallback(
    (currentData: ComplianceExtractionsByCategory | null) => {
      if (pollTimerRef.current) return; // Already polling

      const poll = async () => {
        if (pollAttemptsRef.current >= 60) {
          // Max 60 attempts = 5 minutes
          return;
        }
        pollAttemptsRef.current += 1;
        const freshData = await fetchExtractions();
        if (freshData && shouldPoll(freshData)) {
          pollTimerRef.current = setTimeout(poll, 5000);
        } else {
          pollTimerRef.current = null;
          // Clear any re-extracting state for categories that are now done
          if (freshData) {
            setReExtractingCategories((prev) => {
              const next = new Set(prev);
              for (const cat of CATEGORY_ORDER) {
                const rows: ComplianceExtraction[] = freshData[cat] || [];
                const stillProcessing = rows.some(
                  (r) => r.extraction_status === "pending" || r.extraction_status === "extracting"
                );
                if (!stillProcessing) next.delete(cat);
              }
              return next;
            });
          }
        }
      };

      if (shouldPoll(currentData)) {
        pollTimerRef.current = setTimeout(poll, 5000);
      }
    },
    [fetchExtractions, shouldPoll]
  );

  // ── Initial load ────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      const data = await fetchExtractions();
      setLoading(false);
      if (data) {
        startPolling(data);
      }
    };
    load();

    return () => {
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [fetchExtractions, startPolling]);

  // ── Toggle accordion ────────────────────────────────────────
  const toggleCategory = (category: ExtractionCategory) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  // ── Save inline edit ────────────────────────────────────────
  const handleSave = async (extraction: ComplianceExtraction, newValue: string) => {
    if (!companyId) return;
    try {
      const headers = new Headers({
        "Content-Type": "application/json",
        "X-Company-Id": companyId,
      });
      const response = await fetch(`/api/solicitations/${solicitationId}/compliance`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          extraction_id: extraction.id,
          field_value: newValue,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        const updated: ComplianceExtraction = data.extraction;
        setExtractions((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            [extraction.category]: prev[extraction.category].map((e) =>
              e.id === updated.id ? updated : e
            ),
          };
        });
      }
    } catch (err) {
      console.error("Save extraction error:", err);
    }
  };

  // ── Revert override ─────────────────────────────────────────
  const handleRevert = async (extraction: ComplianceExtraction) => {
    if (!companyId) return;
    try {
      const headers = new Headers({
        "Content-Type": "application/json",
        "X-Company-Id": companyId,
      });
      const response = await fetch(`/api/solicitations/${solicitationId}/compliance`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          extraction_id: extraction.id,
          action: "revert",
        }),
      });
      if (response.ok) {
        const data = await response.json();
        const reverted: ComplianceExtraction = data.extraction;
        setExtractions((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            [extraction.category]: prev[extraction.category].map((e) =>
              e.id === reverted.id ? reverted : e
            ),
          };
        });
      }
    } catch (err) {
      console.error("Revert extraction error:", err);
    }
  };

  // ── Re-extract category ─────────────────────────────────────
  const handleReExtract = async (category: ExtractionCategory) => {
    if (!companyId) return;
    setReExtractingCategories((prev) => new Set(prev).add(category));
    try {
      const headers = new Headers({
        "Content-Type": "application/json",
        "X-Company-Id": companyId,
      });
      await fetch(`/api/solicitations/${solicitationId}/compliance`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ category, action: "re-extract" }),
      });
      // Start polling to pick up new results
      pollAttemptsRef.current = 0;
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      startPolling(extractions);
    } catch (err) {
      console.error("Re-extract error:", err);
      setReExtractingCategories((prev) => {
        const next = new Set(prev);
        next.delete(category);
        return next;
      });
    }
  };

  // ── Trigger extraction now (empty state) ────────────────────
  const handleExtractNow = async () => {
    if (!companyId) return;
    try {
      const headers = new Headers({
        "Content-Type": "application/json",
        "X-Company-Id": companyId,
      });
      // Trigger re-extract for all categories
      for (const category of CATEGORY_ORDER) {
        setReExtractingCategories((prev) => new Set(prev).add(category));
        await fetch(`/api/solicitations/${solicitationId}/compliance`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ category, action: "re-extract" }),
        });
      }
      pollAttemptsRef.current = 0;
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      // Reload and poll
      const data = await fetchExtractions();
      if (data) startPolling(data);
    } catch (err) {
      console.error("Extract now error:", err);
    }
  };

  // ── Render states ────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4">
        {CATEGORY_ORDER.map((cat) => (
          <div key={cat} className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex items-center gap-3 p-4">
              <span className="text-muted-foreground">{CATEGORY_ICONS[cat]}</span>
              <span className="font-semibold text-sm">{EXTRACTION_CATEGORY_LABELS[cat]}</span>
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
            <div className="border-t border-border">
              <SkeletonRows count={4} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <XCircle className="mx-auto mb-2 h-6 w-6 text-red-500" />
        <p className="text-sm font-medium text-red-700">{error}</p>
      </div>
    );
  }

  // Empty state — no extractions at all
  const totalExtractions = CATEGORY_ORDER.reduce(
    (sum, cat) => sum + (extractions?.[cat]?.length ?? 0),
    0
  );

  if (totalExtractions === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <ClipboardList className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">
          Compliance extraction has not run yet.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          It will start automatically after document reconciliation completes.
        </p>
        {solicitationStatus === "ready" && (
          <button
            onClick={handleExtractNow}
            className="mt-4 flex items-center gap-2 mx-auto rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Extract Now
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {CATEGORY_ORDER.map((category) => {
        const categoryExtractions = extractions?.[category] ?? [];
        return (
          <AccordionSection
            key={category}
            category={category}
            extractions={categoryExtractions}
            expanded={expandedCategories.has(category)}
            onToggle={() => toggleCategory(category)}
            onReExtract={handleReExtract}
            onSave={handleSave}
            onRevert={handleRevert}
            reExtracting={reExtractingCategories.has(category)}
          />
        );
      })}
    </div>
  );
}
