"use client";

import { useState, useEffect } from "react";
import {
  Building2,
  CheckCircle2,
  Loader2,
  Play,
  AlertCircle,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/app/components/ui/button";
import { useCompany } from "@/lib/context/CompanyContext";
import { CaptureDocumentUploader } from "./CaptureDocumentUploader";
import type { PastPerformance } from "@/lib/supabase/company-types";

interface DatabaseFlowProps {
  analysisId: string;
  companyId: string | null;
  onAnalysisStarted: () => void;
}

export function DatabaseFlow({
  analysisId,
  companyId,
  onAnalysisStarted,
}: DatabaseFlowProps) {
  const { selectedCompany } = useCompany();
  const [pastPerformances, setPastPerformances] = useState<PastPerformance[]>(
    []
  );
  const [loadingPP, setLoadingPP] = useState(true);
  const [rfpCount, setRfpCount] = useState(0);
  const [isTriggering, setIsTriggering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPPDetails, setShowPPDetails] = useState(false);

  useEffect(() => {
    if (!companyId) {
      setLoadingPP(false);
      return;
    }

    const fetchPastPerformance = async () => {
      setLoadingPP(true);
      try {
        const response = await fetch("/api/company/past-performance", {
          headers: { "X-Company-Id": companyId },
        });

        if (response.ok) {
          const data = await response.json();
          setPastPerformances(data.pastPerformance || data.past_performance || []);
        }
      } catch (err) {
        console.error("Failed to load past performance:", err);
      } finally {
        setLoadingPP(false);
      }
    };

    fetchPastPerformance();
  }, [companyId]);

  const canAnalyze = rfpCount > 0 && pastPerformances.length > 0;

  const handleTriggerAnalysis = async () => {
    setIsTriggering(true);
    setError(null);

    try {
      const response = await fetch(`/api/capture/${analysisId}/analyze`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Failed to start analysis");
        return;
      }

      onAnalysisStarted();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsTriggering(false);
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);

  return (
    <div className="space-y-6">
      {/* Company past performance card */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border bg-muted/30 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">
                Company Past Performance
              </h3>
              <p className="text-sm text-muted-foreground">
                Using stored data from{" "}
                <span className="font-medium text-foreground">
                  {selectedCompany?.company_name || "selected company"}
                </span>
              </p>
            </div>
          </div>
        </div>

        <div className="p-6">
          {loadingPP ? (
            <div className="flex items-center gap-2 py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Loading past performance records...
              </span>
            </div>
          ) : pastPerformances.length === 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 text-amber-500" />
                <div>
                  <p className="text-sm font-medium text-amber-800">
                    No past performance records found
                  </p>
                  <p className="mt-1 text-xs text-amber-700">
                    Add past performance data to your company profile before
                    using database mode, or switch to raw upload mode.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium text-foreground">
                    {pastPerformances.length} past performance record
                    {pastPerformances.length !== 1 ? "s" : ""} available
                  </span>
                </div>
                <button
                  onClick={() => setShowPPDetails(!showPPDetails)}
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  {showPPDetails ? "Hide" : "Show"} details
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 transition-transform",
                      showPPDetails && "rotate-180"
                    )}
                  />
                </button>
              </div>

              {showPPDetails && (
                <div className="space-y-2">
                  {pastPerformances.map((pp) => (
                    <div
                      key={pp.id}
                      className="rounded-lg border border-border bg-muted/20 p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {pp.contract_nickname || pp.contract_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {pp.client_agency}
                            {pp.contract_number && ` — ${pp.contract_number}`}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-medium text-foreground">
                            {formatCurrency(pp.contract_value)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {pp.role}
                          </p>
                        </div>
                      </div>
                      {pp.relevance_tags && pp.relevance_tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {pp.relevance_tags.slice(0, 5).map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
                            >
                              {tag}
                            </span>
                          ))}
                          {pp.relevance_tags.length > 5 && (
                            <span className="text-xs text-muted-foreground">
                              +{pp.relevance_tags.length - 5} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* RFP upload zone */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border bg-muted/30 px-6 py-4">
          <h3 className="text-base font-semibold text-foreground">
            Upload RFP / RFI / SOW Documents
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload the solicitation documents to evaluate against the company's
            past performance.
          </p>
        </div>
        <div className="p-6">
          <CaptureDocumentUploader
            analysisId={analysisId}
            documentType="rfp"
            label="Solicitation Documents"
            description="RFP, RFI, SSL, SOW/PWS, amendments — any documents describing the opportunity"
            onFilesUploaded={(files) =>
              setRfpCount((prev) => prev + files.length)
            }
          />
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Analyze trigger */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">
              Ready to Analyze
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {rfpCount} RFP document{rfpCount !== 1 ? "s" : ""} uploaded
              {pastPerformances.length > 0 && (
                <>
                  {" "}
                  — cross-referencing against {pastPerformances.length} past
                  performance record{pastPerformances.length !== 1 ? "s" : ""}
                </>
              )}
            </p>
          </div>
          <Button
            onClick={handleTriggerAnalysis}
            disabled={!canAnalyze || isTriggering}
            className="gap-2"
            size="lg"
          >
            {isTriggering ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Starting Analysis...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Run Opportunity Analysis
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
