"use client";

import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  DataCallSection,
  DataCallFormField,
  ComplianceVerification,
  DataCallFile,
} from "@/lib/supabase/tier2-types";

// ============================================================
// Constants
// ============================================================

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "image/png",
  "image/jpeg",
];
const ALLOWED_EXTENSIONS = ".pdf,.docx,.doc,.png,.jpg,.jpeg";

// ============================================================
// Types
// ============================================================

export interface ComplianceVerificationSectionProps {
  section: DataCallSection;
  data: ComplianceVerification;
  onChange: (data: ComplianceVerification) => void;
  files: DataCallFile[];
  solicitationId: string;
  companyId: string;
  onFileUploaded: (file: DataCallFile) => void;
  onFileRemoved: (fileId: string) => void;
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
// Toggle switch (button[role=switch] pattern from Tier 1)
// ============================================================

interface ToggleSwitchProps {
  checked: boolean;
  onToggle: () => void;
  label: string;
  disabled?: boolean;
}

function ToggleSwitch({ checked, onToggle, label, disabled }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onToggle}
      disabled={disabled}
      className={cn(
        "relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-blue-600" : "bg-muted-foreground/30"
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-4" : "translate-x-0"
        )}
      />
    </button>
  );
}

// ============================================================
// Attachment file upload (single-file slot per attachment)
// ============================================================

interface AttachmentUploadProps {
  field: DataCallFormField;
  existingFile: DataCallFile | null;
  uploading: boolean;
  error: string | null;
  onFileSelected: (file: File, fieldKey: string) => void;
  onRemove: (fileId: string) => void;
  readOnly?: boolean;
}

function AttachmentUpload({
  field,
  existingFile,
  uploading,
  error,
  onFileSelected,
  onRemove,
  readOnly,
}: AttachmentUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    if (!readOnly) inputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onFileSelected(file, field.key);
    e.target.value = "";
  };

  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-foreground">
        {field.label}
        {field.required && <RequiredMark />}
      </label>
      {field.rfp_citation && <Citation text={field.rfp_citation} />}

      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_EXTENSIONS}
        onChange={handleFileChange}
        className="hidden"
        aria-label={`Upload ${field.label}`}
      />

      {existingFile ? (
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
          <span className="min-w-0 flex-1 truncate text-sm text-foreground">
            {existingFile.filename}
          </span>
          {!readOnly && (
            <button
              type="button"
              onClick={() => onRemove(existingFile.id)}
              className="flex-shrink-0 text-xs font-medium text-red-600 hover:text-red-800 transition-colors"
              aria-label={`Remove ${existingFile.filename}`}
            >
              Remove
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          disabled={uploading || readOnly}
          className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground hover:border-blue-400 hover:text-blue-600 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
        >
          {uploading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {uploading ? "Uploading..." : "Browse..."}
        </button>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

// ============================================================
// ComplianceVerificationSection
// ============================================================

export function ComplianceVerificationSection({
  section,
  data,
  onChange,
  files,
  solicitationId,
  companyId,
  onFileUploaded,
  onFileRemoved,
}: ComplianceVerificationSectionProps) {
  const [uploadingFields, setUploadingFields] = useState<Record<string, boolean>>({});
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});

  // Safe data with defaults
  const safeData: ComplianceVerification = {
    org_certifications: data?.org_certifications ?? {},
    individual_certifications: data?.individual_certifications ?? [],
    facility_clearance_confirmed: data?.facility_clearance_confirmed ?? null,
    nist_800_171_score: data?.nist_800_171_score ?? "",
    required_attachments: data?.required_attachments ?? {},
  };

  const update = <K extends keyof ComplianceVerification>(
    key: K,
    value: ComplianceVerification[K]
  ) => {
    onChange({ ...safeData, [key]: value });
  };

  // ============================================================
  // Upload / Remove handlers
  // ============================================================

  const handleFileSelected = async (file: File, fieldKey: string) => {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setUploadErrors((prev) => ({
        ...prev,
        [fieldKey]: "File exceeds 10MB limit.",
      }));
      return;
    }
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      setUploadErrors((prev) => ({
        ...prev,
        [fieldKey]: "File type not allowed. Use PDF, DOCX, DOC, PNG, JPG, or JPEG.",
      }));
      return;
    }

    setUploadErrors((prev) => {
      const next = { ...prev };
      delete next[fieldKey];
      return next;
    });
    setUploadingFields((prev) => ({ ...prev, [fieldKey]: true }));

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("section", "compliance_verification");
      formData.append("field_key", fieldKey);

      const res = await fetch(
        `/api/solicitations/${solicitationId}/data-call/upload`,
        {
          method: "POST",
          headers: { "X-Company-Id": companyId },
          body: formData,
        }
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          (errorData as { error?: string }).error ?? `Upload failed: ${res.status}`
        );
      }

      const { file: uploadedFile } = await res.json() as { file: DataCallFile };
      onFileUploaded(uploadedFile);

      // Link file_id in required_attachments
      update("required_attachments", {
        ...safeData.required_attachments,
        [fieldKey]: uploadedFile.id,
      });
    } catch (err) {
      setUploadErrors((prev) => ({
        ...prev,
        [fieldKey]: err instanceof Error ? err.message : "Upload failed.",
      }));
    } finally {
      setUploadingFields((prev) => {
        const next = { ...prev };
        delete next[fieldKey];
        return next;
      });
    }
  };

  const handleFileRemove = async (fileId: string) => {
    try {
      const res = await fetch(
        `/api/solicitations/${solicitationId}/data-call/upload`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            "X-Company-Id": companyId,
          },
          body: JSON.stringify({ file_id: fileId }),
        }
      );
      if (!res.ok) throw new Error(`Delete failed: ${res.status}`);

      onFileRemoved(fileId);

      // Remove matching attachment reference
      const updatedAttachments = { ...safeData.required_attachments };
      for (const [key, val] of Object.entries(updatedAttachments)) {
        if (val === fileId) {
          updatedAttachments[key] = null;
        }
      }
      update("required_attachments", updatedAttachments);
    } catch (err) {
      console.error("File remove error:", err);
    }
  };

  // ============================================================
  // Parse schema fields
  // ============================================================

  const orgCertField = section.fields.find((f) => f.key === "org_certifications");
  const orgCertOptions: string[] = orgCertField?.options ?? [];

  const individualCertField = section.fields.find(
    (f) => f.key === "individual_certifications"
  );

  const clearanceField = section.fields.find(
    (f) => f.key === "facility_clearance_confirmed"
  );

  const nistField = section.fields.find((f) => f.key === "nist_800_171_score");

  const attachmentFields = section.fields.filter(
    (f) =>
      f.type === "file" &&
      f.key !== "org_certifications" &&
      f.key !== "facility_clearance_confirmed"
  );

  // Compliance files
  const complianceFiles = files.filter(
    (f) => f.section === "compliance_verification"
  );

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="space-y-6">
      {/* Section description banner */}
      {section.description && (
        <div className="rounded-md border-l-4 border-blue-400 bg-blue-50 py-3 pl-4 pr-3">
          <p className="text-sm text-blue-800">{section.description}</p>
        </div>
      )}

      {/* ---- Organizational Certifications ---- */}
      {orgCertOptions.length > 0 && (
        <div className="space-y-3">
          <div>
            <h4 className="text-sm font-semibold text-foreground">
              {orgCertField?.label ?? "Organizational Certifications"}
            </h4>
            {orgCertField?.rfp_citation && (
              <Citation text={orgCertField.rfp_citation} />
            )}
            {orgCertField?.placeholder && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {orgCertField.placeholder}
              </p>
            )}
          </div>

          <div className="space-y-2">
            {orgCertOptions.map((cert) => {
              const isChecked = safeData.org_certifications[cert] === true;
              return (
                <div
                  key={cert}
                  className="flex items-center justify-between rounded-md border border-border bg-background px-4 py-3"
                >
                  <span className="text-sm text-foreground">{cert}</span>
                  <ToggleSwitch
                    checked={isChecked}
                    onToggle={() =>
                      update("org_certifications", {
                        ...safeData.org_certifications,
                        [cert]: !isChecked,
                      })
                    }
                    label={`Toggle ${cert}`}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ---- Divider ---- */}
      {orgCertOptions.length > 0 && <hr className="border-border" />}

      {/* ---- Individual Certifications ---- */}
      {individualCertField && (
        <div className="space-y-1">
          <label className="block text-sm font-medium text-foreground">
            {individualCertField.label ?? "Individual Certifications"}
          </label>
          {individualCertField.rfp_citation && (
            <Citation text={individualCertField.rfp_citation} />
          )}
          <textarea
            value={
              Array.isArray(safeData.individual_certifications)
                ? safeData.individual_certifications.join("\n")
                : ""
            }
            onChange={(e) =>
              update(
                "individual_certifications",
                e.target.value
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean)
              )
            }
            placeholder={
              individualCertField.placeholder ??
              "List certifications held by proposed personnel (e.g., CISSP, PMP, AWS SA Pro)"
            }
            rows={3}
            className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-muted-foreground">One certification per line</p>
        </div>
      )}

      {/* ---- Facility Clearance ---- */}
      {clearanceField && (
        <div className="space-y-2">
          <hr className="border-border" />
          <div className="flex items-start justify-between gap-4 rounded-md border border-border bg-background px-4 py-3">
            <div className="flex-1 space-y-0.5">
              <p className="text-sm font-medium text-foreground">
                {clearanceField.label ?? "Facility Clearance Confirmed"}
                {clearanceField.required && <RequiredMark />}
              </p>
              {clearanceField.rfp_citation && (
                <Citation text={clearanceField.rfp_citation} />
              )}
              {clearanceField.placeholder && (
                <p className="text-xs text-muted-foreground">
                  {clearanceField.placeholder}
                </p>
              )}
            </div>
            <ToggleSwitch
              checked={safeData.facility_clearance_confirmed === true}
              onToggle={() =>
                update(
                  "facility_clearance_confirmed",
                  safeData.facility_clearance_confirmed === true ? false : true
                )
              }
              label="Toggle facility clearance confirmation"
            />
          </div>
        </div>
      )}

      {/* ---- NIST 800-171 Score ---- */}
      {nistField && (
        <div className="space-y-1">
          {!clearanceField && <hr className="border-border" />}
          <label className="block text-sm font-medium text-foreground">
            {nistField.label ?? "NIST SP 800-171 SPRS Score"}
            {nistField.required && <RequiredMark />}
          </label>
          {nistField.rfp_citation && (
            <Citation text={nistField.rfp_citation} />
          )}
          <input
            type="text"
            value={safeData.nist_800_171_score ?? ""}
            onChange={(e) => update("nist_800_171_score", e.target.value)}
            placeholder={
              nistField.placeholder ?? "e.g., 82/110 — enter your SPRS self-assessment score"
            }
            className="w-full max-w-xs rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      {/* ---- Required Attachments ---- */}
      {attachmentFields.length > 0 && (
        <div className="space-y-4">
          <hr className="border-border" />
          <h4 className="text-sm font-semibold text-foreground">
            Required Attachments
          </h4>

          <div className="space-y-4">
            {attachmentFields.map((field) => {
              const existingFile =
                complianceFiles.find((f) => f.field_key === field.key) ?? null;
              return (
                <AttachmentUpload
                  key={field.key}
                  field={field}
                  existingFile={existingFile}
                  uploading={!!uploadingFields[field.key]}
                  error={uploadErrors[field.key] ?? null}
                  onFileSelected={handleFileSelected}
                  onRemove={handleFileRemove}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
