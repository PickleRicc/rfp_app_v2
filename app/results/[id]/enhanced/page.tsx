'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { VolumeViewer } from '@/app/components/VolumeViewer';
import { ComplianceTracker } from '@/app/components/ComplianceTracker';

interface RFPResponse {
  id: string;
  document_id: string;
  status: string;
  requirements_coverage_percent: number;
  compliance_matrix_url: string;
  rendered_html: string;
  completed_at: string;
}

interface Volume {
  id: string;
  volume_type: string;
  volume_number: number;
  content: any;
  docx_url: string;
}

export default function EnhancedResultsPage() {
  const params = useParams();
  const responseId = params.id as string;

  const [response, setResponse] = useState<RFPResponse | null>(null);
  const [volumes, setVolumes] = useState<Volume[]>([]);
  const [activeVolume, setActiveVolume] = useState<string>('technical');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!responseId) return;

    const fetchData = async () => {
      try {
        // Fetch response data
        const resResponse = await fetch(`/api/results/${responseId}`);
        if (!resResponse.ok) throw new Error('Failed to fetch response');
        const resData = await resResponse.json();
        setResponse(resData.response);

        // Fetch volumes
        const volResponse = await fetch(`/api/proposals/${responseId}/volumes`);
        if (volResponse.ok) {
          const volData = await volResponse.json();
          setVolumes(volData);
          if (volData.length > 0 && !activeVolume) {
            setActiveVolume(volData[0].volume_type);
          }
        }

        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load results');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [responseId]);

  const downloadVolume = async (volumeType: string) => {
    const volume = volumes.find((v) => v.volume_type === volumeType);
    if (!volume?.docx_url) return;

    try {
      // Create download link
      const a = document.createElement('a');
      a.href = volume.docx_url;
      a.download = `${volumeType}-volume.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading volume:', error);
    }
  };

  const downloadAllVolumes = async () => {
    try {
      const res = await fetch(`/api/proposals/${responseId}/download`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `proposal-${responseId}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading package:', error);
    }
  };

  const viewHTML = () => {
    if (response?.rendered_html) {
      const htmlWindow = window.open('', '_blank');
      if (htmlWindow) {
        htmlWindow.document.write(response.rendered_html);
        htmlWindow.document.close();
      }
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen p-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading proposal...</p>
          </div>
        </div>
      </main>
    );
  }

  if (error || !response) {
    return (
      <main className="min-h-screen p-8 max-w-7xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-red-900 mb-2">Error</h2>
          <p className="text-red-700">{error || 'Proposal not found'}</p>
        </div>
      </main>
    );
  }

  const currentVolume = volumes.find((v) => v.volume_type === activeVolume);

  return (
    <main className="min-h-screen p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Proposal Response
        </h1>
        <p className="text-gray-600">
          Generated: {response.completed_at ? new Date(response.completed_at).toLocaleString() : 'In progress'}
        </p>
      </div>

      {/* Download Actions */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Download Options
        </h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => downloadVolume(activeVolume)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Download {activeVolume.replace('_', ' ')} Volume (.docx)
          </button>
          <button
            onClick={downloadAllVolumes}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Download All Volumes (ZIP)
          </button>
          <button
            onClick={viewHTML}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            View HTML Preview
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2">
          {/* Volume tabs */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="border-b border-gray-200">
              <div className="flex overflow-x-auto">
                {volumes.map((volume) => (
                  <button
                    key={volume.id}
                    onClick={() => setActiveVolume(volume.volume_type)}
                    className={`px-6 py-3 font-medium text-sm whitespace-nowrap transition-colors ${
                      activeVolume === volume.volume_type
                        ? 'bg-blue-600 text-white border-b-2 border-blue-600'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Volume {volume.volume_number}: {volume.volume_type.replace('_', ' ').toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Volume content */}
            <div className="p-6 max-h-[800px] overflow-y-auto">
              {currentVolume ? (
                <VolumeViewer content={currentVolume.content} />
              ) : (
                <div className="text-center text-gray-500 py-12">
                  No content available for this volume
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Compliance tracker */}
          <ComplianceTracker
            coveragePercent={response.requirements_coverage_percent || 0}
            responseId={responseId}
          />

          {/* Volume summary */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Volume Summary
            </h3>
            <div className="space-y-3">
              {volumes.map((volume) => (
                <div
                  key={volume.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded"
                >
                  <div>
                    <div className="font-medium text-gray-900">
                      Volume {volume.volume_number}
                    </div>
                    <div className="text-sm text-gray-600 capitalize">
                      {volume.volume_type.replace('_', ' ')}
                    </div>
                  </div>
                  <button
                    onClick={() => downloadVolume(volume.volume_type)}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    Download
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Status */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Status
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-700">Response Status:</span>
                <span className="font-semibold text-green-600 capitalize">
                  {response.status}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Volumes Generated:</span>
                <span className="font-semibold">{volumes.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
