"use client";

import { useState, useEffect, useCallback } from "react";
import type {
  DataCallFormSchema,
  DataCallGetResponse,
  DataCallFile,
  OpportunityDetails,
  PastPerformanceRef,
  TechnicalApproach,
  ComplianceVerification,
  ServiceAreaApproach,
  SiteStaffingPlan,
  TechnologySelection,
  KeyPersonnelEntry,
} from "@/lib/supabase/tier2-types";

// ============================================================
// Validation error type (used by hook and DataCallView)
// ============================================================

export interface ValidationError {
  sectionId: string;
  fieldKey: string;
  message: string;
  /** True when this error is for a compliance-blocking field. */
  blocking?: boolean;
}

// ============================================================
// Empty-value factories (moved from DataCallView)
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
// Helpers (moved from DataCallView)
// ============================================================

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
        data[section.id] = emptyComplianceVerification();
        break;
      case "service_area_approaches":
      case "site_staffing":
      case "technology_selections":
        data[section.id] = Array.from(
          { length: section.dynamic_count ?? 0 },
          () => {
            const obj: Record<string, string> = {};
            for (const field of section.fields) {
              obj[field.key] = (field.default_value as string) ?? "";
            }
            return obj;
          }
        );
        break;
    }
  }

  return data;
}

function mergeResponseData(
  schema: DataCallFormSchema,
  response: {
    opportunity_details?: Partial<OpportunityDetails> | null;
    past_performance?: PastPerformanceRef[] | null;
    key_personnel?: KeyPersonnelEntry[] | null;
    technical_approach?: Partial<TechnicalApproach> | null;
    compliance_verification?: Partial<ComplianceVerification> | null;
    service_area_approaches?: ServiceAreaApproach[] | null;
    site_staffing?: SiteStaffingPlan[] | null;
    technology_selections?: TechnologySelection[] | null;
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
    compliance_verification: response.compliance_verification
      ? { ...emptyComplianceVerification(), ...response.compliance_verification }
      : defaults["compliance_verification"],
    service_area_approaches:
      response.service_area_approaches && response.service_area_approaches.length > 0
        ? response.service_area_approaches
        : defaults["service_area_approaches"],
    site_staffing:
      response.site_staffing && response.site_staffing.length > 0
        ? response.site_staffing
        : defaults["site_staffing"],
    technology_selections:
      response.technology_selections && response.technology_selections.length > 0
        ? response.technology_selections
        : defaults["technology_selections"],
  };
}

// ============================================================
// Return type
// ============================================================

export interface UseDataCallReturn {
  // ── data state ──────────────────────────────────────────
  schema: DataCallFormSchema | null;
  formData: Record<string, unknown>;
  files: DataCallFile[];
  isCompleted: boolean;
  lastSavedAt: string | null;
  isDirty: boolean;

  // ── async / loading state ────────────────────────────────
  loading: boolean;
  saving: boolean;
  completing: boolean;
  error: string | null;

  // ── validation state ─────────────────────────────────────
  validationErrors: ValidationError[];
  validationTriggered: boolean;

  // ── refresh ──────────────────────────────────────────────
  refreshSchema: () => Promise<void>;
  refreshing: boolean;

  // ── handlers ─────────────────────────────────────────────
  loadDataCall: () => Promise<void>;
  updateSection: (sectionId: string, value: unknown) => void;
  onFileUploaded: (file: DataCallFile) => void;
  onFileRemoved: (fileId: string) => void;
  handleSave: () => Promise<void>;
  handleComplete: (
    validateFn: (
      schema: DataCallFormSchema,
      formData: Record<string, unknown>,
      files: DataCallFile[]
    ) => ValidationError[],
    setOpenSections: React.Dispatch<React.SetStateAction<Set<string>>>
  ) => Promise<void>;
  handleReopen: () => Promise<void>;
}

// ============================================================
// Hook
// ============================================================

export function useDataCall(
  solicitationId: string,
  companyId: string
): UseDataCallReturn {
  const [schema, setSchema] = useState<DataCallFormSchema | null>(null);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [savedData, setSavedData] = useState<Record<string, unknown>>({});
  const [files, setFiles] = useState<DataCallFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [validationTriggered, setValidationTriggered] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  const isDirty = JSON.stringify(formData) !== JSON.stringify(savedData);

  // ── Load ─────────────────────────────────────────────────

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
      if (data.response?.status === "completed") {
        setIsCompleted(true);
      }
      if (data.response?.updated_at) {
        setLastSavedAt(data.response.updated_at);
      }
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

  // ── beforeunload guard ───────────────────────────────────

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // ── Save ─────────────────────────────────────────────────

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
      const saved = await res.json() as { response: { updated_at: string } };
      setSavedData(JSON.parse(JSON.stringify(formData)));
      if (saved.response?.updated_at) {
        setLastSavedAt(saved.response.updated_at);
      }
    } catch (err) {
      console.error("DataCallView save error:", err);
      alert(
        err instanceof Error ? err.message : "Save failed. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  // ── Complete ─────────────────────────────────────────────

  const handleComplete = async (
    validateFn: (
      schema: DataCallFormSchema,
      formData: Record<string, unknown>,
      files: DataCallFile[]
    ) => ValidationError[],
    setOpenSections: React.Dispatch<React.SetStateAction<Set<string>>>
  ) => {
    if (!schema || completing) return;

    const errors = validateFn(schema, formData, files);
    setValidationErrors(errors);
    setValidationTriggered(true);

    if (errors.length > 0) {
      const sectionsWithErrors = new Set(errors.map((e) => e.sectionId));
      setOpenSections((prev) => {
        const next = new Set(prev);
        sectionsWithErrors.forEach((id) => next.add(id));
        return next;
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setCompleting(true);
    try {
      const res = await fetch(`/api/solicitations/${solicitationId}/data-call`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Company-Id": companyId,
        },
        body: JSON.stringify({ ...formData, status: "completed" }),
      });
      if (!res.ok) {
        throw new Error(`Complete failed: ${res.status}`);
      }
      const saved = await res.json() as { response: { updated_at: string } };
      setSavedData(JSON.parse(JSON.stringify(formData)));
      if (saved.response?.updated_at) {
        setLastSavedAt(saved.response.updated_at);
      }
      setIsCompleted(true);
    } catch (err) {
      console.error("DataCallView complete error:", err);
      alert(
        err instanceof Error ? err.message : "Could not complete data call. Please try again."
      );
    } finally {
      setCompleting(false);
    }
  };

  // ── Reopen ───────────────────────────────────────────────

  const handleReopen = async () => {
    try {
      const res = await fetch(`/api/solicitations/${solicitationId}/data-call`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Company-Id": companyId,
        },
        body: JSON.stringify({ status: "in_progress" }),
      });
      if (!res.ok) throw new Error(`Reopen failed: ${res.status}`);
      setIsCompleted(false);
      setValidationErrors([]);
      setValidationTriggered(false);
    } catch (err) {
      console.error("DataCallView reopen error:", err);
    }
  };

  // ── Section helpers ──────────────────────────────────────

  const updateSection = (sectionId: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [sectionId]: value }));
  };

  const onFileUploaded = (file: DataCallFile) => {
    setFiles((prev) => [...prev, file]);
  };

  const onFileRemoved = (fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  // ── Refresh schema (re-generate from latest extractions, keep user data) ──

  const [refreshing, setRefreshing] = useState(false);

  const refreshSchema = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/solicitations/${solicitationId}/data-call`,
        { headers: { "X-Company-Id": companyId } }
      );
      if (!res.ok) throw new Error(`Refresh failed: ${res.status}`);
      const data: DataCallGetResponse = await res.json();

      // Full refresh: new schema + merge saved server data onto fresh defaults.
      // This picks up new dynamic fields while preserving all previously saved answers.
      const merged = mergeResponseData(data.schema, data.response);

      setSchema(data.schema);
      setFormData(merged);
      setSavedData(merged);
      setFiles(data.files ?? []);
    } catch (err) {
      console.error("Schema refresh error:", err);
      setError(
        err instanceof Error ? err.message : "Failed to refresh form."
      );
    } finally {
      setRefreshing(false);
    }
  }, [solicitationId, companyId]);

  return {
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
    refreshSchema,
    refreshing,
    updateSection,
    onFileUploaded,
    onFileRemoved,
    handleSave,
    handleComplete,
    handleReopen,
  };
}
