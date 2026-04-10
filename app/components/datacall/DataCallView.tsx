"use client";

import { useState, useEffect } from "react";
import {
  Briefcase,
  Trophy,
  Users,
  Lightbulb,
  ShieldCheck,
  Layers,
  MapPin,
  Cpu,
  BookOpen,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Save,
  RefreshCw,
  ClipboardCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  DataCallFormSchema,
  DataCallFormField,
  OpportunityDetails,
  PastPerformanceRef,
  KeyPersonnelEntry,
  TechnicalApproach,
  ComplianceVerification,
  DataCallFile,
  DataCallSection,
} from "@/lib/supabase/tier2-types";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { useDataCall, type ValidationError } from "./useDataCall";
import { OpportunityDetailsSection } from "./OpportunityDetailsSection";
import { PastPerformanceSection } from "./PastPerformanceSection";
import { TechnicalApproachSection } from "./TechnicalApproachSection";
import { KeyPersonnelSection } from "./KeyPersonnelSection";
import { ComplianceVerificationSection } from "./ComplianceVerificationSection";
import { DynamicArraySection } from "./DynamicArraySection";
import { SmeContributionsSection } from "./SmeContributionsSection";

// ============================================================
// Types
// ============================================================

export interface DataCallViewProps {
  solicitationId: string;
  companyId: string;
}

// ============================================================
// Section icon map
// ============================================================

const SECTION_ICONS: Record<string, React.ReactNode> = {
  opportunity_details:     <Briefcase className="h-5 w-5" />,
  past_performance:        <Trophy className="h-5 w-5" />,
  key_personnel:           <Users className="h-5 w-5" />,
  technical_approach:      <Lightbulb className="h-5 w-5" />,
  compliance_verification: <ShieldCheck className="h-5 w-5" />,
  service_area_approaches: <Layers className="h-5 w-5" />,
  site_staffing:           <MapPin className="h-5 w-5" />,
  technology_selections:   <Cpu className="h-5 w-5" />,
  sme_contributions:       <BookOpen className="h-5 w-5" />,
};

// ============================================================
// Empty compliance verification (still needed in renderSection)
// ============================================================

function emptyComplianceVerification(): ComplianceVerification {
  return {
    org_certifications: {},
    individual_certifications: [],
    facility_clearance_confirmed: null,
    facility_clearance_level: "",
    facility_clearance_sponsoring_agency: "",
    nist_800_171_score: "",
    required_attachments: {},
  };
}

// ============================================================
// Section completion check
// ============================================================

function isSectionComplete(
  sectionId: string,
  schema: DataCallFormSchema,
  formData: Record<string, unknown>,
  files: DataCallFile[]
): boolean {
  const section = schema.sections.find((s) => s.id === sectionId);
  if (!section) return false;

  const sectionData = formData[sectionId];

  if (sectionId === "past_performance") {
    const refs = sectionData as PastPerformanceRef[];
    if (!refs || refs.length === 0) return false;
    const requiredFields = section.fields
      .filter((f) => f.required)
      .map((f) => f.key);
    return refs.every((ref) =>
      requiredFields.every(
        (field) =>
          ref[field as keyof PastPerformanceRef] !== "" &&
          ref[field as keyof PastPerformanceRef] != null
      )
    );
  }

  if (sectionId === "key_personnel") {
    const entries = sectionData as KeyPersonnelEntry[];
    if (!entries || entries.length === 0) {
      // No positions required — auto-complete
      return true;
    }
    const requiredFields = section.fields.filter((f) => f.required);
    return entries.every((entry) =>
      requiredFields.every((field) => {
        if (field.type === "file") {
          // Check file exists
          const fileKey = `personnel_${entries.indexOf(entry)}_${field.key.replace("_file", "").replace("_files", "")}`;
          return files.some((f) => f.field_key === fileKey && f.section === "key_personnel");
        }
        const val = entry[field.key as keyof KeyPersonnelEntry];
        return val !== "" && val != null;
      })
    );
  }

  // Dynamic array sections (service_area_approaches, site_staffing, technology_selections)
  if (
    sectionId === "service_area_approaches" ||
    sectionId === "site_staffing" ||
    sectionId === "technology_selections"
  ) {
    const items = sectionData as Record<string, string>[];
    if (!items || items.length === 0) return true;
    const requiredFields = section.fields.filter((f) => f.required);
    if (requiredFields.length === 0) return true;
    return items.every((item) => {
      const hasPopulatedValues = Object.values(item).some(
        (v) => typeof v === "string" && v.trim().length > 0
      );
      if (hasPopulatedValues) return true;
      return requiredFields.every((field) => {
        const val = item[field.key];
        return val !== "" && val != null;
      });
    });
  }

  if (sectionData && typeof sectionData === "object" && !Array.isArray(sectionData)) {
    const dataObj = sectionData as Record<string, unknown>;
    const requiredFields = section.fields.filter((f) => f.required);
    return requiredFields.every((field) => {
      if (field.type === "file") {
        // For compliance attachments, check files array
        return files.some(
          (f) => f.field_key === field.key && f.section === "compliance_verification"
        );
      }
      const val = dataObj[field.key];
      return val !== "" && val != null;
    });
  }

  return false;
}

// ============================================================
// Field-level validation (numeric, date, allowed values)
// ============================================================

/**
 * Validate a single field value against its validation rules.
 * Returns an error message string or null if valid.
 */
function validateFieldValue(
  field: DataCallFormField,
  val: unknown,
  prefix?: string
): string | null {
  if (!field.validation) return null;
  const v = field.validation;
  const label = prefix ? `${prefix}: ${field.label}` : field.label;

  // Numeric validation (type: 'number')
  if (field.type === 'number' && val !== '' && val != null) {
    const num = typeof val === 'number' ? val : parseFloat(String(val));
    if (isNaN(num)) {
      return `${label} must be a valid number`;
    }
    if (v.min !== undefined && num < v.min) {
      return v.validation_hint ?? `${label} must be at least ${v.min}`;
    }
    if (v.max !== undefined && num > v.max) {
      return v.validation_hint ?? `${label} must be at most ${v.max}`;
    }
  }

  // Allowed values validation (for select fields with restricted options)
  if (v.allowed_values && val !== '' && val != null) {
    if (!v.allowed_values.includes(String(val))) {
      return v.validation_hint ?? `${label}: "${val}" is not an accepted value`;
    }
  }

  // Date recency validation
  if (v.recency_cutoff_date && val !== '' && val != null) {
    const dateVal = new Date(String(val));
    const cutoff = new Date(v.recency_cutoff_date);
    if (!isNaN(dateVal.getTime()) && dateVal < cutoff) {
      return v.validation_hint ?? `${label}: date is outside the recency window (${v.recency_description ?? 'requirement not met'})`;
    }
  }

  // Pattern validation
  if (v.pattern && val !== '' && val != null) {
    const regex = new RegExp(v.pattern);
    if (!regex.test(String(val))) {
      return v.validation_hint ?? `${label} does not match the required format`;
    }
  }

  return null;
}

// ============================================================
// Validation (run on Complete Data Call)
// ============================================================

function validateDataCall(
  schema: DataCallFormSchema,
  formData: Record<string, unknown>,
  files: DataCallFile[]
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const section of schema.sections) {
    const sectionData = formData[section.id];

    if (section.id === "past_performance") {
      const refs = (sectionData as PastPerformanceRef[]) ?? [];
      const requiredFields = section.fields.filter((f) => f.required);
      refs.forEach((ref, i) => {
        requiredFields.forEach((field) => {
          const val = ref[field.key as keyof PastPerformanceRef];
          if (val === "" || val == null) {
            errors.push({
              sectionId: section.id,
              fieldKey: `${field.key}_${i}`,
              message: `Reference ${i + 1}: ${field.label} is required`,
              blocking: field.blocking,
            });
          } else if (field.validation) {
            // Validate field value (e.g., recency date check)
            const valError = validateFieldValue(field, val, `Reference ${i + 1}`);
            if (valError) {
              errors.push({
                sectionId: section.id,
                fieldKey: `${field.key}_${i}`,
                message: valError,
                blocking: field.blocking,
              });
            }
          }
        });
      });
      continue;
    }

    if (section.id === "key_personnel") {
      const entries = (sectionData as KeyPersonnelEntry[]) ?? [];
      if (entries.length === 0) continue; // No positions required

      const requiredFields = section.fields.filter((f) => f.required);
      entries.forEach((entry, i) => {
        requiredFields.forEach((field) => {
          if (field.type === "file") {
            const fileKey = `personnel_${i}_${field.key === "resume_file" ? "resume" : field.key === "loc_file" ? "loc" : field.key}`;
            const hasFile = files.some(
              (f) => f.field_key === fileKey && f.section === "key_personnel"
            );
            if (!hasFile) {
              errors.push({
                sectionId: section.id,
                fieldKey: `${field.key}_${i}`,
                message: `Personnel ${i + 1}: ${field.label} is required`,
                blocking: field.blocking,
              });
            }
          } else {
            const val = entry[field.key as keyof KeyPersonnelEntry];
            if (val === "" || val == null || (Array.isArray(val) && val.length === 0)) {
              errors.push({
                sectionId: section.id,
                fieldKey: `${field.key}_${i}`,
                message: `Personnel ${i + 1}: ${field.label} is required`,
                blocking: field.blocking,
              });
            }
          }
        });
      });
      continue;
    }

    // Dynamic array sections (service_area_approaches, site_staffing, technology_selections)
    if (
      section.id === "service_area_approaches" ||
      section.id === "site_staffing" ||
      section.id === "technology_selections"
    ) {
      const items = (sectionData as Record<string, string>[]) ?? [];
      const requiredFields = section.fields.filter((f) => f.required);
      items.forEach((item, i) => {
        const hasPopulatedValues = Object.values(item).some(
          (v) => typeof v === "string" && v.trim().length > 0
        );
        if (hasPopulatedValues) return;
        requiredFields.forEach((field) => {
          const val = item[field.key];
          if (val === "" || val == null) {
            errors.push({
              sectionId: section.id,
              fieldKey: `${field.key}_${i}`,
              message: `Item ${i + 1}: ${field.label} is required`,
              blocking: field.blocking,
            });
          }
        });
      });
      continue;
    }

    // Static sections (opportunity_details, technical_approach, compliance_verification)
    if (sectionData && typeof sectionData === "object" && !Array.isArray(sectionData)) {
      const dataObj = sectionData as Record<string, unknown>;

      // Check all required fields + all fields with validation rules
      const fieldsToValidate = section.fields.filter((f) => f.required || f.validation);
      fieldsToValidate.forEach((field) => {
        if (field.type === "file") {
          const hasFile = files.some(
            (f) => f.field_key === field.key && f.section === "compliance_verification"
          );
          if (!hasFile && field.required) {
            errors.push({
              sectionId: section.id,
              fieldKey: field.key,
              message: `${field.label} is required`,
              blocking: field.blocking,
            });
          }
        } else {
          const val = dataObj[field.key];

          // Required check
          if (field.required && (val === "" || val == null)) {
            errors.push({
              sectionId: section.id,
              fieldKey: field.key,
              message: `${field.label} is required`,
              blocking: field.blocking,
            });
          }
          // Validation rules (only when a value exists)
          else if (val !== "" && val != null && field.validation) {
            const valError = validateFieldValue(field, val);
            if (valError) {
              errors.push({
                sectionId: section.id,
                fieldKey: field.key,
                message: valError,
                blocking: field.blocking,
              });
            }
          }
        }
      });
    }
  }

  return errors;
}

// ============================================================
// Section completion count helper
// ============================================================

function countCompleteSections(
  schema: DataCallFormSchema,
  formData: Record<string, unknown>,
  files: DataCallFile[]
): { complete: number; total: number } {
  const total = schema.sections.length;
  const complete = schema.sections.filter((s) =>
    isSectionComplete(s.id, schema, formData, files)
  ).length;
  return { complete, total };
}

// ============================================================
// Format last-saved time
// ============================================================

function formatLastSaved(isoStr: string | null): string {
  if (!isoStr) return "Never";
  const d = new Date(isoStr);
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

// ============================================================
// Section router (standalone to avoid hook-in-conditional)
// ============================================================

function renderSection(
  sectionId: string,
  section: DataCallSection,
  formData: Record<string, unknown>,
  updateSection: (id: string, value: unknown) => void,
  files: DataCallFile[],
  companyId: string,
  solicitationId: string,
  onFileUploaded: (file: DataCallFile) => void,
  onFileRemoved: (fileId: string) => void,
  readOnly: boolean,
  schema?: DataCallFormSchema | null,
  sectionLVolumes?: string[],
  suggestedTopics?: string[],
): React.ReactNode {
  switch (sectionId) {
    case "opportunity_details":
      return (
        <OpportunityDetailsSection
          section={section}
          data={formData["opportunity_details"] as OpportunityDetails}
          onChange={(val) => updateSection("opportunity_details", val)}
        />
      );

    case "past_performance":
      return (
        <PastPerformanceSection
          section={section}
          data={formData["past_performance"] as PastPerformanceRef[]}
          onChange={(val) => updateSection("past_performance", val)}
          files={files}
          companyId={companyId}
          solicitationId={solicitationId}
        />
      );

    case "technical_approach":
      return (
        <TechnicalApproachSection
          section={section}
          data={formData["technical_approach"] as TechnicalApproach}
          onChange={(val) => updateSection("technical_approach", val)}
        />
      );

    case "key_personnel":
      return (
        <KeyPersonnelSection
          section={section}
          data={(formData["key_personnel"] as KeyPersonnelEntry[]) ?? []}
          onChange={(val) => updateSection("key_personnel", val)}
          files={files}
          solicitationId={solicitationId}
          companyId={companyId}
          onFileUploaded={onFileUploaded}
          onFileRemoved={onFileRemoved}
        />
      );

    case "compliance_verification":
      return (
        <ComplianceVerificationSection
          section={section}
          data={
            (formData["compliance_verification"] as ComplianceVerification) ?? emptyComplianceVerification()
          }
          onChange={(val) => updateSection("compliance_verification", val)}
          files={files}
          solicitationId={solicitationId}
          companyId={companyId}
          onFileUploaded={onFileUploaded}
          onFileRemoved={onFileRemoved}
        />
      );

    case "service_area_approaches":
      return (
        <DynamicArraySection
          section={section}
          data={(formData["service_area_approaches"] as Record<string, string>[]) ?? []}
          onChange={(val) => updateSection("service_area_approaches", val)}
          readOnlyKeys={["area_code", "area_name"]}
        />
      );

    case "site_staffing":
      return (
        <DynamicArraySection
          section={section}
          data={(formData["site_staffing"] as Record<string, string>[]) ?? []}
          onChange={(val) => updateSection("site_staffing", val)}
          readOnlyKeys={["site_name", "location"]}
        />
      );

    case "technology_selections":
      return (
        <DynamicArraySection
          section={section}
          data={(formData["technology_selections"] as Record<string, string>[]) ?? []}
          onChange={(val) => updateSection("technology_selections", val)}
          readOnlyKeys={["technology_name"]}
        />
      );

    case "sme_contributions": {
      // Prefer Section L volume names from compliance extractions;
      // fall back to schema section titles if extraction data is unavailable.
      const volumeNames =
        sectionLVolumes && sectionLVolumes.length > 0
          ? sectionLVolumes
          : (schema?.sections ?? [])
              .filter((s) => s.id !== "sme_contributions")
              .map((s) => s.title);

      // Collect all field labels across non-SME sections for overlap detection
      const dataCallFieldLabels = (schema?.sections ?? [])
        .filter((s) => s.id !== "sme_contributions")
        .flatMap((s) => s.fields.map((f) => f.label));

      return (
        <SmeContributionsSection
          solicitationId={solicitationId}
          companyId={companyId}
          availableVolumes={volumeNames}
          suggestedTopics={suggestedTopics}
          dataCallFieldLabels={dataCallFieldLabels}
          isStaff={true}
        />
      );
    }

    default:
      return (
        <div className="p-4 text-sm text-muted-foreground">
          Unknown section: {sectionId}
        </div>
      );
  }
}

// ============================================================
// Main DataCallView component
// ============================================================

export function DataCallView({ solicitationId, companyId }: DataCallViewProps) {
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const [sectionLVolumes, setSectionLVolumes] = useState<string[]>([]);
  const [suggestedTopics, setSuggestedTopics] = useState<string[]>([]);

  // Fetch Section L volumes and Section M evaluation factors for SME guidance
  useEffect(() => {
    async function fetchComplianceGuidance() {
      try {
        const supabase = createBrowserSupabaseClient();
        const { data: extractions } = await supabase
          .from("compliance_extractions")
          .select("field_name, field_value")
          .eq("solicitation_id", solicitationId)
          .in("field_name", [
            "volume_structure",
            "evaluation_factors",
            "service_area_index",
          ])
          .eq("extraction_status", "completed");

        if (!extractions || extractions.length === 0) return;

        // Section L volume names
        const volumeRow = extractions.find(
          (r) => r.field_name === "volume_structure"
        );
        const volumes = (
          volumeRow?.field_value as {
            volumes?: Array<{ name: string }>;
          }
        )?.volumes?.map((v) => v.name);
        if (volumes && volumes.length > 0) {
          setSectionLVolumes(volumes);
        }

        // Suggested topics from Section M evaluation factors + SOW service areas
        const evalRow = extractions.find(
          (r) => r.field_name === "evaluation_factors"
        );
        const serviceAreaRow = extractions.find(
          (r) => r.field_name === "service_area_index"
        );

        const evalFactors =
          (evalRow?.field_value as Array<{
            name: string;
            subfactors?: Array<{ name: string }>;
          }>) ?? [];
        const serviceAreas =
          (serviceAreaRow?.field_value as Array<{
            name: string;
            code: string;
          }>) ?? [];

        const topics: string[] = [];
        for (const factor of evalFactors) {
          topics.push(factor.name);
          for (const sub of factor.subfactors ?? []) {
            topics.push(`${factor.name}: ${sub.name}`);
          }
        }
        for (const area of serviceAreas) {
          topics.push(`Service Area: ${area.name}`);
        }
        if (topics.length > 0) {
          setSuggestedTopics(topics);
        }
      } catch (err) {
        // Non-critical — SME form still works without suggestions
        console.warn("Failed to fetch compliance guidance for SME topics:", err);
      }
    }
    fetchComplianceGuidance();
  }, [solicitationId]);

  const {
    schema,
    formData,
    files,
    isCompleted,
    lastSavedAt,
    isDirty,
    loading,
    saving,
    completing,
    error,
    validationErrors,
    validationTriggered,
    loadDataCall,
    updateSection,
    onFileUploaded,
    onFileRemoved,
    handleSave,
    handleComplete: handleCompleteHook,
    handleReopen,
    refreshSchema,
    refreshing,
  } = useDataCall(solicitationId, companyId);

  // ============================================================
  // Accordion toggle
  // ============================================================

  const toggleSection = (sectionId: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  // ============================================================
  // Complete Data Call (bridges hook with local setOpenSections)
  // ============================================================

  const handleComplete = () =>
    handleCompleteHook(validateDataCall, setOpenSections);

  // ============================================================
  // Render states
  // ============================================================

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">
          Loading data call...
        </span>
      </div>
    );
  }

  if (error || !schema) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-700">
              {error ?? "Failed to load data call schema."}
            </p>
            <button
              type="button"
              onClick={loadDataCall}
              className="mt-2 flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-800 underline"
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { complete: completeSections, total: totalSections } =
    countCompleteSections(schema, formData, files);

  const sectionErrorMap = new Map<string, ValidationError[]>();
  validationErrors.forEach((e) => {
    if (!sectionErrorMap.has(e.sectionId)) {
      sectionErrorMap.set(e.sectionId, []);
    }
    sectionErrorMap.get(e.sectionId)!.push(e);
  });

  // ============================================================
  // Main render
  // ============================================================

  return (
    <div className="space-y-4">
      {/* ---- Completion success banner ---- */}
      {isCompleted && (
        <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-green-800">
              Data Call Complete — Ready for Draft Generation
            </p>
            <p className="mt-0.5 text-xs text-green-700">
              All required information has been collected. You can reopen to make
              changes.
            </p>
          </div>
          <button
            type="button"
            onClick={handleReopen}
            className="flex-shrink-0 rounded-md border border-green-300 bg-white px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50 transition-colors"
          >
            Reopen Data Call
          </button>
        </div>
      )}

      {/* ---- Validation error summary ---- */}
      {validationTriggered && validationErrors.length > 0 && (() => {
        const blockingErrors = validationErrors.filter((e) => e.blocking);
        const advisoryErrors = validationErrors.filter((e) => !e.blocking);

        return (
          <div className="space-y-3">
            {/* Blocking compliance errors — shown prominently */}
            {blockingErrors.length > 0 && (
              <div className="rounded-xl border-2 border-red-400 bg-red-50 p-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
                  <div>
                    <p className="text-sm font-bold text-red-900">
                      {blockingErrors.length} Compliance-Blocking Field
                      {blockingErrors.length !== 1 ? "s" : ""} — Must Resolve Before Draft
                    </p>
                    <p className="mt-0.5 text-xs text-red-700">
                      These fields are required by the RFP and must be confirmed before proposal generation can begin.
                    </p>
                    <ul className="mt-2 space-y-0.5">
                      {blockingErrors.map((e, idx) => {
                        const sectionTitle =
                          schema.sections.find((s) => s.id === e.sectionId)?.title ?? e.sectionId;
                        return (
                          <li key={idx} className="text-xs text-red-800">
                            <span className="mr-1 inline-block rounded bg-red-200 px-1 py-0.5 text-[10px] font-bold uppercase text-red-900">
                              Blocking
                            </span>
                            <strong>{sectionTitle}:</strong> {e.message}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              </div>
            )}
            {/* Advisory (non-blocking) errors */}
            {advisoryErrors.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">
                      {advisoryErrors.length} additional field
                      {advisoryErrors.length !== 1 ? "s" : ""} need attention
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {Array.from(
                        advisoryErrors.reduce((map, e) => {
                          const arr = map.get(e.sectionId) ?? [];
                          arr.push(e);
                          map.set(e.sectionId, arr);
                          return map;
                        }, new Map<string, ValidationError[]>())
                      ).map(([sid, errs]) => {
                        const sectionTitle =
                          schema.sections.find((s) => s.id === sid)?.title ?? sid;
                        return (
                          <li key={sid} className="text-xs text-amber-700">
                            <strong>{sectionTitle}:</strong>{" "}
                            {errs.map((e) => e.message).join(", ")}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ---- Summary panel ---- */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-3">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-semibold",
              isCompleted
                ? "bg-green-100 text-green-800"
                : "bg-yellow-100 text-yellow-800"
            )}
          >
            {isCompleted ? "Completed" : "In Progress"}
          </span>
          <span className="text-sm text-muted-foreground">
            {completeSections} of {totalSections} sections complete
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            Last saved: {formatLastSaved(lastSavedAt)}
          </span>
          <button
            type="button"
            onClick={refreshSchema}
            disabled={refreshing}
            title="Regenerate form fields from latest RFP extractions. Your saved answers are preserved."
            className={cn(
              "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
              refreshing
                ? "border-blue-300 bg-blue-50 text-blue-600 cursor-wait"
                : "border-border bg-white text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
            {refreshing ? "Refreshing..." : "Refresh Form"}
          </button>
        </div>
      </div>

      {/* ---- Sections accordion ---- */}
      <div className="space-y-3">
        {schema.sections.map((section) => {
          const isOpen = openSections.has(section.id);
          const isComplete = isSectionComplete(section.id, schema, formData, files);
          const sectionErrors = sectionErrorMap.get(section.id) ?? [];
          const hasErrors = validationTriggered && sectionErrors.length > 0;

          return (
            <div
              key={section.id}
              className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
            >
              {/* Section header */}
              <button
                type="button"
                onClick={() => toggleSection(section.id)}
                className={cn(
                  "flex w-full items-center gap-3 px-5 py-4 text-left transition-colors",
                  isOpen ? "bg-muted/30" : "hover:bg-muted/20"
                )}
                aria-expanded={isOpen}
              >
                <span className="flex-shrink-0 text-muted-foreground">
                  {SECTION_ICONS[section.id]}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">
                      {section.title}
                    </span>
                    {hasErrors ? (
                      <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-500" />
                    ) : isComplete ? (
                      <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-500" />
                    ) : null}
                  </div>
                  {section.description && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {section.description.length > 120
                        ? section.description.slice(0, 120) + "..."
                        : section.description}
                    </p>
                  )}
                </div>
                <span className="flex-shrink-0 text-muted-foreground">
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </span>
              </button>

              {/* Section body */}
              {isOpen && (
                <div className="border-t border-border px-5 py-5">
                  {renderSection(
                    section.id,
                    section,
                    formData,
                    updateSection,
                    files,
                    companyId,
                    solicitationId,
                    onFileUploaded,
                    onFileRemoved,
                    isCompleted,
                    schema,
                    sectionLVolumes,
                    suggestedTopics
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ---- Action buttons ---- */}
      {!isCompleted && (
        <div className="flex items-center justify-end gap-3 pt-2">
          {/* Save Progress */}
          <button
            type="button"
            onClick={handleSave}
            disabled={!isDirty || saving}
            className={cn(
              "flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-colors",
              isDirty && !saving
                ? "bg-muted text-foreground border border-border hover:bg-muted/80"
                : "cursor-not-allowed bg-muted text-muted-foreground border border-border opacity-60"
            )}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? "Saving..." : "Save Progress"}
          </button>

          {/* Complete Data Call */}
          <button
            type="button"
            onClick={handleComplete}
            disabled={completing}
            className={cn(
              "flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-colors",
              completing
                ? "cursor-not-allowed bg-blue-400 text-white"
                : "bg-blue-600 text-white hover:bg-blue-700"
            )}
          >
            {completing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ClipboardCheck className="h-4 w-4" />
            )}
            {completing ? "Completing..." : "Complete Data Call"}
          </button>
        </div>
      )}
    </div>
  );
}
