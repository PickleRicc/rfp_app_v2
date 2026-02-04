'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PartyPopper, FileText, Rocket } from 'lucide-react';
import DocumentProgress from '@/app/components/DocumentProgress';

type DocumentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'generating_proposal' | 'proposal_ready';
type DocumentType = 'rfp' | 'proposal' | 'contract' | 'other' | 'unknown';

interface Document {
  id: string;
  filename: string;
  document_type: DocumentType;
  status: DocumentStatus;
  created_at: string;
  updated_at: string;
}

interface SectionResult {
  id: string;
  section_name: string;
  section_number: number;
  content: {
    found: boolean;
    summary: string;
    key_points: string[];
    critical_info: string[];
    notes: string;
  };
  created_at: string;
}

export default function ResultsPage() {
  const params = useParams();
  const documentId = params.id as string;

  const [document, setDocument] = useState<Document | null>(null);
  const [sections, setSections] = useState<SectionResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingProposal, setGeneratingProposal] = useState(false);
  const [proposalError, setProposalError] = useState<string | null>(null);
  const [hasProposal, setHasProposal] = useState(false);

  const handleGenerateProposal = async () => {
    setGeneratingProposal(true);
    setProposalError(null);

    try {
      const response = await fetch('/api/generate-proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to start proposal generation');
      }

      // Success - the document status will update via polling
      console.log('✅ Proposal generation started');
    } catch (err) {
      setProposalError(err instanceof Error ? err.message : 'Failed to generate proposal');
      setGeneratingProposal(false);
    }
  };

  const fetchResults = async () => {
    try {
      const response = await fetch(`/api/results/${documentId}`);

      if (!response.ok) {
        throw new Error('Failed to fetch results');
      }

      const data = await response.json();
      setDocument(data.document);
      setSections(data.sections || []);
      setError(null);
      
      // Check if proposal exists
      const proposalCheck = await fetch(`/api/proposals/${documentId}`);
      if (proposalCheck.ok) {
        const proposalData = await proposalCheck.json();
        setHasProposal(proposalData.volumes && proposalData.volumes.length > 0);
      }
      
      // Return status for polling check
      return data.document.status;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load results');
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!documentId) return;

    // Initial fetch
    fetchResults();

    // Poll every 3 seconds while processing or generating
    const interval = setInterval(async () => {
      const status = await fetchResults();
      
      // Reset generating state if proposal is ready
      if (status === 'proposal_ready' || status === 'completed') {
        setGeneratingProposal(false);
      }
      
      // Stop polling if reached final state
      if (status === 'completed' || status === 'failed' || status === 'proposal_ready') {
        clearInterval(interval);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [documentId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="h-12 w-12 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto mb-4" />
              <p className="text-muted-foreground">Loading results...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="min-h-screen bg-background">
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6">
            <h2 className="text-xl font-semibold text-foreground mb-2">Error</h2>
            <p className="text-destructive">{error || "Document not found"}</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <a href="/" className="text-primary hover:underline mb-4 inline-block">
            ← Back to Upload
          </a>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl mb-2">
            Document Analysis
          </h1>
          <p className="text-muted-foreground">{document.filename}</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Status</p>
              <StatusBadge status={document.status} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Document Type</p>
              <TypeBadge type={document.document_type} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Uploaded</p>
              <p className="font-medium text-foreground">{new Date(document.created_at).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Sections Analyzed</p>
              <p className="font-medium text-foreground">{sections.length} / 8</p>
            </div>
          </div>
        </div>

        {hasProposal && (
          <div className="rounded-xl border-2 border-callout-border bg-callout p-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold text-foreground mb-2 flex items-center gap-2">
                  <PartyPopper className="h-7 w-7 text-primary" />
                  Proposal Ready!
                </h3>
                <p className="text-muted-foreground">
                  Your proposal has been generated successfully. Click to view and download.
                </p>
              </div>
              <a
                href={`/proposals/${documentId}`}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-8 py-4 font-semibold text-lg text-primary-foreground shadow-md hover:bg-primary/90"
              >
                <FileText className="h-5 w-5" />
                View Proposal
              </a>
            </div>
          </div>
        )}

        {!hasProposal && document.status === "completed" && document.document_type === "rfp" && sections.length > 0 && (
          <div className="rounded-xl border border-callout-border bg-callout p-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-foreground mb-2">Ready to Generate Proposal</h3>
                <p className="text-muted-foreground mb-1">
                  RFP analysis complete with {sections.length} sections extracted.
                </p>
                <p className="text-sm text-muted-foreground">
                Click below to generate a complete proposal response using your company data.
              </p>
            </div>
            <button
              onClick={handleGenerateProposal}
              disabled={generatingProposal}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-8 py-4 font-semibold text-lg text-primary-foreground shadow-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {generatingProposal ? (
                <>
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  Generating...
                </>
              ) : (
                <>
                  <Rocket className="h-5 w-5" />
                  Generate Proposal
                </>
              )}
            </button>
          </div>
          {proposalError && (
            <div className="mt-4 rounded border border-destructive/30 bg-destructive/10 p-3">
              <p className="text-destructive text-sm">{proposalError}</p>
            </div>
          )}
        </div>
      )}

      {/* Progress Tracker - Show for all processing states */}
      {(document.status === 'processing' || 
        document.status === 'completed' ||
        document.status === 'generating_proposal' || 
        document.status === 'proposal_ready') && (
        <DocumentProgress documentId={documentId} onComplete={fetchResults} />
      )}

      {/* Failed Status */}
      {document.status === "failed" && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 mb-6">
          <h3 className="font-semibold text-foreground mb-2">Processing Failed</h3>
          <p className="text-destructive">
            There was an error processing this document. Please try uploading again.
          </p>
        </div>
      )}

      {document.status === "completed" && sections.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-foreground">Extracted Intelligence</h2>

          {sections
            .sort((a, b) => a.section_number - b.section_number)
            .map((section) => (
              <SectionCard key={section.id} section={section} />
            ))}
        </div>
      )}

      {document.status === "completed" && sections.length === 0 && (
        <div className="rounded-xl border border-warning/30 bg-warning/5 p-6">
          <p className="text-foreground">
            No sections were analyzed. This might not be an RFP document.
          </p>
        </div>
      )}
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: DocumentStatus }) {
  const styles = {
    pending: "bg-muted text-muted-foreground",
    processing: "bg-primary/10 text-primary",
    completed: "bg-success/10 text-success",
    failed: "bg-destructive/10 text-destructive",
    generating_proposal: "bg-warning/10 text-warning-foreground",
    proposal_ready: "bg-success/10 text-success",
  };

  const labels = {
    pending: 'Pending',
    processing: 'Processing',
    completed: 'Completed',
    failed: 'Failed',
    generating_proposal: 'Generating Proposal',
    proposal_ready: 'Proposal Ready',
  };

  return (
    <span className={`px-3 py-1 rounded-full text-sm font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function TypeBadge({ type }: { type: DocumentType | null }) {
  const styles = {
    rfp: "bg-primary/10 text-primary",
    proposal: "bg-primary/10 text-primary",
    contract: "bg-success/10 text-success",
    other: "bg-muted text-muted-foreground",
    unknown: "bg-muted text-muted-foreground",
  };

  // Handle null or undefined type
  const displayType = type || 'unknown';
  const style = styles[displayType] || styles.unknown;

  return (
    <span className={`px-3 py-1 rounded-full text-sm font-medium ${style}`}>
      {displayType.toUpperCase()}
    </span>
  );
}

function SectionCard({ section }: { section: SectionResult }) {
  const content = section.content;

  if (!content.found) {
    return (
      <div className="rounded-xl border border-border bg-muted/30 p-6">
        <h3 className="text-xl font-semibold text-foreground mb-2">
          {section.section_number}. {section.section_name}
        </h3>
        <p className="text-muted-foreground italic">Section not found in document</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h3 className="text-xl font-semibold text-foreground mb-4">
        {section.section_number}. {section.section_name}
      </h3>

      <div className="mb-4">
        <h4 className="font-medium text-foreground mb-2">Summary</h4>
        <p className="text-muted-foreground leading-relaxed">{content.summary}</p>
      </div>

      {content.key_points && content.key_points.length > 0 && (
        <div className="mb-4">
          <h4 className="font-medium text-foreground mb-2">Key Points</h4>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            {content.key_points.map((point, idx) => (
              <li key={idx}>{point}</li>
            ))}
          </ul>
        </div>
      )}

      {content.critical_info && content.critical_info.length > 0 && (
        <div className="mb-4">
          <h4 className="font-medium text-foreground mb-2">Critical Information</h4>
          <div className="rounded border border-warning/30 bg-warning/5 p-3">
            <ul className="list-disc list-inside space-y-1 text-foreground">
              {content.critical_info.map((info, idx) => (
                <li key={idx}>{info}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {content.notes && (
        <div className="rounded border border-primary/20 bg-primary/5 p-3">
          <p className="text-sm text-foreground">
            <span className="font-medium">Note:</span> {content.notes}
          </p>
        </div>
      )}
    </div>
  );
}
