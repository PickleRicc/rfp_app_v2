"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Upload,
  Database,
  CheckCircle2,
  Crosshair,
  Search,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/app/components/ui/button";
import { useCompany } from "@/lib/context/CompanyContext";
import { RawUploadFlow } from "@/app/components/capture/RawUploadFlow";
import { DatabaseFlow } from "@/app/components/capture/DatabaseFlow";
import { OpportunityFinderFlow } from "@/app/components/capture/OpportunityFinderFlow";
import type { AnalysisMode } from "@/lib/supabase/capture-types";

type Step = "mode" | "details" | "upload" | "analyzing";

function NewAnalysisPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { selectedCompanyId, selectedCompany } = useCompany();

  const initialMode = searchParams.get("mode") as AnalysisMode | null;

  const [currentStep, setCurrentStep] = useState<Step>(
    initialMode ? "details" : "mode"
  );
  const [mode, setMode] = useState<AnalysisMode | null>(initialMode);

  const [title, setTitle] = useState("");
  const [solicitationNumber, setSolicitationNumber] = useState("");
  const [agency, setAgency] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [analysisId, setAnalysisId] = useState<string | null>(null);

  const handleSelectMode = (selectedMode: AnalysisMode) => {
    setMode(selectedMode);
    setCurrentStep("details");
  };

  const handleCreateAnalysis = async () => {
    if (!title.trim()) {
      setCreateError("Title is required.");
      return;
    }

    if (mode === "database" && !selectedCompanyId) {
      setCreateError(
        "Database mode requires a company selection. Please select a company from the header."
      );
      return;
    }

    setIsCreating(true);
    setCreateError(null);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (selectedCompanyId) {
        headers["X-Company-Id"] = selectedCompanyId;
      }

      const response = await fetch("/api/capture", {
        method: "POST",
        headers,
        body: JSON.stringify({
          mode,
          title: title.trim(),
          solicitation_number: solicitationNumber.trim() || undefined,
          agency: agency.trim() || undefined,
          company_id: (mode === "database" || mode === "finder") ? selectedCompanyId : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setCreateError(data.error || "Failed to create analysis.");
        return;
      }

      setAnalysisId(data.analysis.id);
      setCurrentStep("upload");
    } catch {
      setCreateError("Network error. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleAnalysisStarted = () => {
    setCurrentStep("analyzing");
    if (analysisId) {
      router.push(`/capture/${analysisId}`);
    }
  };

  const stepNumber =
    currentStep === "mode"
      ? 1
      : currentStep === "details"
      ? 2
      : currentStep === "upload"
      ? 3
      : 4;

  const steps = [
    { num: 1, label: "Select Mode" },
    { num: 2, label: "Details" },
    { num: 3, label: mode === "finder" ? "Upload & Search" : "Upload & Analyze" },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8">
        <Link
          href="/capture"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Capture
        </Link>
        <h1 className="text-2xl font-bold text-foreground">
          New Opportunity Analysis
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Evaluate whether an RFP is a good fit based on past performance and
          capabilities.
        </p>
      </div>

      {/* Step indicator */}
      <div className="mb-8 flex items-center gap-4">
        {steps.map((s, i) => (
          <div key={s.num} className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold",
                  stepNumber > s.num
                    ? "bg-green-500 text-white"
                    : stepNumber === s.num
                    ? "bg-primary text-white"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {stepNumber > s.num ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  s.num
                )}
              </div>
              <span
                className={cn(
                  "text-sm font-medium",
                  stepNumber === s.num
                    ? "text-foreground"
                    : "text-muted-foreground"
                )}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && <div className="h-px w-8 bg-border" />}
          </div>
        ))}
      </div>

      {/* Step 1: Mode selection */}
      {currentStep === "mode" && (
        <div className="grid gap-4 sm:grid-cols-3">
          <button
            onClick={() => handleSelectMode("finder")}
            className="group rounded-xl border-2 border-emerald-300 bg-card p-6 text-left transition-all hover:border-emerald-500 hover:shadow-md ring-2 ring-emerald-100"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-100 transition-colors group-hover:bg-emerald-200">
              <Search className="h-6 w-6 text-emerald-600" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              Opportunity Finder
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Upload company data and AI will find matching federal
              opportunities on SAM.gov with full solicitation details.
            </p>
            <div className="mt-4 flex items-center gap-1.5 text-sm font-medium text-emerald-600">
              Select this mode
              <ArrowRight className="h-4 w-4" />
            </div>
          </button>

          <button
            onClick={() => handleSelectMode("raw")}
            className="group rounded-xl border-2 border-border bg-card p-6 text-left transition-all hover:border-primary hover:shadow-md"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 transition-colors group-hover:bg-blue-200">
              <Upload className="h-6 w-6 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              Raw Upload
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Upload both RFP documents and past performance documents manually.
              Best when evaluating for a new prospect or external data.
            </p>
            <div className="mt-4 flex items-center gap-1.5 text-sm font-medium text-primary">
              Select this mode
              <ArrowRight className="h-4 w-4" />
            </div>
          </button>

          <button
            onClick={() => handleSelectMode("database")}
            className={cn(
              "group rounded-xl border-2 border-border bg-card p-6 text-left transition-all hover:border-primary hover:shadow-md",
              !selectedCompanyId && "opacity-60"
            )}
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100 transition-colors group-hover:bg-purple-200">
              <Database className="h-6 w-6 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              Company Database
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Use past performance data already stored for a company in our
              system. Just upload the RFP and we'll do the rest.
            </p>
            {selectedCompanyId ? (
              <div className="mt-4 flex items-center gap-1.5 text-sm font-medium text-primary">
                Select this mode
                <ArrowRight className="h-4 w-4" />
              </div>
            ) : (
              <p className="mt-4 text-xs text-amber-600">
                Select a company from the header to use this mode.
              </p>
            )}
          </button>
        </div>
      )}

      {/* Step 2: Details form */}
      {currentStep === "details" && (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border bg-muted/30 px-6 py-4">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg",
                  mode === "finder"
                    ? "bg-emerald-100"
                    : mode === "raw"
                    ? "bg-blue-100"
                    : "bg-purple-100"
                )}
              >
                {mode === "finder" ? (
                  <Search className="h-4 w-4 text-emerald-600" />
                ) : mode === "raw" ? (
                  <Upload className="h-4 w-4 text-blue-600" />
                ) : (
                  <Database className="h-4 w-4 text-purple-600" />
                )}
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  {mode === "finder" ? "Search Details" : "Analysis Details"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {mode === "finder"
                    ? "Opportunity Finder"
                    : mode === "raw"
                    ? "Raw Upload"
                    : "Company Database"}{" "}
                  mode
                  {(mode === "database" || mode === "finder") &&
                    selectedCompany &&
                    ` — ${selectedCompany.company_name}`}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4 p-6">
            <div className="space-y-1">
              <label
                htmlFor="analysis-title"
                className="block text-sm font-medium text-foreground"
              >
                Analysis Title <span className="text-red-500">*</span>
              </label>
              <input
                id="analysis-title"
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setCreateError(null);
                }}
                placeholder={
                  mode === "finder"
                    ? "e.g., Acme Corp IT Services Opportunity Search"
                    : "e.g., DISA Cloud Migration Services Evaluation"
                }
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {mode !== "finder" && (
              <>
                <div className="space-y-1">
                  <label
                    htmlFor="sol-number"
                    className="block text-sm font-medium text-foreground"
                  >
                    Solicitation Number{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      (optional)
                    </span>
                  </label>
                  <input
                    id="sol-number"
                    type="text"
                    value={solicitationNumber}
                    onChange={(e) => setSolicitationNumber(e.target.value)}
                    placeholder="e.g., W911NF-24-R-0001"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="agency"
                    className="block text-sm font-medium text-foreground"
                  >
                    Agency{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      (optional)
                    </span>
                  </label>
                  <input
                    id="agency"
                    type="text"
                    value={agency}
                    onChange={(e) => setAgency(e.target.value)}
                    placeholder="e.g., Department of Defense"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </>
            )}

            {createError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-700">{createError}</p>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setCurrentStep("mode");
                  setMode(null);
                }}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Change Mode
              </Button>
              <Button
                onClick={handleCreateAnalysis}
                disabled={!title.trim() || isCreating}
                className="flex-1 gap-2"
                size="lg"
              >
                {isCreating ? "Creating..." : "Continue to Upload"}
                {!isCreating && <ArrowRight className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Upload & Analyze / Search */}
      {currentStep === "upload" && analysisId && (
        <>
          {mode === "finder" ? (
            <OpportunityFinderFlow
              analysisId={analysisId}
              companyId={selectedCompanyId}
              onSearchStarted={handleAnalysisStarted}
            />
          ) : mode === "raw" ? (
            <RawUploadFlow
              analysisId={analysisId}
              onAnalysisStarted={handleAnalysisStarted}
            />
          ) : (
            <DatabaseFlow
              analysisId={analysisId}
              companyId={selectedCompanyId}
              onAnalysisStarted={handleAnalysisStarted}
            />
          )}
        </>
      )}

      {/* Step 4: Analyzing (redirect in progress) */}
      {currentStep === "analyzing" && (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Crosshair className="h-8 w-8 animate-pulse text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">
            Analysis in Progress
          </h3>
          <p className="text-sm text-muted-foreground">
            Redirecting to your analysis results...
          </p>
        </div>
      )}
    </div>
  );
}

export default function NewAnalysisPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-3xl px-4 py-8 text-muted-foreground text-sm">Loading...</div>}>
      <NewAnalysisPageInner />
    </Suspense>
  );
}
