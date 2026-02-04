'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, CheckCircle2, ListChecks, Target, PartyPopper, BarChart2, Download, FileText, type LucideIcon } from 'lucide-react';

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
      <div className="min-h-screen bg-background">
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center h-64">
            <div className="h-12 w-12 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        </main>
      </div>
    );
  }

  if (error || !proposal) {
    return (
      <div className="min-h-screen bg-background">
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6">
            <h2 className="text-xl font-semibold text-foreground mb-2">Error</h2>
            <p className="text-destructive">{error || "Proposal not found"}</p>
            <Link href="/documents" className="text-primary hover:underline mt-4 inline-block">
              ← Back to Documents
            </Link>
          </div>
        </main>
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
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Link href="/documents" className="text-primary hover:underline mb-4 inline-block">
            ← Back to Documents
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl mb-2">
            Proposal Response
          </h1>
          <p className="text-muted-foreground">{proposal.document.filename}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <SummaryCard
            label="Volumes Generated"
            value={proposal.volumes.length}
            icon={BookOpen}
            variant="primary"
          />
          <SummaryCard
            label="Requirements Coverage"
            value={`${proposal.response.requirements_coverage_percent}%`}
            icon={CheckCircle2}
            variant="success"
          />
          <SummaryCard
            label="Total Requirements"
            value={proposal.requirements.total}
            icon={ListChecks}
            variant="default"
          />
          <SummaryCard
            label="Status"
            value={proposal.response.status === "completed" ? "Ready" : proposal.response.status}
            icon={Target}
            variant="warning"
          />
        </div>

        <div className="rounded-xl border-2 border-callout-border bg-callout p-8 mb-8">
          <div className="text-center">
            <div className="mb-4 flex justify-center">
              <PartyPopper className="h-16 w-16 text-primary" />
            </div>
            <h2 className="text-3xl font-bold text-foreground mb-3">Proposal Complete!</h2>
            <p className="text-muted-foreground text-lg mb-6">
              Your proposal has been generated with {proposal.volumes.length} volumes and{" "}
              {proposal.requirements.total} requirements addressed.
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              {proposal.response.compliance_matrix_url && (
                <a
                  href={`/api/proposals/${documentId}/compliance?download=true`}
                  download
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-md hover:bg-primary/90"
                >
                  <BarChart2 className="h-5 w-5" />
                  Download Compliance Matrix
                </a>
              )}
              <a
                href={`/api/proposals/${documentId}/download`}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-md hover:bg-primary/90"
              >
                <Download className="h-5 w-5" />
                Download All Volumes
              </a>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card mb-8">
          <div className="border-b border-border bg-muted/50 px-6 py-4">
            <h3 className="text-xl font-semibold text-foreground">Proposal Volumes</h3>
          </div>
          <div className="divide-y divide-border">
            {proposal.volumes
              .sort((a, b) => a.volume_number - b.volume_number)
              .map((volume) => (
                <div key={volume.id} className="px-6 py-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="mr-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                        <FileText className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h4 className="text-lg font-semibold text-foreground">
                          Volume {volume.volume_number}:{" "}
                          {volumeTypeLabels[volume.volume_type] || volume.volume_type}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {volume.page_count > 0 ? `${volume.page_count} pages` : "Generated"} •
                          Created {new Date(volume.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <a
                      href={`/api/proposals/${documentId}/volumes?type=${volume.volume_type}`}
                      download
                      className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      Download DOCX
                    </a>
                  </div>
                </div>
              ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="text-xl font-semibold text-foreground mb-4">Requirements Breakdown</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(proposal.requirements.bycategory).map(([category, count]) => (
              <div key={category} className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground uppercase tracking-wide mb-1">
                  {category}
                </p>
                <p className="text-2xl font-bold text-foreground">{count}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          <p>
            Proposal generated on {new Date(proposal.response.created_at).toLocaleString()}
            {proposal.response.completed_at && (
              <> • Completed on {new Date(proposal.response.completed_at).toLocaleString()}</>
            )}
          </p>
        </div>
      </main>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  variant,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  variant: "default" | "primary" | "success" | "warning";
}) {
  const styles = {
    default: "border-border bg-card",
    primary: "border-primary/20 bg-primary/5",
    success: "border-callout-border bg-callout",
    warning: "border-warning/20 bg-warning/5",
  };

  return (
    <div className={`rounded-xl border p-4 ${styles[variant]}`}>
      <div className="flex items-center mb-2 gap-2">
        <Icon className="h-5 w-5 text-primary" />
        <p className="text-sm text-muted-foreground font-medium">{label}</p>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}
