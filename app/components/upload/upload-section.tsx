"use client";

import { useState, useCallback, useRef, type DragEvent, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Upload,
  FileText,
  X,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  FileSearch,
  ClipboardList,
  Database,
  Rocket,
} from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Progress } from "@/app/components/ui/progress";
import Link from "next/link";
import { useCompany } from "@/lib/context/CompanyContext";

const steps = [
  { icon: Upload, title: "Upload Document", description: "Upload your RFP document in PDF format" },
  { icon: FileSearch, title: "Classification", description: "Document is classified (RFP, proposal, contract, or other)" },
  { icon: ClipboardList, title: "Analysis", description: "8 key sections are analyzed: Executive Summary, Project Scope, Technical Requirements, and more" },
  { icon: Database, title: "Save Results", description: "Results are saved to the database for review" },
  { icon: Rocket, title: "Generate Proposal", description: "Generate a complete proposal from analyzed RFPs" },
];

const analyzedSections = [
  "Executive Summary",
  "Project Scope",
  "Technical Requirements",
  "Timeline and Milestones",
  "Budget and Pricing",
  "Evaluation Criteria",
  "Submission Requirements",
  "Key Stakeholders",
];

export function UploadSection() {
  const router = useRouter();
  const { selectedCompany, selectedCompanyId } = useCompany();
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragActive, setIsDragActive] = useState(false);
  const [result, setResult] = useState<{ success?: boolean; error?: string; document?: { id: string } } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    const pdfFile = droppedFiles.find((f) => f.type === "application/pdf") ?? droppedFiles[0];
    if (pdfFile) setFile(pdfFile);
  }, []);

  const handleFileChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles?.length) setFile(selectedFiles[0]);
  }, []);

  const handleClick = () => inputRef.current?.click();

  const handleUpload = async () => {
    if (!file || !selectedCompanyId) return;
    setIsUploading(true);
    setResult(null);
    setUploadProgress(20);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const headers = new Headers();
      headers.set("X-Company-Id", selectedCompanyId);
      setUploadProgress(50);
      const response = await fetch("/api/upload", { method: "POST", headers, body: formData });
      const data = await response.json();
      setUploadProgress(100);
      if (data.success && data.document?.id) {
        setResult({ success: true, document: data.document });
        router.push(`/results/${data.document.id}`);
      } else {
        setResult({ error: data.error ?? "Upload failed" });
      }
    } catch (err) {
      setUploadProgress(0);
      setResult({ error: "Upload failed" });
    } finally {
      setIsUploading(false);
    }
  };

  const removeFile = () => {
    setFile(null);
    setUploadProgress(0);
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="space-y-6">
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border bg-muted/30 px-6 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Upload Document</h2>
              <Link
                href="/documents"
                className="text-sm font-medium text-primary hover:underline flex items-center gap-1"
              >
                View All Documents
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
          <div className="p-6">
            {!selectedCompanyId && (
              <div className="mb-4 rounded-lg border border-warning/30 bg-warning/5 p-4">
                <p className="text-sm font-medium text-foreground">No company selected</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Select a company from the header above before uploading.
                </p>
              </div>
            )}
            <div
              onClick={handleClick}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={cn(
                "relative cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all",
                isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/50"
              )}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".txt,.pdf,.doc,.docx"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="flex flex-col items-center gap-4">
                <div className={cn("flex h-16 w-16 items-center justify-center rounded-2xl transition-colors", isDragActive ? "bg-primary/10" : "bg-muted")}>
                  <Upload className={cn("h-8 w-8", isDragActive ? "text-primary" : "text-muted-foreground")} />
                </div>
                <div>
                  <p className="text-base font-medium text-foreground">
                    {isDragActive ? "Drop your file here" : "Drag and drop your RFP document"}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">or click to browse (PDF, DOC, DOCX, TXT)</p>
                </div>
              </div>
            </div>

            {file && (
              <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{file.name}</p>
                      <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={removeFile} className="h-8 w-8">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                {isUploading && (
                  <div className="mt-3">
                    <Progress value={uploadProgress} className="h-2" />
                    <p className="mt-1 text-xs text-muted-foreground">Uploading... {uploadProgress}%</p>
                  </div>
                )}
              </div>
            )}

            <Button
              onClick={handleUpload}
              disabled={!file || isUploading || !selectedCompanyId}
              className="mt-4 w-full gap-2"
              size="lg"
            >
              <Sparkles className="h-4 w-4" />
              {isUploading ? "Processing..." : !selectedCompanyId ? "Select a company first" : "Upload and Analyze"}
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-callout-border bg-callout p-4">
          <div className="flex gap-3">
            <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-primary" />
            <div>
              <p className="text-sm font-medium text-foreground">Pro Tip</p>
              <p className="mt-1 text-sm text-muted-foreground">
                All uploaded documents are saved. Visit the{" "}
                <Link href="/documents" className="font-medium text-primary hover:underline">
                  Documents page
                </Link>{" "}
                to view previous analyses and generate proposals without re-uploading.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-callout-border bg-callout">
        <div className="border-b border-callout-border px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">How it works</h2>
        </div>
        <div className="p-6">
          <div className="space-y-6">
            {steps.map((step, index) => (
              <div key={step.title} className="flex gap-4">
                <div className="relative">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <step.icon className="h-5 w-5 text-primary" />
                  </div>
                  {index < steps.length - 1 && (
                    <div className="absolute left-1/2 top-12 h-6 w-px -translate-x-1/2 bg-border" />
                  )}
                </div>
                <div className="flex-1 pt-1">
                  <p className="text-sm font-medium text-foreground">
                    {index + 1}. {step.title}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{step.description}</p>
                  {index === 2 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {analyzedSections.map((s) => (
                        <span key={s} className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
