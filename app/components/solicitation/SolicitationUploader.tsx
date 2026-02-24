"use client";

import { useState, useCallback, useRef, type DragEvent, type ChangeEvent } from "react";
import { Upload, FileText, X, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { cn } from "@/lib/utils";
import { useCompany } from "@/lib/context/CompanyContext";

// Accepted file types for solicitation package upload
const ACCEPTED_EXTENSIONS = ".pdf,.docx,.doc,.xlsx,.xls,.txt";

type FileUploadStatus = "queued" | "uploading" | "processing" | "classified" | "failed";

interface UploadFileEntry {
  file: File;
  status: FileUploadStatus;
  error?: string;
  documentId?: string;
}

interface SolicitationUploaderProps {
  solicitationId: string;
  onUploadComplete: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

const STATUS_LABELS: Record<FileUploadStatus, string> = {
  queued: "Queued",
  uploading: "Uploading...",
  processing: "Classifying...",
  classified: "Classified",
  failed: "Failed",
};

const STATUS_BADGE_CLASSES: Record<FileUploadStatus, string> = {
  queued: "bg-gray-100 text-gray-600",
  uploading: "bg-blue-100 text-blue-700 animate-pulse",
  processing: "bg-amber-100 text-amber-700 animate-pulse",
  classified: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

/**
 * SolicitationUploader
 *
 * Multi-file drag-and-drop upload component for solicitation packages.
 * Shows per-file progress through: queued -> uploading -> processing -> classified.
 * Polls for classification status after upload completes.
 */
export function SolicitationUploader({ solicitationId, onUploadComplete }: SolicitationUploaderProps) {
  const { selectedCompanyId } = useCompany();
  const [files, setFiles] = useState<UploadFileEntry[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const addFiles = useCallback((newFiles: File[]) => {
    setFiles((prev) => {
      const existingNames = new Set(prev.map((f) => f.file.name));
      const toAdd = newFiles
        .filter((f) => !existingNames.has(f.name))
        .map((file) => ({ file, status: "queued" as FileUploadStatus }));
      return [...prev, ...toAdd];
    });
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragActive(false);
      const droppedFiles = Array.from(e.dataTransfer.files);
      addFiles(droppedFiles);
    },
    [addFiles]
  );

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = e.target.files;
      if (selectedFiles?.length) {
        addFiles(Array.from(selectedFiles));
      }
    },
    [addFiles]
  );

  const removeFile = useCallback((filename: string) => {
    setFiles((prev) => prev.filter((f) => f.file.name !== filename));
  }, []);

  const updateFileStatus = useCallback(
    (filename: string, update: Partial<UploadFileEntry>) => {
      setFiles((prev) =>
        prev.map((f) => (f.file.name === filename ? { ...f, ...update } : f))
      );
    },
    []
  );

  const pollForClassification = useCallback(
    (documentIds: string[]) => {
      let attempts = 0;
      const maxAttempts = 40; // 40 * 3s = 2 minutes max poll

      const poll = async () => {
        attempts++;
        if (attempts > maxAttempts) {
          if (pollRef.current) clearInterval(pollRef.current);
          return;
        }

        try {
          const headers = new Headers();
          if (selectedCompanyId) headers.set("X-Company-Id", selectedCompanyId);

          const response = await fetch(
            `/api/solicitations/${solicitationId}/documents`,
            { headers }
          );

          if (!response.ok) return;

          const data = await response.json();
          const docs: Array<{ id: string; processing_status: string }> = data.documents || [];

          // Update each file's status based on server response
          for (const doc of docs) {
            if (!documentIds.includes(doc.id)) continue;
            if (doc.processing_status === "classified") {
              // Find the filename by document ID
              setFiles((prev) =>
                prev.map((f) =>
                  f.documentId === doc.id
                    ? { ...f, status: "classified" }
                    : f
                )
              );
            } else if (doc.processing_status === "failed") {
              setFiles((prev) =>
                prev.map((f) =>
                  f.documentId === doc.id
                    ? { ...f, status: "failed", error: "Classification failed" }
                    : f
                )
              );
            }
          }

          // Check if all tracked documents are done
          const allDone = docs
            .filter((d) => documentIds.includes(d.id))
            .every(
              (d) =>
                d.processing_status === "classified" ||
                d.processing_status === "failed"
            );

          if (allDone) {
            if (pollRef.current) clearInterval(pollRef.current);
            onUploadComplete();
          }
        } catch (err) {
          console.error("Poll error:", err);
        }
      };

      pollRef.current = setInterval(poll, 3000);
    },
    [solicitationId, selectedCompanyId, onUploadComplete]
  );

  const handleUploadAll = async () => {
    if (!files.length || !selectedCompanyId || isUploading) return;

    setIsUploading(true);

    // Mark all queued files as uploading
    setFiles((prev) =>
      prev.map((f) =>
        f.status === "queued" ? { ...f, status: "uploading" } : f
      )
    );

    try {
      const formData = new FormData();
      for (const entry of files) {
        if (entry.status === "queued" || entry.status === "uploading") {
          formData.append("files", entry.file);
        }
      }

      const headers = new Headers();
      headers.set("X-Company-Id", selectedCompanyId);

      const response = await fetch(
        `/api/solicitations/${solicitationId}/upload`,
        { method: "POST", headers, body: formData }
      );

      const data = await response.json();

      if (!response.ok) {
        // Entire request failed — mark all as failed
        setFiles((prev) =>
          prev.map((f) => ({
            ...f,
            status: "failed" as FileUploadStatus,
            error: data.error || "Upload failed",
          }))
        );
        return;
      }

      // Map successful documents back to file entries
      const successDocs: { id: string; filename: string }[] = data.documents || [];
      const errorFiles: { filename: string; error: string }[] = data.errors || [];
      const successIds: string[] = [];

      setFiles((prev) =>
        prev.map((f) => {
          const successDoc = successDocs.find((d) => d.filename === f.file.name);
          if (successDoc) {
            successIds.push(successDoc.id);
            return { ...f, status: "processing" as FileUploadStatus, documentId: successDoc.id };
          }
          const errorEntry = errorFiles.find((e) => e.filename === f.file.name);
          if (errorEntry) {
            return { ...f, status: "failed" as FileUploadStatus, error: errorEntry.error };
          }
          return f;
        })
      );

      // Start polling for classification status
      if (successIds.length > 0) {
        pollForClassification(successIds);
      } else {
        // No successful uploads
        setIsUploading(false);
      }
    } catch (err) {
      console.error("Upload error:", err);
      setFiles((prev) =>
        prev.map((f) => ({
          ...f,
          status: "failed" as FileUploadStatus,
          error: "Network error during upload",
        }))
      );
    } finally {
      setIsUploading(false);
    }
  };

  const queuedFiles = files.filter((f) => f.status === "queued");
  const hasFiles = files.length > 0;
  const canUpload =
    queuedFiles.length > 0 && !!selectedCompanyId && !isUploading;

  return (
    <div className="space-y-4">
      {/* Drag-and-drop zone */}
      <div
        onClick={() => !isUploading && inputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all",
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-muted/50",
          isUploading && "cursor-not-allowed opacity-60"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          multiple
          onChange={handleFileChange}
          className="hidden"
          disabled={isUploading}
        />
        <div className="flex flex-col items-center gap-4">
          <div
            className={cn(
              "flex h-16 w-16 items-center justify-center rounded-2xl transition-colors",
              isDragActive ? "bg-primary/10" : "bg-muted"
            )}
          >
            <Upload
              className={cn(
                "h-8 w-8",
                isDragActive ? "text-primary" : "text-muted-foreground"
              )}
            />
          </div>
          <div>
            <p className="text-base font-medium text-foreground">
              {isDragActive
                ? "Drop your files here"
                : "Drag and drop your solicitation package"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              or click to browse — PDF, DOCX, DOC, XLSX, XLS, TXT
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Upload 10+ files at once. Each file will be classified automatically.
            </p>
          </div>
        </div>
      </div>

      {/* No company warning */}
      {!selectedCompanyId && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm text-amber-800">
            No company selected. Select a company from the header to enable upload.
          </p>
        </div>
      )}

      {/* Per-file list */}
      {hasFiles && (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border bg-muted/30 px-4 py-3">
            <p className="text-sm font-medium text-foreground">
              {files.length} {files.length === 1 ? "file" : "files"} selected
            </p>
          </div>
          <div className="divide-y divide-border">
            {files.map((entry) => (
              <div
                key={entry.file.name}
                className="flex items-center gap-3 px-4 py-3"
              >
                {/* File icon */}
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  {entry.status === "classified" ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : entry.status === "failed" ? (
                    <AlertCircle className="h-5 w-5 text-red-500" />
                  ) : entry.status === "uploading" || entry.status === "processing" ? (
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  ) : (
                    <FileText className="h-5 w-5 text-primary" />
                  )}
                </div>

                {/* File info */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {entry.file.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(entry.file.size)}
                    {entry.error && (
                      <span className="ml-2 text-red-500">{entry.error}</span>
                    )}
                  </p>
                </div>

                {/* Status badge */}
                <span
                  className={cn(
                    "flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium",
                    STATUS_BADGE_CLASSES[entry.status]
                  )}
                >
                  {STATUS_LABELS[entry.status]}
                </span>

                {/* Remove button (only for queued files) */}
                {entry.status === "queued" && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(entry.file.name);
                    }}
                    className="flex-shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label={`Remove ${entry.file.name}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload button */}
      <Button
        onClick={handleUploadAll}
        disabled={!canUpload}
        className="w-full gap-2"
        size="lg"
      >
        <Upload className="h-4 w-4" />
        {!selectedCompanyId
          ? "Select a company first"
          : isUploading
          ? "Uploading..."
          : queuedFiles.length === 0 && hasFiles
          ? "All files uploaded"
          : `Upload ${queuedFiles.length} ${queuedFiles.length === 1 ? "file" : "files"}`}
      </Button>
    </div>
  );
}
