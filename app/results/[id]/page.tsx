'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
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
      <main className="min-h-screen p-8 max-w-6xl mx-auto">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading results...</p>
          </div>
        </div>
      </main>
    );
  }

  if (error || !document) {
    return (
      <main className="min-h-screen p-8 max-w-6xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-red-900 mb-2">Error</h2>
          <p className="text-red-700">{error || 'Document not found'}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <a href="/" className="text-blue-600 hover:underline mb-4 inline-block">
          ← Back to Upload
        </a>
        <h1 className="text-4xl font-bold mb-2">Document Analysis</h1>
        <p className="text-gray-600">{document.filename}</p>
      </div>

      {/* Document Info Card */}
      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-500 mb-1">Status</p>
            <StatusBadge status={document.status} />
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-1">Document Type</p>
            <TypeBadge type={document.document_type} />
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-1">Uploaded</p>
            <p className="font-medium">{new Date(document.created_at).toLocaleDateString()}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-1">Sections Analyzed</p>
            <p className="font-medium">{sections.length} / 8</p>
          </div>
        </div>
      </div>

      {/* View Proposal Button if it exists */}
      {hasProposal && (
        <div className="bg-green-50 border-2 border-green-500 rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold text-green-900 mb-2">🎉 Proposal Ready!</h3>
              <p className="text-green-700">
                Your proposal has been generated successfully. Click to view and download.
              </p>
            </div>
            <a
              href={`/proposals/${documentId}`}
              className="bg-green-600 text-white px-8 py-4 rounded-lg hover:bg-green-700 font-semibold text-lg shadow-lg"
            >
              📄 View Proposal
            </a>
          </div>
        </div>
      )}

      {/* Generate Proposal Button */}
      {!hasProposal && document.status === 'completed' && document.document_type === 'rfp' && sections.length > 0 && (
        <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Ready to Generate Proposal</h3>
              <p className="text-gray-700 mb-1">
                RFP analysis complete with {sections.length} sections extracted.
              </p>
              <p className="text-sm text-gray-600">
                Click below to generate a complete proposal response using your company data.
              </p>
            </div>
            <button
              onClick={handleGenerateProposal}
              disabled={generatingProposal}
              className="bg-green-600 text-white px-8 py-4 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold text-lg shadow-lg hover:shadow-xl transition-all"
            >
              {generatingProposal ? (
                <span className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Generating...
                </span>
              ) : (
                '🚀 Generate Proposal'
              )}
            </button>
          </div>
          {proposalError && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded p-3">
              <p className="text-red-800 text-sm">{proposalError}</p>
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
      {document.status === 'failed' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
          <h3 className="font-semibold text-red-900 mb-2">Processing Failed</h3>
          <p className="text-red-700">
            There was an error processing this document. Please try uploading again.
          </p>
        </div>
      )}

      {/* Section Results */}
      {document.status === 'completed' && sections.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold">Extracted Intelligence</h2>

          {sections
            .sort((a, b) => a.section_number - b.section_number)
            .map((section) => (
              <SectionCard key={section.id} section={section} />
            ))}
        </div>
      )}

      {/* No results yet */}
      {document.status === 'completed' && sections.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <p className="text-yellow-800">
            No sections were analyzed. This might not be an RFP document.
          </p>
        </div>
      )}
    </main>
  );
}

function StatusBadge({ status }: { status: DocumentStatus }) {
  const styles = {
    pending: 'bg-gray-100 text-gray-800',
    processing: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
    generating_proposal: 'bg-yellow-100 text-yellow-800',
    proposal_ready: 'bg-green-100 text-green-800',
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
    rfp: 'bg-purple-100 text-purple-800',
    proposal: 'bg-blue-100 text-blue-800',
    contract: 'bg-green-100 text-green-800',
    other: 'bg-gray-100 text-gray-800',
    unknown: 'bg-gray-100 text-gray-800',
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
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <h3 className="text-xl font-semibold text-gray-700 mb-2">
          {section.section_number}. {section.section_name}
        </h3>
        <p className="text-gray-500 italic">Section not found in document</p>
      </div>
    );
  }

  return (
    <div className="bg-white shadow-md rounded-lg p-6">
      <h3 className="text-xl font-semibold text-gray-900 mb-4">
        {section.section_number}. {section.section_name}
      </h3>

      {/* Summary */}
      <div className="mb-4">
        <h4 className="font-medium text-gray-700 mb-2">Summary</h4>
        <p className="text-gray-600 leading-relaxed">{content.summary}</p>
      </div>

      {/* Key Points */}
      {content.key_points && content.key_points.length > 0 && (
        <div className="mb-4">
          <h4 className="font-medium text-gray-700 mb-2">Key Points</h4>
          <ul className="list-disc list-inside space-y-1">
            {content.key_points.map((point, idx) => (
              <li key={idx} className="text-gray-600">
                {point}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Critical Info */}
      {content.critical_info && content.critical_info.length > 0 && (
        <div className="mb-4">
          <h4 className="font-medium text-gray-700 mb-2">Critical Information</h4>
          <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
            <ul className="list-disc list-inside space-y-1">
              {content.critical_info.map((info, idx) => (
                <li key={idx} className="text-yellow-900">
                  {info}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Notes */}
      {content.notes && (
        <div className="bg-blue-50 border border-blue-200 rounded p-3">
          <p className="text-sm text-blue-800">
            <span className="font-medium">Note:</span> {content.notes}
          </p>
        </div>
      )}
    </div>
  );
}
