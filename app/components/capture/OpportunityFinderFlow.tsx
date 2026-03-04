"use client";

import { useState } from "react";
import { Loader2, Play, Search, FileText } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { CaptureDocumentUploader } from "./CaptureDocumentUploader";

interface OpportunityFinderFlowProps {
  analysisId: string;
  companyId: string | null;
  onSearchStarted: () => void;
}

export function OpportunityFinderFlow({
  analysisId,
  companyId,
  onSearchStarted,
}: OpportunityFinderFlowProps) {
  const [docCount, setDocCount] = useState(0);
  const [isTriggering, setIsTriggering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSearch = docCount > 0;

  const handleTriggerSearch = async () => {
    setIsTriggering(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/capture/${analysisId}/find-opportunities`,
        { method: "POST" }
      );

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Failed to start opportunity search");
        return;
      }

      onSearchStarted();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsTriggering(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Company Data Upload */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border bg-muted/30 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100">
              <FileText className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">
                Upload Company Data
              </h3>
              <p className="text-sm text-muted-foreground">
                Upload capability statements, past performance summaries, company
                profiles, or any documents that describe your company's
                qualifications.
              </p>
            </div>
          </div>
        </div>
        <div className="p-6">
          <CaptureDocumentUploader
            analysisId={analysisId}
            documentType="company_data"
            label="Company Documents"
            description="Capability statements, company profiles, past performance summaries, certifications — any documents that describe what your company does"
            onFilesUploaded={(files) =>
              setDocCount((prev) => prev + files.length)
            }
          />
        </div>
      </div>

      {/* How it works */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h4 className="text-sm font-semibold text-foreground mb-3">
          How It Works
        </h4>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
              1
            </span>
            <div>
              <p className="text-sm font-medium text-foreground">AI Reads Your Data</p>
              <p className="text-xs text-muted-foreground">
                Extracts NAICS codes, certifications, capabilities, and keywords
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
              2
            </span>
            <div>
              <p className="text-sm font-medium text-foreground">
                Searches SAM.gov
              </p>
              <p className="text-xs text-muted-foreground">
                Finds active solicitations matching your profile across multiple strategies
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple-100 text-xs font-bold text-purple-700">
              3
            </span>
            <div>
              <p className="text-sm font-medium text-foreground">
                Scores & Ranks
              </p>
              <p className="text-xs text-muted-foreground">
                AI ranks every opportunity by relevance with full solicitation details
              </p>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Trigger button */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">
              Ready to Search
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {docCount} company document{docCount !== 1 ? "s" : ""} uploaded
              {companyId && " — will also use company database records"}
            </p>
          </div>
          <Button
            onClick={handleTriggerSearch}
            disabled={!canSearch || isTriggering}
            className="gap-2"
            size="lg"
          >
            {isTriggering ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Starting Search...
              </>
            ) : (
              <>
                <Search className="h-4 w-4" />
                Find Matching Opportunities
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
