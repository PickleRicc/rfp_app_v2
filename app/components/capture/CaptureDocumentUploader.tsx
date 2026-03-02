"use client";

import { useState, useCallback, useRef } from "react";
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/app/components/ui/button";

interface UploadedFile {
  id: string;
  filename: string;
  status: "uploading" | "complete" | "error";
  error?: string;
}

interface CaptureDocumentUploaderProps {
  analysisId: string;
  documentType: "rfp" | "past_performance";
  label: string;
  description: string;
  accept?: string;
  onFilesUploaded?: (files: UploadedFile[]) => void;
}

export function CaptureDocumentUploader({
  analysisId,
  documentType,
  label,
  description,
  accept = ".pdf,.docx,.doc,.txt",
  onFilesUploaded,
}: CaptureDocumentUploaderProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const filesToUpload = Array.from(fileList);
      if (!filesToUpload.length) return;

      setIsUploading(true);

      const pending: UploadedFile[] = filesToUpload.map((f) => ({
        id: crypto.randomUUID(),
        filename: f.name,
        status: "uploading" as const,
      }));

      setFiles((prev) => [...prev, ...pending]);

      const formData = new FormData();
      filesToUpload.forEach((f) => formData.append("files", f));
      formData.append("document_type", documentType);

      try {
        const response = await fetch(`/api/capture/${analysisId}/upload`, {
          method: "POST",
          body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
          setFiles((prev) =>
            prev.map((f) =>
              pending.find((p) => p.id === f.id)
                ? { ...f, status: "error" as const, error: data.error }
                : f
            )
          );
          return;
        }

        const uploadedNames = new Set(
          (data.uploaded || []).map((u: { filename: string }) => u.filename)
        );
        const errorMap = new Map(
          (data.errors || []).map((e: string) => {
            const [name, ...rest] = e.split(": ");
            return [name, rest.join(": ")];
          })
        );

        setFiles((prev) =>
          prev.map((f) => {
            if (!pending.find((p) => p.id === f.id)) return f;
            if (uploadedNames.has(f.filename)) {
              return { ...f, status: "complete" as const };
            }
            return {
              ...f,
              status: "error" as const,
              error: (errorMap.get(f.filename) as string) || "Upload failed",
            };
          })
        );

        if (data.uploaded?.length && onFilesUploaded) {
          onFilesUploaded(data.uploaded);
        }
      } catch {
        setFiles((prev) =>
          prev.map((f) =>
            pending.find((p) => p.id === f.id)
              ? { ...f, status: "error" as const, error: "Network error" }
              : f
          )
        );
      } finally {
        setIsUploading(false);
      }
    },
    [analysisId, documentType, onFilesUploaded]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragActive(false);
      uploadFiles(e.dataTransfer.files);
    },
    [uploadFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragActive(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        uploadFiles(e.target.files);
      }
    },
    [uploadFiles]
  );

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const completedCount = files.filter((f) => f.status === "complete").length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        {completedCount > 0 && (
          <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
            {completedCount} uploaded
          </span>
        )}
      </div>

      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors",
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-muted/30"
        )}
      >
        <Upload
          className={cn(
            "h-8 w-8",
            isDragActive ? "text-primary" : "text-muted-foreground/50"
          )}
        />
        <div>
          <p className="text-sm font-medium text-foreground">
            {isDragActive ? "Drop files here" : "Drag & drop files"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            or click to browse — PDF, DOCX, DOC, TXT (up to 20MB each)
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept}
          onChange={handleInputChange}
          className="hidden"
        />
      </div>

      {files.length > 0 && (
        <div className="space-y-1.5">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2"
            >
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate text-sm text-foreground">
                {file.filename}
              </span>
              {file.status === "uploading" && (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              )}
              {file.status === "complete" && (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              )}
              {file.status === "error" && (
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <span className="text-xs text-red-600">{file.error}</span>
                </div>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(file.id);
                }}
                className="shrink-0 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
