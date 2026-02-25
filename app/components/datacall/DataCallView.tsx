"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Briefcase,
  Trophy,
  Users,
  Lightbulb,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Save,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  DataCallFormSchema,
  DataCallGetResponse,
  OpportunityDetails,
  PastPerformanceRef,
  TechnicalApproach,
  DataCallFile,
} from "@/lib/supabase/tier2-types";
import { OpportunityDetailsSection } from "./OpportunityDetailsSection";
import { PastPerformanceSection } from "./PastPerformanceSection";
import { TechnicalApproachSection } from "./TechnicalApproachSection";

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
};

// ============================================================
// Default empty values
// ============================================================

function emptyOpportunityDetails(): OpportunityDetails {
  return {
    prime_or_sub: null,
    teaming_partners: [],
    contract_type: null,
    naics_code: null,
    size_standard: null,
    set_aside: null,
  };
}

function emptyTechnicalApproach(): TechnicalApproach {
  return {
    approach_summary: "",
    tools_and_platforms: "",
    staffing_model: "",
    assumptions: "",
    risks: "",
  };
}

function emptyPastPerformanceRef(): PastPerformanceRef {
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
// Helpers
// ============================================================

/**
 * Build empty form data keyed by section id.
 * Called on first load when no saved response exists.
 */
function buildDefaultFormData(
  schema: DataCallFormSchema
): Record<string, unknown> {
  const data: Record<string, unknown> = {};

  for (const section of schema.sections) {
    switch (section.id) {
      case "opportunity_details":
        data[section.id] = emptyOpportunityDetails();
        break;
      case "past_performance": {
        const count = section.dynamic_count ?? 3;
        data[section.id] = Array.from({ length: count }, () =>
          emptyPastPerformanceRef()
        );
        break;
      }
      case "key_personnel":
        data[section.id] = [];
        break;
      case "technical_approach":
        data[section.id] = emptyTechnicalApproach();
        break;
      case "compliance_verification":
        data[section.id] = {
          org_certifications: {},
          individual_certifications: [],
          facility_clearance_confirmed: null,
          nist_800_171_score: "",
          required_attachments: {},
        };
        break;
    }
  }

  return data;
}

/**
 * Merge API response data into form data.
 * Respects default empty values for missing keys.
 */
function mergeResponseData(
  schema: DataCallFormSchema,
  response: {
    opportunity_details?: Partial<OpportunityDetails> | null;
    past_performance?: PastPerformanceRef[] | null;
    key_personnel?: unknown[] | null;
    technical_approach?: Partial<TechnicalApproach> | null;
    compliance_verification?: unknown | null;
  } | null
): Record<string, unknown> {
  const defaults = buildDefaultFormData(schema);
  if (!response) return defaults;

  return {
    opportunity_details: response.opportunity_details
      ? { ...emptyOpportunityDetails(), ...response.opportunity_details }
      : defaults["opportunity_details"],
    past_performance:
      response.past_performance && response.past_performance.length > 0
        ? response.past_performance
        : defaults["past_performance"],
    key_personnel: response.key_personnel ?? defaults["key_personnel"],
    technical_approach: response.technical_approach
      ? { ...emptyTechnicalApproach(), ...response.technical_approach }
      : defaults["technical_approach"],
    compliance_verification:
      response.compliance_verification ?? defaults["compliance_verification"],
  };
}

// ============================================================
// Section completion check
// ============================================================

function isSectionComplete(
  sectionId: string,
  schema: DataCallFormSchema,
  formData: Record<string, unknown>
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
    // Key personnel is Plan 03 — mark complete if empty array (no positions required)
    const entries = sectionData as unknown[];
    if (!entries || entries.length === 0) return true;
    return false;
  }

  if (sectionData && typeof sectionData === "object" && !Array.isArray(sectionData)) {
    const dataObj = sectionData as Record<string, unknown>;
    const requiredFields = section.fields
      .filter((f) => f.required)
      .map((f) => f.key);
    return requiredFields.every((field) => {
      const val = dataObj[field];
      return val !== "" && val != null;
    });
  }

  return false;
}

// ============================================================
// Main DataCallView component
// ============================================================

export function DataCallView({ solicitationId, companyId }: DataCallViewProps) {
  const [schema, setSchema] = useState<DataCallFormSchema | null>(null);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [savedData, setSavedData] = useState<Record<string, unknown>>({});
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const [files, setFiles] = useState<DataCallFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dirty detection
  const isDirty =
    JSON.stringify(formData) !== JSON.stringify(savedData);

  // ============================================================
  // Load data on mount
  // ============================================================

  const loadDataCall = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/solicitations/${solicitationId}/data-call`, {
        headers: { "X-Company-Id": companyId },
      });
      if (!res.ok) {
        throw new Error(`Failed to load data call: ${res.status}`);
      }
      const data: DataCallGetResponse = await res.json();
      const merged = mergeResponseData(data.schema, data.response);
      setSchema(data.schema);
      setFormData(merged);
      setSavedData(merged);
      setFiles(data.files ?? []);
    } catch (err) {
      console.error("DataCallView load error:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load data call."
      );
    } finally {
      setLoading(false);
    }
  }, [solicitationId, companyId]);

  useEffect(() => {
    loadDataCall();
  }, [loadDataCall]);

  // ============================================================
  // beforeunload guard
  // ============================================================

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

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
  // Save
  // ============================================================

  const handleSave = async () => {
    if (!isDirty || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/solicitations/${solicitationId}/data-call`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Company-Id": companyId,
        },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        throw new Error(`Save failed: ${res.status}`);
      }
      setSavedData(JSON.parse(JSON.stringify(formData)));
    } catch (err) {
      console.error("DataCallView save error:", err);
      // Surface error briefly — non-fatal
      alert(
        err instanceof Error ? err.message : "Save failed. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  // ============================================================
  // Section data updaters
  // ============================================================

  const updateSection = (sectionId: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [sectionId]: value }));
  };

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

  // ============================================================
  // Main render
  // ============================================================

  return (
    <div className="space-y-4">
      {/* Sections accordion */}
      <div className="space-y-3">
        {schema.sections.map((section) => {
          const isOpen = openSections.has(section.id);
          const isComplete = isSectionComplete(section.id, schema, formData);

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
                    {isComplete && (
                      <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-500" />
                    )}
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
                    solicitationId
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Save Progress button */}
      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={!isDirty || saving}
          className={cn(
            "flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-colors",
            isDirty && !saving
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "cursor-not-allowed bg-muted text-muted-foreground"
          )}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saving ? "Saving..." : "Save Progress"}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Section router
// ============================================================

function renderSection(
  sectionId: string,
  section: import("@/lib/supabase/tier2-types").DataCallSection,
  formData: Record<string, unknown>,
  updateSection: (id: string, value: unknown) => void,
  files: DataCallFile[],
  companyId: string,
  solicitationId: string
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
    case "compliance_verification":
      return (
        <div className="p-4 text-sm text-muted-foreground">
          Section coming in next plan...
        </div>
      );

    default:
      return (
        <div className="p-4 text-sm text-muted-foreground">
          Unknown section: {sectionId}
        </div>
      );
  }
}
