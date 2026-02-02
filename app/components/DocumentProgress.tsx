'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type DocumentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'generating_proposal' | 'proposal_ready';

interface ProgressData {
  document: {
    id: string;
    filename: string;
    status: DocumentStatus;
    updated_at: string;
  };
  progress: {
    requirementsExtracted: number;
    volumesGenerated: number;
    coveragePercent: number;
    responseId?: string;
    responseStatus?: string;
  };
  logs: Array<{
    id: string;
    stage: string;
    status: string;
    created_at: string;
    metadata?: any;
  }>;
  latestLog: any;
}

interface DocumentProgressProps {
  documentId: string;
  onComplete?: () => void;
}

export default function DocumentProgress({ documentId, onComplete }: DocumentProgressProps) {
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProgress = async () => {
      try {
        const response = await fetch(`/api/documents/${documentId}/progress`);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          console.error('Progress API error:', response.status, errorData);
          throw new Error('Failed to fetch progress');
        }
        
        const data = await response.json();
        setProgress(data);
        setLoading(false);

        // Call onComplete if document reaches final state
        if (data.document.status === 'proposal_ready' || data.document.status === 'completed') {
          onComplete?.();
        }
      } catch (error) {
        console.error('Error fetching progress:', error);
        // Don't keep showing loading state on error
        if (loading) {
          setLoading(false);
        }
      }
    };

    // Initial fetch
    fetchProgress();

    // Poll every 2 seconds while processing
    const interval = setInterval(fetchProgress, 2000);

    return () => clearInterval(interval);
  }, [documentId, onComplete]);

  if (loading && !progress) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading progress...</span>
        </div>
      </div>
    );
  }

  if (!progress) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-yellow-800">⚠️ Progress information temporarily unavailable. Document is still processing.</p>
      </div>
    );
  }

  const { document, progress: progressData, logs } = progress;

  // Determine current stage based on status and logs
  const getCurrentStage = () => {
    // Check if we have volumes generated (means Stage 2 completed even if status not updated)
    if (progressData.volumesGenerated > 0) return 'stage2-complete';
    if (document.status === 'proposal_ready') return 'stage2-complete';
    if (document.status === 'generating_proposal') return 'stage2-running';
    if (document.status === 'completed') return 'stage1-complete';
    if (document.status === 'processing') return 'stage1-running';
    return 'pending';
  };

  const currentStage = getCurrentStage();

  const getLatestActivity = () => {
    const latestLog = logs[0];
    if (!latestLog) return 'Initializing...';

    if (latestLog.stage === 'stage-1-rfp-intelligence') {
      if (latestLog.status === 'completed') return '✅ Requirements extraction complete';
      if (latestLog.status === 'started') return '🔄 Extracting requirements from RFP...';
    }

    if (latestLog.stage === 'stage-2-response-generator') {
      if (latestLog.status === 'completed') return '✅ Proposal generation complete';
      if (latestLog.status === 'started') return '🔄 Generating proposal volumes...';
    }

    return '🔄 Processing...';
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-xl font-semibold mb-6">Generation Progress</h3>

      {/* Progress Steps */}
      <div className="space-y-4 mb-6">
        {/* Stage 1: RFP Analysis */}
        <ProgressStep
          title="Stage 1: RFP Intelligence"
          description="Extracting requirements, deadlines, and key information"
          status={
            currentStage === 'pending' ? 'pending' :
            currentStage === 'stage1-running' ? 'active' :
            'complete'
          }
          details={progressData.requirementsExtracted > 0 ? `${progressData.requirementsExtracted} requirements extracted` : undefined}
        />

        {/* Stage 2: Proposal Generation */}
        <ProgressStep
          title="Stage 2: Proposal Generation"
          description="Generating volumes, exhibits, and compliance matrix"
          status={
            currentStage === 'pending' || currentStage === 'stage1-running' || currentStage === 'stage1-complete' ? 'pending' :
            currentStage === 'stage2-running' ? 'active' :
            'complete'
          }
          details={progressData.volumesGenerated > 0 ? `${progressData.volumesGenerated} volumes generated` : undefined}
        />
      </div>

      {/* Current Activity */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-center">
          {(document.status === 'processing' || document.status === 'generating_proposal') && (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-3"></div>
          )}
          <div>
            <p className="font-medium text-blue-900">Current Activity</p>
            <p className="text-blue-700 text-sm">{getLatestActivity()}</p>
          </div>
        </div>
      </div>

      {/* Completion Actions - Show if volumes generated OR status is proposal_ready */}
      {(progressData.volumesGenerated > 0 || document.status === 'proposal_ready') && progressData.responseId && (
        <div className="bg-green-50 border-2 border-green-500 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-green-900 mb-1">🎉 Complete!</p>
              <p className="text-green-700">
                {progressData.volumesGenerated} volumes generated • {progressData.coveragePercent}% requirements coverage
              </p>
            </div>
            <Link
              href={`/proposals/${documentId}`}
              className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 font-semibold shadow-lg"
            >
              View Proposal →
            </Link>
          </div>
        </div>
      )}

      {document.status === 'completed' && document.document_type === 'rfp' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-green-900">Stage 1 Complete</p>
              <p className="text-green-700 text-sm">{progressData.requirementsExtracted} requirements ready for proposal generation</p>
            </div>
          </div>
        </div>
      )}

      {/* Recent Activity Log */}
      {logs.length > 0 && (
        <div className="mt-6">
          <details className="cursor-pointer">
            <summary className="text-sm font-medium text-gray-700 hover:text-gray-900">
              Recent Activity Log ({logs.length})
            </summary>
            <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
              {logs.slice(0, 10).map((log) => (
                <div key={log.id} className="text-xs bg-gray-50 rounded p-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">{log.stage}</span>
                    <span className={`px-2 py-1 rounded text-xs ${
                      log.status === 'completed' ? 'bg-green-100 text-green-800' :
                      log.status === 'started' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {log.status}
                    </span>
                  </div>
                  <div className="text-gray-500 mt-1">
                    {new Date(log.created_at).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}
    </div>
  );
}

function ProgressStep({
  title,
  description,
  status,
  details,
}: {
  title: string;
  description: string;
  status: 'pending' | 'active' | 'complete';
  details?: string;
}) {
  return (
    <div className="flex items-start">
      {/* Status Icon */}
      <div className="flex-shrink-0 mr-4">
        {status === 'complete' && (
          <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
            </svg>
          </div>
        )}
        {status === 'active' && (
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
          </div>
        )}
        {status === 'pending' && (
          <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-white"></div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1">
        <h4 className={`font-semibold ${
          status === 'complete' ? 'text-green-900' :
          status === 'active' ? 'text-blue-900' :
          'text-gray-500'
        }`}>
          {title}
        </h4>
        <p className="text-sm text-gray-600 mt-1">{description}</p>
        {details && (
          <p className="text-sm font-medium text-blue-600 mt-1">{details}</p>
        )}
      </div>
    </div>
  );
}
