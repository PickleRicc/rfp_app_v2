'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Loader2, PartyPopper } from 'lucide-react';

type DocumentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'generating_proposal' | 'proposal_ready';

interface ProgressData {
  document: {
    id: string;
    filename: string;
    status: DocumentStatus;
    updated_at: string;
    document_type?: string;
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
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-muted-foreground">Loading progress...</span>
        </div>
      </div>
    );
  }

  if (!progress) {
    return (
      <div className="rounded-xl border border-warning/30 bg-warning/5 p-4">
        <p className="flex items-center gap-2 text-foreground">
          <AlertTriangle className="h-5 w-5 shrink-0 text-warning-foreground" />
          Progress information temporarily unavailable. Document is still processing.
        </p>
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
      if (latestLog.status === 'completed') return 'Requirements extraction complete';
      if (latestLog.status === 'started') return 'Extracting requirements from RFP...';
    }

    if (latestLog.stage === 'stage-2-response-generator') {
      if (latestLog.status === 'completed') return 'Proposal generation complete';
      if (latestLog.status === 'started') return 'Generating proposal volumes...';
    }

    return 'Processing...';
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h3 className="text-xl font-semibold text-foreground mb-6">Generation Progress</h3>

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
        <div className="rounded-xl border-2 border-callout-border bg-callout p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-foreground mb-1 flex items-center gap-2">
                <PartyPopper className="h-7 w-7 text-primary" />
                Complete!
              </p>
              <p className="text-muted-foreground">
                {progressData.volumesGenerated} volumes generated • {progressData.coveragePercent}% requirements coverage
              </p>
            </div>
            <Link
              href={`/proposals/${documentId}`}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-md hover:bg-primary/90"
            >
              View Proposal
              <span className="text-lg">→</span>
            </Link>
          </div>
        </div>
      )}

      {document.status === 'completed' && document.document_type === 'rfp' && (
        <div className="rounded-xl border border-callout-border bg-callout p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-foreground flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                Stage 1 Complete
              </p>
              <p className="text-muted-foreground text-sm">{progressData.requirementsExtracted} requirements ready for proposal generation</p>
            </div>
          </div>
        </div>
      )}

      {/* Recent Activity Log */}
      {logs.length > 0 && (
        <div className="mt-6">
          <details className="cursor-pointer">
            <summary className="text-sm font-medium text-muted-foreground hover:text-foreground">
              Recent Activity Log ({logs.length})
            </summary>
            <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
              {logs.slice(0, 10).map((log) => (
                <div key={log.id} className="rounded bg-muted/50 p-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">{log.stage}</span>
                    <span className={`rounded px-2 py-1 text-xs ${
                      log.status === 'completed' ? 'bg-success/10 text-success' :
                      log.status === 'started' ? 'bg-primary/10 text-primary' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {log.status}
                    </span>
                  </div>
                  <div className="mt-1 text-muted-foreground">
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
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
            <CheckCircle2 className="h-5 w-5 text-primary-foreground" />
          </div>
        )}
        {status === 'active' && (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
            <Loader2 className="h-5 w-5 animate-spin text-primary-foreground" />
          </div>
        )}
        {status === 'pending' && (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
            <div className="h-3 w-3 rounded-full bg-muted-foreground/50" />
          </div>
        )}
      </div>

      <div className="flex-1">
        <h4 className={`font-semibold ${
          status === 'complete' ? 'text-foreground' :
          status === 'active' ? 'text-foreground' :
          'text-muted-foreground'
        }`}>
          {title}
        </h4>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
        {details && (
          <p className="text-sm font-medium text-primary mt-1">{details}</p>
        )}
      </div>
    </div>
  );
}
