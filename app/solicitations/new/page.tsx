"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { AlertBanner } from "@/app/components/ui/alert-banner";
import { SolicitationUploader } from "@/app/components/solicitation/SolicitationUploader";
import { DocumentClassificationTable } from "@/app/components/solicitation/DocumentClassificationTable";
import { useCompany } from "@/lib/context/CompanyContext";
import type {
  SolicitationDocument,
  SolicitationDocumentType,
} from "@/lib/supabase/solicitation-types";

type Step = "create" | "upload" | "review";

/**
 * New Solicitation Page
 *
 * Guided three-step flow for creating a solicitation package:
 * Step 1: Enter solicitation number, title (optional), agency (optional)
 * Step 2: Upload solicitation documents (multi-file drag-drop)
 * Step 3: Review AI classification results and reclassify if needed
 *
 * After review, user proceeds to the solicitation detail page for reconciliation.
 */
export default function NewSolicitationPage() {
  const router = useRouter();
  const { selectedCompanyId } = useCompany();

  // Step tracking
  const [currentStep, setCurrentStep] = useState<Step>("create");

  // Step 1 form state
  const [solicitationNumber, setSolicitationNumber] = useState("");
  const [title, setTitle] = useState("");
  const [agency, setAgency] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [detectedSolicitationNumber, setDetectedSolicitationNumber] = useState<string | null>(null);

  // Created solicitation ID (set after Step 1 completes)
  const [solicitationId, setSolicitationId] = useState<string | null>(null);

  // Step 3 documents state
  const [documents, setDocuments] = useState<SolicitationDocument[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);

  // Step 1: Create the solicitation
  const handleCreateSolicitation = async () => {
    const number = solicitationNumber.trim();
    if (!number) {
      setCreateError("Solicitation number is required.");
      return;
    }
    if (!selectedCompanyId) {
      setCreateError("No company selected. Please select a company from the header.");
      return;
    }

    setIsCreating(true);
    setCreateError(null);

    try {
      const headers = new Headers({
        "Content-Type": "application/json",
        "X-Company-Id": selectedCompanyId,
      });

      const response = await fetch("/api/solicitations", {
        method: "POST",
        headers,
        body: JSON.stringify({
          solicitation_number: number,
          title: title.trim() || undefined,
          agency: agency.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409 && data.existing_id) {
          setCreateError(
            `A solicitation with number "${number}" already exists for this company.`
          );
          return;
        }
        setCreateError(data.error || "Failed to create solicitation. Please try again.");
        return;
      }

      setSolicitationId(data.solicitation.id);
      setCurrentStep("upload");
    } catch (err) {
      console.error("Create solicitation error:", err);
      setCreateError("Network error. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  // Step 2: After upload + classification complete, load docs and proceed to review
  const handleUploadComplete = async () => {
    if (!solicitationId || !selectedCompanyId) return;

    setIsLoadingDocs(true);
    try {
      const headers = new Headers({ "X-Company-Id": selectedCompanyId });
      const response = await fetch(
        `/api/solicitations/${solicitationId}/documents`,
        { headers }
      );

      if (response.ok) {
        const data = await response.json();
        const docs: SolicitationDocument[] = data.documents || [];
        setDocuments(docs);

        // Check if any doc has a detected solicitation number and pre-fill
        const detected = docs
          .map((d) => {
            // solicitation_number_detected is logged in processing_logs
            // For now, check if the solicitation number differs from what was entered
            return null;
          })
          .find(Boolean);

        if (detected) {
          setDetectedSolicitationNumber(detected as string);
        }
      }
    } catch (err) {
      console.error("Failed to load documents:", err);
    } finally {
      setIsLoadingDocs(false);
      setCurrentStep("review");
    }
  };

  // Step 3: Handle reclassification
  const handleReclassify = async (docId: string, newType: SolicitationDocumentType) => {
    if (!selectedCompanyId) return;

    try {
      const headers = new Headers({
        "Content-Type": "application/json",
        "X-Company-Id": selectedCompanyId,
      });

      // PATCH the document's type
      const response = await fetch(
        `/api/solicitations/${solicitationId}/documents/${docId}`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({ document_type: newType }),
        }
      );

      if (response.ok) {
        // Update local state optimistically
        setDocuments((prev) =>
          prev.map((d) =>
            d.id === docId
              ? {
                  ...d,
                  document_type: newType,
                  document_type_label:
                    newType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
                }
              : d
          )
        );
      }
    } catch (err) {
      console.error("Reclassify error:", err);
    }
  };

  // Navigate to solicitation detail (reconciliation is Plan 04's UI)
  const handleContinueToReconciliation = () => {
    if (solicitationId) {
      router.push(`/solicitations/${solicitationId}`);
    }
  };

  const stepNumber = currentStep === "create" ? 1 : currentStep === "upload" ? 2 : 3;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Back link */}
      <Link
        href="/solicitations"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Solicitations
      </Link>

      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">New Solicitation Package</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload and classify all files in your solicitation package in one flow.
        </p>
      </div>

      {/* Step indicator */}
      <div className="mb-8 flex items-center gap-3">
        {[
          { num: 1, label: "Details" },
          { num: 2, label: "Upload" },
          { num: 3, label: "Review" },
        ].map((s, i) => (
          <div key={s.num} className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                  stepNumber > s.num
                    ? "bg-success text-success-foreground"
                    : stepNumber === s.num
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {stepNumber > s.num ? <CheckCircle2 className="h-4 w-4" /> : s.num}
              </div>
              <span
                className={`text-sm font-medium transition-colors ${
                  stepNumber === s.num ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {s.label}
              </span>
            </div>
            {i < 2 && <div className="h-px w-10 bg-border" />}
          </div>
        ))}
      </div>

      {/* Step 1: Create solicitation */}
      {currentStep === "create" && (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border bg-muted/30 px-6 py-4">
            <h2 className="text-base font-semibold text-foreground">
              Step 1: Solicitation Details
            </h2>
          </div>
          <div className="p-6 space-y-4">
            {!selectedCompanyId && (
              <AlertBanner
                variant="warning"
                message="No company selected. Please select a company from the header."
              />
            )}

            <div className="space-y-1.5">
              <label htmlFor="sol-number" className="block text-sm font-medium text-foreground">
                Solicitation Number <span className="text-destructive">*</span>
              </label>
              <Input
                id="sol-number"
                type="text"
                value={solicitationNumber}
                onChange={(e) => {
                  setSolicitationNumber(e.target.value);
                  setCreateError(null);
                }}
                placeholder="e.g., W911NF-24-R-0001"
              />
              {detectedSolicitationNumber && (
                <p className="text-xs text-success">
                  Detected from uploaded documents: {detectedSolicitationNumber}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="sol-title" className="block text-sm font-medium text-foreground">
                Title{" "}
                <span className="text-xs font-normal text-muted-foreground">(optional)</span>
              </label>
              <Input
                id="sol-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Advanced Research for Autonomous Systems"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="sol-agency" className="block text-sm font-medium text-foreground">
                Agency{" "}
                <span className="text-xs font-normal text-muted-foreground">(optional)</span>
              </label>
              <Input
                id="sol-agency"
                type="text"
                value={agency}
                onChange={(e) => setAgency(e.target.value)}
                placeholder="e.g., Army Research Laboratory"
              />
            </div>

            {createError && (
              <AlertBanner variant="error" message={createError} />
            )}

            <Button
              onClick={handleCreateSolicitation}
              disabled={!solicitationNumber.trim() || isCreating || !selectedCompanyId}
              className="w-full gap-2"
              size="lg"
            >
              {isCreating ? "Creating..." : "Create Solicitation"}
              {!isCreating && <ArrowRight className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Upload documents */}
      {currentStep === "upload" && solicitationId && (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border bg-muted/30 px-6 py-4">
            <h2 className="text-base font-semibold text-foreground">
              Step 2: Upload Solicitation Documents
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Drag and drop all files in your solicitation package. Each file will be
              automatically classified by type.
            </p>
          </div>
          <div className="p-6">
            <SolicitationUploader
              solicitationId={solicitationId}
              onUploadComplete={handleUploadComplete}
            />
          </div>
        </div>
      )}

      {/* Step 3: Review classification */}
      {currentStep === "review" && (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="border-b border-border bg-muted/30 px-6 py-4">
              <h2 className="text-base font-semibold text-foreground">
                Step 3: Review Classification
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Each document has been automatically classified. Click a type badge to
                reclassify. Low-confidence classifications show a warning icon.
              </p>
            </div>
            <div className="p-6">
              {isLoadingDocs ? (
                <p className="text-sm text-muted-foreground">Loading classified documents...</p>
              ) : (
                <DocumentClassificationTable
                  solicitationId={solicitationId ?? ""}
                  documents={documents}
                  onReclassify={handleReclassify}
                />
              )}
            </div>
          </div>

          <Button
            onClick={handleContinueToReconciliation}
            className="w-full gap-2"
            size="lg"
          >
            Continue to Reconciliation
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
