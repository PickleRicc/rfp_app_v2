'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface ProposalData {
  document: {
    id: string;
    filename: string;
    status: string;
  };
  response: {
    id: string;
    status: string;
    requirements_coverage_percent: number;
    compliance_matrix_url: string | null;
    created_at: string;
    completed_at: string | null;
  };
  volumes: Array<{
    id: string;
    volume_type: string;
    volume_number: number;
    docx_url: string;
    page_count: number;
    created_at: string;
  }>;
  requirements: {
    total: number;
    bycategory: Record<string, number>;
  };
}

export default function ProposalPage() {
  const params = useParams();
  const documentId = params.id as string;

  const [proposal, setProposal] = useState<ProposalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProposal = async () => {
      try {
        const response = await fetch(`/api/proposals/${documentId}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch proposal');
        }

        const data = await response.json();
        setProposal(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load proposal');
      } finally {
        setLoading(false);
      }
    };

    fetchProposal();
  }, [documentId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !proposal) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-red-900 mb-2">Error</h2>
            <p className="text-red-700">{error || 'Proposal not found'}</p>
            <Link href="/documents" className="text-blue-600 hover:underline mt-4 inline-block">
              ← Back to Documents
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const volumeTypeLabels: Record<string, string> = {
    technical: 'Technical Volume',
    management: 'Management Volume',
    past_performance: 'Past Performance Volume',
    price: 'Price Volume',
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/documents" className="text-blue-600 hover:underline mb-4 inline-block">
            ← Back to Documents
          </Link>
          <h1 className="text-4xl font-bold mb-2">Proposal Response</h1>
          <p className="text-gray-600">{proposal.document.filename}</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <SummaryCard
            label="Volumes Generated"
            value={proposal.volumes.length}
            icon="📚"
            color="blue"
          />
          <SummaryCard
            label="Requirements Coverage"
            value={`${proposal.response.requirements_coverage_percent}%`}
            icon="✅"
            color="green"
          />
          <SummaryCard
            label="Total Requirements"
            value={proposal.requirements.total}
            icon="📋"
            color="purple"
          />
          <SummaryCard
            label="Status"
            value={proposal.response.status === 'completed' ? 'Ready' : proposal.response.status}
            icon="🎯"
            color="yellow"
          />
        </div>

        {/* Completion Banner */}
        <div className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-500 rounded-lg p-8 mb-8">
          <div className="text-center">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Proposal Complete!</h2>
            <p className="text-gray-700 text-lg mb-6">
              Your proposal has been generated with {proposal.volumes.length} volumes and {proposal.requirements.total} requirements addressed.
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              {proposal.response.compliance_matrix_url && (
                <a
                  href={`/api/proposals/${documentId}/compliance?download=true`}
                  download
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-semibold shadow-lg"
                >
                  📊 Download Compliance Matrix
                </a>
              )}
              <a
                href={`/api/proposals/${documentId}/download`}
                className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 font-semibold shadow-lg"
              >
                ⬇️ Download All Volumes
              </a>
            </div>
          </div>
        </div>

        {/* Volumes List */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden mb-8">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <h3 className="text-xl font-semibold">Proposal Volumes</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {proposal.volumes
              .sort((a, b) => a.volume_number - b.volume_number)
              .map((volume) => (
                <div key={volume.id} className="px-6 py-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="text-3xl mr-4">📄</div>
                      <div>
                        <h4 className="text-lg font-semibold text-gray-900">
                          Volume {volume.volume_number}: {volumeTypeLabels[volume.volume_type] || volume.volume_type}
                        </h4>
                        <p className="text-sm text-gray-500">
                          {volume.page_count > 0 ? `${volume.page_count} pages` : 'Generated'} • 
                          Created {new Date(volume.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <a
                        href={`/api/proposals/${documentId}/volumes?type=${volume.volume_type}`}
                        download
                        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 font-medium text-sm"
                      >
                        Download DOCX
                      </a>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Requirements Breakdown */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-semibold mb-4">Requirements Breakdown</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(proposal.requirements.bycategory).map(([category, count]) => (
              <div key={category} className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 uppercase tracking-wide mb-1">{category}</p>
                <p className="text-2xl font-bold text-gray-900">{count}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Metadata */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>
            Proposal generated on {new Date(proposal.response.created_at).toLocaleString()}
            {proposal.response.completed_at && (
              <> • Completed on {new Date(proposal.response.completed_at).toLocaleString()}</>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: string;
  color: string;
}) {
  const colors = {
    blue: 'bg-blue-50 border-blue-200',
    green: 'bg-green-50 border-green-200',
    purple: 'bg-purple-50 border-purple-200',
    yellow: 'bg-yellow-50 border-yellow-200',
  };

  return (
    <div className={`border rounded-lg p-4 ${colors[color as keyof typeof colors]}`}>
      <div className="flex items-center mb-2">
        <span className="text-2xl mr-2">{icon}</span>
        <p className="text-sm text-gray-600 font-medium">{label}</p>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
