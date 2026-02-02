'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useCompany } from '@/lib/context/CompanyContext';

type DocumentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'generating_proposal' | 'proposal_ready';
type DocumentType = 'rfp' | 'proposal' | 'contract' | 'other' | 'unknown';

interface Document {
  id: string;
  filename: string;
  document_type: DocumentType;
  status: DocumentStatus;
  file_size: number;
  created_at: string;
  updated_at: string;
}

export default function DocumentsPage() {
  const { selectedCompany, selectedCompanyId } = useCompany();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<DocumentType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<DocumentStatus | 'all'>('all');
  const [generatingProposals, setGeneratingProposals] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (selectedCompanyId) {
      fetchDocuments();
      
      // Poll for updates every 3 seconds if there are processing documents
      const interval = setInterval(async () => {
        const hasProcessing = documents.some(
          doc => doc.status === 'processing' || doc.status === 'generating_proposal'
        );
        
        if (hasProcessing) {
          await fetchDocuments();
        }
      }, 3000);
      
      return () => clearInterval(interval);
    } else {
      setLoading(false);
    }
  }, [selectedCompanyId, documents]);

  const fetchDocuments = async () => {
    if (!selectedCompanyId) return;
    
    try {
      const headers = new Headers();
      headers.set('X-Company-Id', selectedCompanyId);
      
      const response = await fetch('/api/documents', { headers });
      if (!response.ok) throw new Error('Failed to fetch documents');
      
      const data = await response.json();
      setDocuments(data.documents || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateProposal = async (documentId: string) => {
    setGeneratingProposals(prev => new Set(prev).add(documentId));

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

      // Refresh documents list to show updated status
      await fetchDocuments();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to generate proposal');
      setGeneratingProposals(prev => {
        const next = new Set(prev);
        next.delete(documentId);
        return next;
      });
    }
  };

  const filteredDocuments = documents.filter(doc => {
    if (filterType !== 'all' && doc.document_type !== filterType) return false;
    if (filterStatus !== 'all' && doc.status !== filterStatus) return false;
    return true;
  });

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">Documents</h1>
              <p className="text-gray-600">
                View and manage all your uploaded documents, analyses, and proposals
              </p>
            </div>
            {selectedCompany && (
              <div className="text-right">
                <p className="text-sm text-gray-500">Viewing documents for</p>
                <p className="text-lg font-semibold text-gray-900">{selectedCompany.company_name}</p>
              </div>
            )}
          </div>
        </div>

        {/* No Company Selected Warning */}
        {!selectedCompany && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h2 className="text-2xl font-semibold text-yellow-900 mb-2">No Company Selected</h2>
            <p className="text-yellow-800 mb-4">
              Please select a company from the header above to view its documents.
            </p>
            <Link
              href="/companies"
              className="inline-block bg-yellow-600 text-white px-6 py-3 rounded-lg hover:bg-yellow-700 font-medium"
            >
              Manage Companies
            </Link>
          </div>
        )}

        {selectedCompany && (
          <>
        {/* Content when company is selected */}

        {/* Stats Bar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <StatCard
            label="Total Documents"
            value={documents.length}
            color="blue"
          />
          <StatCard
            label="RFPs Analyzed"
            value={documents.filter(d => d.document_type === 'rfp' && d.status === 'completed').length}
            color="green"
          />
          <StatCard
            label="Proposals Ready"
            value={documents.filter(d => d.status === 'proposal_ready').length}
            color="purple"
          />
          <StatCard
            label="Processing"
            value={documents.filter(d => d.status === 'processing' || d.status === 'generating_proposal').length}
            color="yellow"
          />
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as DocumentType | 'all')}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="all">All Types</option>
                <option value="rfp">RFP</option>
                <option value="proposal">Proposal</option>
                <option value="contract">Contract</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as DocumentStatus | 'all')}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="completed">Completed</option>
                <option value="generating_proposal">Generating Proposal</option>
                <option value="proposal_ready">Proposal Ready</option>
                <option value="failed">Failed</option>
              </select>
            </div>
            <div className="ml-auto flex items-end">
              <Link
                href="/"
                className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 font-medium"
              >
                + Upload New Document
              </Link>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Documents Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {filteredDocuments.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-6xl mb-4">📄</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No documents found</h3>
              <p className="text-gray-600 mb-6">
                {filterType !== 'all' || filterStatus !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Upload your first document to get started'}
              </p>
              {filterType === 'all' && filterStatus === 'all' && (
                <Link
                  href="/"
                  className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium"
                >
                  Upload Document
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Document
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Size
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Uploaded
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredDocuments.map((doc) => (
                    <tr key={doc.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="text-2xl mr-3">📄</div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">{doc.filename}</div>
                            <div className="text-xs text-gray-500">{doc.id.slice(0, 8)}...</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <TypeBadge type={doc.document_type} />
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={doc.status} />
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {formatFileSize(doc.file_size)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {formatDate(doc.created_at)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          {/* View Analysis Button */}
                          {(doc.status === 'completed' || doc.status === 'generating_proposal' || doc.status === 'proposal_ready') && (
                            <Link
                              href={`/results/${doc.id}`}
                              className="text-blue-600 hover:text-blue-800 font-medium text-sm px-3 py-1 border border-blue-600 rounded hover:bg-blue-50"
                            >
                              View Analysis
                            </Link>
                          )}
                          
                          {/* Generate Proposal Button */}
                          {doc.status === 'completed' && doc.document_type === 'rfp' && (
                            <button
                              onClick={() => handleGenerateProposal(doc.id)}
                              disabled={generatingProposals.has(doc.id)}
                              className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 disabled:bg-gray-400 text-sm font-medium"
                            >
                              {generatingProposals.has(doc.id) ? 'Starting...' : 'Generate Proposal'}
                            </button>
                          )}

                          {/* View Proposal Button */}
                          {doc.status === 'proposal_ready' && (
                            <Link
                              href={`/proposals/${doc.id}`}
                              className="bg-purple-600 text-white px-3 py-1 rounded hover:bg-purple-700 text-sm font-medium"
                            >
                              View Proposal
                            </Link>
                          )}

                          {/* Processing Indicator */}
                          {(doc.status === 'processing' || doc.status === 'generating_proposal') && (
                            <div className="flex items-center text-sm text-gray-600">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                              Processing...
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        </>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colors = {
    blue: 'bg-blue-50 border-blue-200 text-blue-900',
    green: 'bg-green-50 border-green-200 text-green-900',
    purple: 'bg-purple-50 border-purple-200 text-purple-900',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-900',
  };

  return (
    <div className={`border rounded-lg p-4 ${colors[color as keyof typeof colors]}`}>
      <p className="text-sm opacity-75 mb-1">{label}</p>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: DocumentStatus }) {
  const styles = {
    pending: 'bg-gray-100 text-gray-800',
    processing: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
    generating_proposal: 'bg-yellow-100 text-yellow-800',
    proposal_ready: 'bg-purple-100 text-purple-800',
  };

  const labels = {
    pending: 'Pending',
    processing: 'Processing',
    completed: 'Completed',
    failed: 'Failed',
    generating_proposal: 'Generating',
    proposal_ready: 'Proposal Ready',
  };

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function TypeBadge({ type }: { type: DocumentType }) {
  const styles = {
    rfp: 'bg-purple-100 text-purple-800',
    proposal: 'bg-blue-100 text-blue-800',
    contract: 'bg-green-100 text-green-800',
    other: 'bg-gray-100 text-gray-800',
    unknown: 'bg-gray-100 text-gray-800',
  };

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium uppercase ${styles[type]}`}>
      {type}
    </span>
  );
}
