"use client";

import { useRef, useState } from "react";
import { Trash2, PlusCircle, Loader2, X } from "lucide-react";
import type {
  DataCallSection,
  KeyPersonnelEntry,
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

export interface KeyPersonnelSectionProps {
  section: DataCallSection;
  data: KeyPersonnelEntry[];
  onChange: (data: KeyPersonnelEntry[]) => void;
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

function emptyEntry(role?: string): KeyPersonnelEntry {
  return {
    role: role ?? "",
    name: "",
    qualifications_summary: "",
    resume_file_id: null,
    certifications_file_ids: [],
    loc_file_id: null,
  };
}

/** Extract position titles stored in the 'role' field's default_value array */
function getPositionTitles(section: DataCallSection): string[] {
  const roleField = section.fields.find((f) => f.key === "role");
  if (!roleField) return [];
  if (Array.isArray(roleField.default_value)) {
    return roleField.default_value as string[];
  }
  return [];
}

/** Check whether the LOC field is required by the schema */
function isLocRequired(section: DataCallSection): boolean {
  const locField = section.fields.find((f) => f.key === "loc_file");
  return locField?.required === true;
}

// ============================================================
// Inline file upload button
// ============================================================

interface FileUploadButtonProps {
  fieldKey: string;
  label: string;
  required: boolean;
  rfpCitation?: string | null;
  existingFile: DataCallFile | null;
  uploading: boolean;
  error: string | null;
  onFileSelected: (file: File, fieldKey: string) => void;
  onRemove: (fileId: string) => void;
}

function FileUploadButton({
  fieldKey,
  label,
  required,
  rfpCitation,
  existingFile,
  uploading,
  error,
  onFileSelected,
  onRemove,
}: FileUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onFileSelected(file, fieldKey);
    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-foreground">
        {label}
        {required && <RequiredMark />}
      </label>
      {rfpCitation && <Citation text={rfpCitation} />}

      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_EXTENSIONS}
        onChange={handleFileChange}
        className="hidden"
        aria-label={`Upload ${label}`}
      />

      {existingFile ? (
        /* File uploaded — show filename + remove button */
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
          <span className="min-w-0 flex-1 truncate text-sm text-foreground">
            {existingFile.filename}
          </span>
          <button
            type="button"
            onClick={() => onRemove(existingFile.id)}
            className="flex-shrink-0 text-xs font-medium text-red-600 hover:text-red-800 transition-colors"
            aria-label={`Remove ${existingFile.filename}`}
          >
            Remove
          </button>
        </div>
      ) : (
        /* No file — show browse button */
        <button
          type="button"
          onClick={handleClick}
          disabled={uploading}
          className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground hover:border-blue-400 hover:text-blue-600 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
        >
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : null}
          {uploading ? "Uploading..." : "Browse..."}
        </button>
      )}

      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}

// ============================================================
// Multiple file upload (certifications — one slot per file)
// ============================================================

interface MultiFileUploadProps {
  baseFieldKey: string;
  label: string;
  rfpCitation?: string | null;
  existingFiles: DataCallFile[];
  uploading: boolean;
  error: string | null;
  onFileSelected: (file: File, fieldKey: string) => void;
  onRemove: (fileId: string) => void;
}

function MultiFileUpload({
  baseFieldKey,
  label,
  rfpCitation,
  existingFiles,
  uploading,
  error,
  onFileSelected,
  onRemove,
}: MultiFileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // For each additional file use an index-based field key
    const fieldKey = `${baseFieldKey}_${existingFiles.length}`;
    onFileSelected(file, fieldKey);
    e.target.value = "";
  };

  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-foreground">
        {label}
      </label>
      {rfpCitation && <Citation text={rfpCitation} />}

      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_EXTENSIONS}
        onChange={handleFileChange}
        className="hidden"
        aria-label={`Upload ${label}`}
      />

      {/* List of already-uploaded files */}
      {existingFiles.length > 0 && (
        <div className="space-y-1">
          {existingFiles.map((f) => (
            <div
              key={f.id}
              className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2"
            >
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                {f.filename}
              </span>
              <button
                type="button"
                onClick={() => onRemove(f.id)}
                className="flex-shrink-0 text-xs font-medium text-red-600 hover:text-red-800 transition-colors"
                aria-label={`Remove ${f.filename}`}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add another file button */}
      <button
        type="button"
        onClick={handleClick}
        disabled={uploading}
        className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground hover:border-blue-400 hover:text-blue-600 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
      >
        {uploading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : null}
        {uploading
          ? "Uploading..."
          : existingFiles.length > 0
          ? "Add Another..."
          : "Browse..."}
      </button>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

// ============================================================
// Single personnel card
// ============================================================

interface PersonnelCardProps {
  index: number;
  entry: KeyPersonnelEntry;
  section: DataCallSection;
  showRemove: boolean;
  files: DataCallFile[];
  solicitationId: string;
  companyId: string;
  onChange: (updated: KeyPersonnelEntry) => void;
  onRemove: () => void;
  onFileUploaded: (file: DataCallFile) => void;
  onFileRemoved: (fileId: string) => void;
}

function PersonnelCard({
  index,
  entry,
  section,
  showRemove,
  files,
  solicitationId,
  companyId,
  onChange,
  onRemove,
  onFileUploaded,
  onFileRemoved,
}: PersonnelCardProps) {
  const [uploadingFields, setUploadingFields] = useState<Record<string, boolean>>({});
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});

  const fieldMeta = Object.fromEntries(section.fields.map((f) => [f.key, f]));
  const showLoc = !!fieldMeta["loc_file"]; // always show LOC field if in schema
  const locRequired = isLocRequired(section);

  const update = <K extends keyof KeyPersonnelEntry>(
    key: K,
    value: KeyPersonnelEntry[K]
  ) => {
    onChange({ ...entry, [key]: value });
  };

  // File key patterns
  const resumeFieldKey = `personnel_${index}_resume`;
  const certBaseFieldKey = `personnel_${index}_certifications`;
  const locFieldKey = `personnel_${index}_loc`;

  // Find existing files for this card
  const resumeFile = files.find((f) => f.field_key === resumeFieldKey) ?? null;
  const certFiles = files.filter((f) => f.field_key.startsWith(certBaseFieldKey));
  const locFile = files.find((f) => f.field_key === locFieldKey) ?? null;

  // ============================================================
  // Upload handler
  // ============================================================

  const handleFileSelected = async (file: File, fieldKey: string) => {
    // Client-side validation
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
      formData.append("section", "key_personnel");
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

      // Update entry with the file_id reference
      if (fieldKey === resumeFieldKey) {
        update("resume_file_id", uploadedFile.id);
      } else if (fieldKey === locFieldKey) {
        update("loc_file_id", uploadedFile.id);
      } else if (fieldKey.startsWith(certBaseFieldKey)) {
        update("certifications_file_ids", [
          ...entry.certifications_file_ids,
          uploadedFile.id,
        ]);
      }
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

  // ============================================================
  // Remove handler
  // ============================================================

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

      // Clear the file_id reference from entry
      if (entry.resume_file_id === fileId) {
        update("resume_file_id", null);
      } else if (entry.loc_file_id === fileId) {
        update("loc_file_id", null);
      } else if (entry.certifications_file_ids.includes(fileId)) {
        update(
          "certifications_file_ids",
          entry.certifications_file_ids.filter((id) => id !== fileId)
        );
      }
    } catch (err) {
      console.error("File remove error:", err);
    }
  };

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      {/* Card header */}
      <div className="mb-4 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground">
          {entry.role || `Personnel ${index + 1}`}
        </h4>
        {showRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors"
            aria-label={`Remove personnel ${index + 1}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove
          </button>
        )}
      </div>

      <div className="space-y-4">
        {/* role */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-foreground">
            {fieldMeta["role"]?.label ?? "Role / Position"}
            <RequiredMark />
          </label>
          {fieldMeta["role"]?.rfp_citation && (
            <Citation text={fieldMeta["role"].rfp_citation} />
          )}
          <input
            type="text"
            value={entry.role}
            onChange={(e) => update("role", e.target.value)}
            placeholder={fieldMeta["role"]?.placeholder ?? "e.g., Program Manager"}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* name */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-foreground">
            {fieldMeta["name"]?.label ?? "Candidate Full Name"}
            <RequiredMark />
          </label>
          <input
            type="text"
            value={entry.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder={fieldMeta["name"]?.placeholder ?? "Full legal name"}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* qualifications_summary */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-foreground">
            {fieldMeta["qualifications_summary"]?.label ?? "Qualifications Summary"}
            <RequiredMark />
          </label>
          {fieldMeta["qualifications_summary"]?.rfp_citation && (
            <Citation text={fieldMeta["qualifications_summary"].rfp_citation} />
          )}
          <textarea
            value={entry.qualifications_summary}
            onChange={(e) => update("qualifications_summary", e.target.value)}
            placeholder={
              fieldMeta["qualifications_summary"]?.placeholder ??
              "Education, years of experience, clearance level, relevant certifications"
            }
            rows={3}
            className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* resume_file */}
        <FileUploadButton
          fieldKey={resumeFieldKey}
          label={fieldMeta["resume_file"]?.label ?? "Resume (PDF or DOCX)"}
          required={fieldMeta["resume_file"]?.required !== false}
          rfpCitation={fieldMeta["resume_file"]?.rfp_citation}
          existingFile={resumeFile}
          uploading={!!uploadingFields[resumeFieldKey]}
          error={uploadErrors[resumeFieldKey] ?? null}
          onFileSelected={handleFileSelected}
          onRemove={handleFileRemove}
        />

        {/* certifications_files */}
        <MultiFileUpload
          baseFieldKey={certBaseFieldKey}
          label={fieldMeta["certifications_files"]?.label ?? "Certification Documents (optional)"}
          rfpCitation={fieldMeta["certifications_files"]?.rfp_citation}
          existingFiles={certFiles}
          uploading={certFiles.some(
            (_, i) =>
              !!uploadingFields[`${certBaseFieldKey}_${i}`]
          ) || !!uploadingFields[`${certBaseFieldKey}_${certFiles.length}`]}
          error={
            uploadErrors[`${certBaseFieldKey}_${certFiles.length}`] ?? null
          }
          onFileSelected={handleFileSelected}
          onRemove={handleFileRemove}
        />

        {/* loc_file — only shown if LOC field exists in schema */}
        {showLoc && (
          <FileUploadButton
            fieldKey={locFieldKey}
            label={fieldMeta["loc_file"]?.label ?? "Letter of Commitment"}
            required={locRequired}
            rfpCitation={fieldMeta["loc_file"]?.rfp_citation}
            existingFile={locFile}
            uploading={!!uploadingFields[locFieldKey]}
            error={uploadErrors[locFieldKey] ?? null}
            onFileSelected={handleFileSelected}
            onRemove={handleFileRemove}
          />
        )}
      </div>
    </div>
  );
}

// ============================================================
// KeyPersonnelSection
// ============================================================

export function KeyPersonnelSection({
  section,
  data,
  onChange,
  files,
  solicitationId,
  companyId,
  onFileUploaded,
  onFileRemoved,
}: KeyPersonnelSectionProps) {
  const positionTitles = getPositionTitles(section);
  const dynamicCount = section.dynamic_count ?? 0;

  // Build the working entries array
  const entries: KeyPersonnelEntry[] =
    Array.isArray(data) && data.length > 0
      ? data
      : dynamicCount > 0
      ? Array.from({ length: dynamicCount }, (_, i) =>
          emptyEntry(positionTitles[i])
        )
      : [];

  const handleCardChange = (index: number, updated: KeyPersonnelEntry) => {
    const next = [...entries];
    next[index] = updated;
    onChange(next);
  };

  const handleAdd = () => {
    onChange([...entries, emptyEntry()]);
  };

  const handleRemove = (index: number) => {
    const next = entries.filter((_, i) => i !== index);
    onChange(next);
  };

  return (
    <div className="space-y-4">
      {/* Section description info banner */}
      {section.description && (
        <div className="rounded-md border-l-4 border-blue-400 bg-blue-50 py-3 pl-4 pr-3">
          <p className="text-sm text-blue-800">{section.description}</p>
        </div>
      )}

      {/* Dynamic count citation */}
      {section.dynamic_count_source && (
        <p className="text-xs italic text-muted-foreground">
          {section.dynamic_count_source}
        </p>
      )}

      {/* No positions extracted */}
      {entries.length === 0 && (
        <div className="rounded-md border border-dashed border-border p-4 text-center">
          <p className="text-sm text-muted-foreground">
            No key personnel requirements extracted from the RFP. Add positions
            manually if needed.
          </p>
        </div>
      )}

      {/* Personnel cards */}
      {entries.length > 0 && (
        <div className="space-y-4">
          {entries.map((entry, i) => (
            <PersonnelCard
              key={i}
              index={i}
              entry={entry}
              section={section}
              showRemove={entries.length > 1}
              files={files.filter((f) => f.section === "key_personnel")}
              solicitationId={solicitationId}
              companyId={companyId}
              onChange={(updated) => handleCardChange(i, updated)}
              onRemove={() => handleRemove(i)}
              onFileUploaded={onFileUploaded}
              onFileRemoved={onFileRemoved}
            />
          ))}
        </div>
      )}

      {/* Add Position button */}
      <button
        type="button"
        onClick={handleAdd}
        className="flex items-center gap-2 rounded-lg border border-dashed border-border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:border-blue-400 hover:text-blue-600 transition-colors"
      >
        <PlusCircle className="h-4 w-4" />
        Add Position
      </button>
    </div>
  );
}
