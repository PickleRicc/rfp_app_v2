"use client";

import { useState } from "react";
import { ArrowRight, Loader2, Play } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { CaptureDocumentUploader } from "./CaptureDocumentUploader";

interface RawUploadFlowProps {
  analysisId: string;
  onAnalysisStarted: () => void;
}

export function RawUploadFlow({
  analysisId,
  onAnalysisStarted,
}: RawUploadFlowProps) {
  const [rfpCount, setRfpCount] = useState(0);
  const [ppCount, setPpCount] = useState(0);
  const [isTriggering, setIsTriggering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canAnalyze = rfpCount > 0 && ppCount > 0;

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

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border bg-muted/30 px-6 py-4">
          <h3 className="text-base font-semibold text-foreground">
            Upload RFP / RFI / SOW Documents
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload the solicitation documents you want to evaluate against.
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

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border bg-muted/30 px-6 py-4">
          <h3 className="text-base font-semibold text-foreground">
            Upload Past Performance Documents
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload past performance narratives, CPARs, contract summaries, or any
            documents showing relevant experience.
          </p>
        </div>
        <div className="p-6">
          <CaptureDocumentUploader
            analysisId={analysisId}
            documentType="past_performance"
            label="Past Performance Documents"
            description="Performance narratives, CPARs, contract summaries, capability statements"
            onFilesUploaded={(files) =>
              setPpCount((prev) => prev + files.length)
            }
          />
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">
              Ready to Analyze
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {rfpCount} RFP document{rfpCount !== 1 ? "s" : ""} and {ppCount}{" "}
              past performance document{ppCount !== 1 ? "s" : ""} uploaded
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
