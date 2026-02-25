"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Scale,
  Building2,
  BarChart3,
  FileText,
  DollarSign,
  Trophy,
  Users,
  ShieldCheck,
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
  SowPwsFields,
  CostPriceFields,
  PastPerformanceFields,
  KeyPersonnelFields,
  SecurityReqsFields,
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
  sow_pws: <FileText className="h-5 w-5" />,
  cost_price: <DollarSign className="h-5 w-5" />,
  past_performance: <Trophy className="h-5 w-5" />,
  key_personnel: <Users className="h-5 w-5" />,
  security_reqs: <ShieldCheck className="h-5 w-5" />,
};

const CATEGORY_ORDER: ExtractionCategory[] = [
  "section_l",
  "section_m",
  "admin_data",
  "rating_scales",
  "sow_pws",
  "cost_price",
  "past_performance",
  "key_personnel",
  "security_reqs",
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
  // Empty array = no data was extracted for this category (not "pending")
  // The accordion body handles this with the "No data extracted" message
  if (extractions.length === 0) return "completed";
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
// SOW / PWS / SOO renderer
// ============================================================

interface SowPwsRendererProps {
  extractions: ComplianceExtraction[];
  onSave: (extraction: ComplianceExtraction, newValue: string) => void;
  onRevert: (extraction: ComplianceExtraction) => void;
}

function SowPwsRenderer({ extractions, onSave, onRevert }: SowPwsRendererProps) {
  const findField = (name: string) => extractions.find((e) => e.field_name === name);

  const docTypeExt = findField("document_type");
  const taskAreasExt = findField("task_areas");
  const deliverablesExt = findField("deliverables");
  const popExt = findField("period_of_performance");
  const placeExt = findField("place_of_performance");

  const taskAreas = taskAreasExt?.field_value as SowPwsFields["task_areas"] | undefined;
  const deliverables = deliverablesExt?.field_value as SowPwsFields["deliverables"] | undefined;

  return (
    <div className="divide-y divide-border">
      {/* Document Type */}
      <div className="p-4">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Document Type
        </h4>
        {docTypeExt ? (
          <EditableValue
            extraction={docTypeExt}
            displayNode={
              docTypeExt.field_value ? (
                <span className="inline-flex items-center gap-2 text-sm">
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800">
                    {displayString(docTypeExt.field_value)}
                  </span>
                  {displayString(docTypeExt.field_value) === "SOO" && (
                    <span className="text-xs text-muted-foreground">
                      (Contractor generates PWS from SOO)
                    </span>
                  )}
                </span>
              ) : (
                <NotFound onClick={() => {}} />
              )
            }
            editValue={displayString(docTypeExt.field_value)}
            onSave={onSave}
            onRevert={onRevert}
          />
        ) : (
          <p className="text-sm italic text-gray-400">Not found</p>
        )}
      </div>

      {/* Task Areas */}
      <div className="p-4">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Task Areas
        </h4>
        {taskAreasExt ? (
          <div className={cn("overflow-x-auto", CONFIDENCE_BORDER[taskAreasExt.confidence], "pl-3")}>
            {taskAreas && taskAreas.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pb-2 pr-4 text-left text-xs font-semibold text-muted-foreground">Task Area</th>
                    <th className="pb-2 text-left text-xs font-semibold text-muted-foreground">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {taskAreas.map((ta, i) => (
                    <tr key={i}>
                      <td className="py-2 pr-4 font-medium">{ta.name}</td>
                      <td className="py-2 text-muted-foreground">
                        {ta.description ?? <span className="italic text-gray-400">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <span className="italic text-sm text-gray-400">No task areas found</span>
            )}
            {taskAreasExt.is_user_override && (
              <div className="mt-2 flex items-center gap-2">
                <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-700">User Override</span>
                <button onClick={() => onRevert(taskAreasExt)} className="text-xs text-muted-foreground underline hover:text-foreground">Revert</button>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm italic text-gray-400">Not found</p>
        )}
      </div>

      {/* Deliverables */}
      <div className="p-4">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Deliverables
        </h4>
        {deliverablesExt ? (
          <div className={cn("overflow-x-auto", CONFIDENCE_BORDER[deliverablesExt.confidence], "pl-3")}>
            {deliverables && deliverables.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pb-2 pr-4 text-left text-xs font-semibold text-muted-foreground">Deliverable</th>
                    <th className="pb-2 pr-4 text-left text-xs font-semibold text-muted-foreground">Frequency</th>
                    <th className="pb-2 text-left text-xs font-semibold text-muted-foreground">Format</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {deliverables.map((d, i) => (
                    <tr key={i}>
                      <td className="py-2 pr-4 font-medium">{d.name}</td>
                      <td className="py-2 pr-4 text-muted-foreground">
                        {d.frequency ?? <span className="italic text-gray-400">—</span>}
                      </td>
                      <td className="py-2 text-muted-foreground">
                        {d.format ?? <span className="italic text-gray-400">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <span className="italic text-sm text-gray-400">No deliverables found</span>
            )}
            {deliverablesExt.is_user_override && (
              <div className="mt-2 flex items-center gap-2">
                <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-700">User Override</span>
                <button onClick={() => onRevert(deliverablesExt)} className="text-xs text-muted-foreground underline hover:text-foreground">Revert</button>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm italic text-gray-400">Not found</p>
        )}
      </div>

      {/* Period & Place of Performance */}
      <div className="p-4">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Performance Details
        </h4>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
          {[
            { ext: popExt, label: "Period of Performance" },
            { ext: placeExt, label: "Place of Performance" },
          ].map(({ ext, label }) => (
            <div key={label} className="contents">
              <dt className="text-sm font-medium text-muted-foreground self-start pt-1">{label}</dt>
              <dd>
                {ext ? (
                  <EditableValue
                    extraction={ext}
                    displayNode={
                      valueIsEmpty(ext.field_value) ? (
                        <NotFound onClick={() => {}} />
                      ) : (
                        <span className="text-sm">{displayString(ext.field_value)}</span>
                      )
                    }
                    editValue={displayString(ext.field_value)}
                    onSave={onSave}
                    onRevert={onRevert}
                  />
                ) : (
                  <span className="text-sm italic text-gray-400">Not found</span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

// ============================================================
// Cost & Pricing renderer
// ============================================================

interface CostPriceRendererProps {
  extractions: ComplianceExtraction[];
  onSave: (extraction: ComplianceExtraction, newValue: string) => void;
  onRevert: (extraction: ComplianceExtraction) => void;
}

function CostPriceRenderer({ extractions, onSave, onRevert }: CostPriceRendererProps) {
  const findField = (name: string) => extractions.find((e) => e.field_name === name);

  const kvFields: Array<{ field_name: string; label: string }> = [
    { field_name: "contract_type", label: "Contract Type" },
    { field_name: "pricing_template", label: "Pricing Template" },
    { field_name: "cost_realism_or_reasonableness", label: "Cost Realism / Reasonableness" },
    { field_name: "travel_instructions", label: "Travel Instructions" },
    { field_name: "clin_pricing", label: "CLIN Pricing Structure" },
  ];

  const breakoutExt = findField("cost_breakout_categories");
  const breakoutCategories = breakoutExt?.field_value as string[] | undefined;

  return (
    <div className="divide-y divide-border">
      {/* Key-value pairs */}
      <div className="p-4">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Pricing Details
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

      {/* Cost Breakout Categories */}
      <div className="p-4">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Cost Breakout Categories
        </h4>
        {breakoutExt ? (
          <div className={cn(CONFIDENCE_BORDER[breakoutExt.confidence], "pl-3")}>
            {breakoutCategories && breakoutCategories.length > 0 ? (
              <ul className="space-y-1 text-sm list-disc list-inside">
                {breakoutCategories.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            ) : (
              <span className="italic text-sm text-gray-400">None found</span>
            )}
            {breakoutExt.is_user_override && (
              <div className="mt-2 flex items-center gap-2">
                <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-700">User Override</span>
                <button onClick={() => onRevert(breakoutExt)} className="text-xs text-muted-foreground underline hover:text-foreground">Revert</button>
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
// Past Performance renderer
// ============================================================

interface PastPerformanceRendererProps {
  extractions: ComplianceExtraction[];
  onSave: (extraction: ComplianceExtraction, newValue: string) => void;
  onRevert: (extraction: ComplianceExtraction) => void;
}

function PastPerformanceRenderer({ extractions, onSave, onRevert }: PastPerformanceRendererProps) {
  const findField = (name: string) => extractions.find((e) => e.field_name === name);

  const kvFields: Array<{ field_name: string; label: string }> = [
    { field_name: "references_required", label: "References Required" },
    { field_name: "recency_requirement", label: "Recency Requirement" },
    { field_name: "subcontractor_pp_evaluated", label: "Subcontractor PP Evaluated" },
    { field_name: "ppq_form", label: "PPQ Form" },
    { field_name: "page_limit", label: "Page Limit" },
  ];

  const relevanceExt = findField("relevance_criteria");
  const relevanceCriteria = relevanceExt?.field_value as string[] | undefined;

  return (
    <div className="divide-y divide-border">
      {/* Key-value pairs */}
      <div className="p-4">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Past Performance Requirements
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

      {/* Relevance Criteria */}
      <div className="p-4">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Relevance Criteria
        </h4>
        {relevanceExt ? (
          <div className={cn(CONFIDENCE_BORDER[relevanceExt.confidence], "pl-3")}>
            {relevanceCriteria && relevanceCriteria.length > 0 ? (
              <ul className="space-y-1 text-sm list-disc list-inside">
                {relevanceCriteria.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            ) : (
              <span className="italic text-sm text-gray-400">None found</span>
            )}
            {relevanceExt.is_user_override && (
              <div className="mt-2 flex items-center gap-2">
                <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-700">User Override</span>
                <button onClick={() => onRevert(relevanceExt)} className="text-xs text-muted-foreground underline hover:text-foreground">Revert</button>
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
// Key Personnel renderer
// ============================================================

interface KeyPersonnelRendererProps {
  extractions: ComplianceExtraction[];
  onSave: (extraction: ComplianceExtraction, newValue: string) => void;
  onRevert: (extraction: ComplianceExtraction) => void;
}

function KeyPersonnelRenderer({ extractions, onSave, onRevert }: KeyPersonnelRendererProps) {
  const findField = (name: string) => extractions.find((e) => e.field_name === name);

  const positionsExt = findField("positions");
  const resumeFormatExt = findField("resume_format");
  const locExt = findField("loc_requirements");
  const pageLimitExt = findField("counts_against_page_limit");

  const positions = positionsExt?.field_value as KeyPersonnelFields["positions"] | undefined;

  return (
    <div className="divide-y divide-border">
      {/* Positions table */}
      <div className="p-4">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Key Personnel Positions
        </h4>
        {positionsExt ? (
          <div className={cn("overflow-x-auto", CONFIDENCE_BORDER[positionsExt.confidence], "pl-3")}>
            {positions && positions.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pb-2 pr-4 text-left text-xs font-semibold text-muted-foreground">Title</th>
                    <th className="pb-2 pr-4 text-left text-xs font-semibold text-muted-foreground">Qualifications</th>
                    <th className="pb-2 pr-4 text-left text-xs font-semibold text-muted-foreground">Clearance</th>
                    <th className="pb-2 text-left text-xs font-semibold text-muted-foreground">Experience</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {positions.map((p, i) => (
                    <tr key={i}>
                      <td className="py-2 pr-4 font-medium">{p.title}</td>
                      <td className="py-2 pr-4 text-muted-foreground">
                        {p.qualifications ?? <span className="italic text-gray-400">—</span>}
                      </td>
                      <td className="py-2 pr-4">
                        {p.clearance ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                            {p.clearance}
                          </span>
                        ) : (
                          <span className="italic text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-2 text-muted-foreground">
                        {p.experience ?? <span className="italic text-gray-400">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <span className="italic text-sm text-gray-400">No key personnel found</span>
            )}
            {positionsExt.is_user_override && (
              <div className="mt-2 flex items-center gap-2">
                <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-700">User Override</span>
                <button onClick={() => onRevert(positionsExt)} className="text-xs text-muted-foreground underline hover:text-foreground">Revert</button>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm italic text-gray-400">Not found</p>
        )}
      </div>

      {/* Resume format, LOC, page limits */}
      <div className="p-4">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Submission Requirements
        </h4>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
          {[
            { ext: resumeFormatExt, label: "Resume Format" },
            { ext: locExt, label: "LOC Requirements" },
            { ext: pageLimitExt, label: "Counts Against Page Limit" },
          ].map(({ ext, label }) => (
            <div key={label} className="contents">
              <dt className="text-sm font-medium text-muted-foreground self-start pt-1">{label}</dt>
              <dd>
                {ext ? (
                  <EditableValue
                    extraction={ext}
                    displayNode={
                      valueIsEmpty(ext.field_value) ? (
                        <NotFound onClick={() => {}} />
                      ) : (
                        <span className="text-sm">{displayString(ext.field_value)}</span>
                      )
                    }
                    editValue={displayString(ext.field_value)}
                    onSave={onSave}
                    onRevert={onRevert}
                    multiline
                  />
                ) : (
                  <span className="text-sm italic text-gray-400">Not found</span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

// ============================================================
// Security Requirements renderer
// ============================================================

interface SecurityReqsRendererProps {
  extractions: ComplianceExtraction[];
  onSave: (extraction: ComplianceExtraction, newValue: string) => void;
  onRevert: (extraction: ComplianceExtraction) => void;
}

function SecurityReqsRenderer({ extractions, onSave, onRevert }: SecurityReqsRendererProps) {
  const findField = (name: string) => extractions.find((e) => e.field_name === name);

  const dd254Ext = findField("dd254_required");
  const clearanceExt = findField("clearance_levels");
  const cmmcExt = findField("cmmc_level");
  const nistExt = findField("nist_800_171_required");
  const cuiExt = findField("cui_requirements");
  const sspExt = findField("ssp_required");
  const sprsExt = findField("sprs_score");

  const clearanceLevels = clearanceExt?.field_value as string[] | undefined;

  const kvFields: Array<{ ext: ComplianceExtraction | undefined; label: string }> = [
    { ext: dd254Ext, label: "DD254 Required" },
    { ext: cmmcExt, label: "CMMC Level" },
    { ext: nistExt, label: "NIST 800-171 Required" },
    { ext: cuiExt, label: "CUI Requirements" },
    { ext: sspExt, label: "SSP Required" },
    { ext: sprsExt, label: "SPRS Score Requirement" },
  ];

  return (
    <div className="divide-y divide-border">
      {/* Clearance Levels */}
      <div className="p-4">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Clearance Levels
        </h4>
        {clearanceExt ? (
          <div className={cn(CONFIDENCE_BORDER[clearanceExt.confidence], "pl-3")}>
            {clearanceLevels && clearanceLevels.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {clearanceLevels.map((level, i) => (
                  <span
                    key={i}
                    className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800"
                  >
                    {level}
                  </span>
                ))}
              </div>
            ) : (
              <span className="italic text-sm text-gray-400">None found</span>
            )}
            {clearanceExt.is_user_override && (
              <div className="mt-2 flex items-center gap-2">
                <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-700">User Override</span>
                <button onClick={() => onRevert(clearanceExt)} className="text-xs text-muted-foreground underline hover:text-foreground">Revert</button>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm italic text-gray-400">Not found</p>
        )}
      </div>

      {/* Security details */}
      <div className="p-4">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Security Details
        </h4>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
          {kvFields.map(({ ext, label }) => (
            <div key={label} className="contents">
              <dt className="text-sm font-medium text-muted-foreground self-start pt-1">{label}</dt>
              <dd>
                {ext ? (
                  <EditableValue
                    extraction={ext}
                    displayNode={
                      valueIsEmpty(ext.field_value) ? (
                        <NotFound onClick={() => {}} />
                      ) : (
                        <span className="text-sm">{displayString(ext.field_value)}</span>
                      )
                    }
                    editValue={displayString(ext.field_value)}
                    onSave={onSave}
                    onRevert={onRevert}
                  />
                ) : (
                  <span className="text-sm italic text-gray-400">Not found</span>
                )}
              </dd>
            </div>
          ))}
        </dl>
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
    case "sow_pws":
      return <SowPwsRenderer extractions={extractions} onSave={onSave} onRevert={onRevert} />;
    case "cost_price":
      return <CostPriceRenderer extractions={extractions} onSave={onSave} onRevert={onRevert} />;
    case "past_performance":
      return <PastPerformanceRenderer extractions={extractions} onSave={onSave} onRevert={onRevert} />;
    case "key_personnel":
      return <KeyPersonnelRenderer extractions={extractions} onSave={onSave} onRevert={onRevert} />;
    case "security_reqs":
      return <SecurityReqsRenderer extractions={extractions} onSave={onSave} onRevert={onRevert} />;
  }
}

// ============================================================
// Main component
// ============================================================

/**
 * ComplianceExtractionView
 *
 * Displays extracted compliance data from a solicitation in 9 accordion sections:
 * - Section L: Instructions to Offerors (volumes, formatting, attachments, forms)
 * - Section M: Evaluation Criteria (factors/subfactors, methodology, thresholds, personnel)
 * - Admin Data: NAICS, size standard, set-aside, contract type, PoP, CLINs
 * - Rating Scales: Per-factor rating definitions and factor weightings
 * - SOW/PWS/SOO: Task areas, deliverables, PoP, place of performance
 * - Cost & Pricing: Contract type, pricing template, cost breakout, realism/reasonableness
 * - Past Performance: References, recency, relevance criteria, PPQ form
 * - Key Personnel: Positions, qualifications, clearance, resume format, LOC
 * - Security Requirements: DD254, clearance levels, CMMC/NIST, CUI, SSP
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
  // When true, polling continues even with 0 rows (extraction just triggered, Inngest creating rows)
  const extractionTriggeredRef = useRef(false);

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
    if (!data) return extractionTriggeredRef.current;

    // Check if any row is still pending/extracting
    for (const category of CATEGORY_ORDER) {
      const rows = data[category] || [];
      for (const row of rows) {
        if (row.extraction_status === "pending" || row.extraction_status === "extracting") {
          return true;
        }
      }
    }

    // If extraction was triggered, keep polling until all 9 categories have at least 1 row.
    // Inngest steps run sequentially — later categories won't have rows until their step runs.
    if (extractionTriggeredRef.current) {
      const categoriesWithData = CATEGORY_ORDER.filter(
        (cat) => (data[cat]?.length ?? 0) > 0
      ).length;
      return categoriesWithData < CATEGORY_ORDER.length;
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
          extractionTriggeredRef.current = false;
          return;
        }
        pollAttemptsRef.current += 1;
        const freshData = await fetchExtractions();
        if (shouldPoll(freshData || null)) {
          pollTimerRef.current = setTimeout(poll, 5000);
        } else {
          pollTimerRef.current = null;
          extractionTriggeredRef.current = false;
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

  // ── Re-extract all categories ───────────────────────────────
  const handleReExtractAll = async () => {
    if (!companyId) return;
    setReExtractingCategories(new Set(CATEGORY_ORDER));
    try {
      await fetch(`/api/solicitations/${solicitationId}/compliance`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Company-Id": companyId,
        },
        body: JSON.stringify({ action: "extract-all" }),
      });
      pollAttemptsRef.current = 0;
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      startPolling(extractions);
    } catch (err) {
      console.error("Re-extract all error:", err);
      setReExtractingCategories(new Set());
    }
  };

  // ── Trigger extraction now (empty state) ────────────────────
  const handleExtractNow = async () => {
    if (!companyId) return;
    try {
      // Mark all categories as re-extracting for UI feedback
      setReExtractingCategories(new Set(CATEGORY_ORDER));
      extractionTriggeredRef.current = true;
      setLoading(true);
      // Single call triggers the full Inngest extraction pipeline
      await fetch(`/api/solicitations/${solicitationId}/compliance`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Company-Id": companyId,
        },
        body: JSON.stringify({ action: "extract-all" }),
      });
      pollAttemptsRef.current = 0;
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      // Start polling — extractionTriggered flag ensures polling continues even with 0 rows
      const data = await fetchExtractions();
      setLoading(false);
      startPolling(data || null);
    } catch (err) {
      console.error("Extract now error:", err);
      setLoading(false);
      extractionTriggeredRef.current = false;
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

  if (totalExtractions === 0 && extractionTriggeredRef.current) {
    // Extraction just triggered — show skeleton loaders while waiting for Inngest to create rows
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
      <div className="flex justify-end">
        <button
          onClick={handleReExtractAll}
          disabled={reExtractingCategories.size > 0}
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Re-extract all sections from source documents"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${reExtractingCategories.size > 0 ? 'animate-spin' : ''}`} />
          Re-extract All
        </button>
      </div>
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
