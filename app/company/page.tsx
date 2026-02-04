'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Building2,
  FileCheck,
  Target,
  BarChart3,
  Users,
  Sparkles,
  FileText,
  ClipboardList,
  type LucideIcon,
} from 'lucide-react';
import { useCompany } from '@/lib/context/CompanyContext';
import { useFetchWithCompany } from '@/lib/hooks/useFetchWithCompany';

interface CompletenessScore {
  core_information: number;
  certifications: number;
  capabilities: number;
  past_performance: number;
  personnel: number;
  differentiators: number;
  total: number;
}

export default function CompanyDashboard() {
  const router = useRouter();
  const { selectedCompany, selectedCompanyId } = useCompany();
  const { fetchWithCompany } = useFetchWithCompany();
  const [loading, setLoading] = useState(true);
  const [hasProfile, setHasProfile] = useState(false);
  const [completeness, setCompleteness] = useState<CompletenessScore | null>(null);

  useEffect(() => {
    if (selectedCompanyId) {
      fetchCompanyStatus();
    } else {
      setLoading(false);
      setHasProfile(false);
    }
  }, [selectedCompanyId]);

  const fetchCompanyStatus = async () => {
    try {
      setLoading(true);
      const response = await fetchWithCompany('/api/company/status');
      const data = await response.json();
      setHasProfile(data.hasProfile);
      setCompleteness(data.completeness);
    } catch (error) {
      console.error('Error fetching company status:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="h-12 w-12 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto mb-4" />
              <p className="text-muted-foreground">Loading company profile...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl mb-2">
                {selectedCompany ? `${selectedCompany.company_name} - Company Data` : "Company Data"}
              </h1>
              <p className="text-muted-foreground">Manage company information for proposal generation</p>
            </div>
          </div>
        </div>

        {!selectedCompany && !loading && (
          <div className="rounded-xl border border-warning/30 bg-warning/5 p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-8 w-8 shrink-0 text-warning-foreground" />
              <div>
                <h3 className="font-semibold text-foreground mb-1">No Company Selected</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Please select a company from the header above to view and manage its data.
                </p>
                <button
                  onClick={() => router.push("/company/profile/new")}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Create New Company
                </button>
              </div>
            </div>
          </div>
        )}

        {selectedCompany && !hasProfile ? (
          <div className="rounded-xl border border-border bg-card p-8">
            <h2 className="text-2xl font-bold text-foreground mb-4">Get Started</h2>
            <p className="text-muted-foreground mb-6">
              Welcome! To generate winning proposals, we need to collect your company information.
              This is a one-time setup that will enable rapid proposal generation for all future opportunities.
            </p>

            <div className="rounded-xl border border-callout-border bg-callout p-6 mb-6">
              <h3 className="font-semibold text-foreground mb-3">Progressive Intake Process</h3>
              <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                <li><strong className="text-foreground">Company Basics</strong> (5-10 min) - Essential information to get started</li>
                <li><strong className="text-foreground">Certifications</strong> (5-10 min) - Set-asides and registrations</li>
                <li><strong className="text-foreground">Capabilities</strong> (10-15 min) - What you do and how you do it</li>
                <li><strong className="text-foreground">Past Performance</strong> (15-30 min per contract) - Your track record</li>
                <li><strong className="text-foreground">Personnel</strong> (10-20 min per person) - Key team members</li>
                <li><strong className="text-foreground">Differentiators</strong> (15-20 min) - Why you win</li>
              </ol>
            </div>

            <button
              onClick={() => router.push("/company/profile/new")}
              className="rounded-md bg-primary px-8 py-3 text-lg font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Start Company Profile
            </button>
          </div>
      ) : selectedCompany && hasProfile ? (
        <div>
          <div className="rounded-xl border border-border bg-card p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-foreground">Profile Completeness</h2>
              <CompletionBadge score={completeness?.total || 0} />
            </div>

            <div className="mb-6">
              <div className="flex justify-between text-sm text-muted-foreground mb-2">
                <span>Overall Progress</span>
                <span>{completeness?.total || 0}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-4">
                <div
                  className={`h-4 rounded-full ${getProgressColor(completeness?.total || 0)}`}
                  style={{ width: `${completeness?.total || 0}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <ScoreCard
                title="Core Information"
                score={completeness?.core_information || 0}
                maxScore={25}
              />
              <ScoreCard
                title="Certifications"
                score={completeness?.certifications || 0}
                maxScore={10}
              />
              <ScoreCard
                title="Capabilities"
                score={completeness?.capabilities || 0}
                maxScore={15}
              />
              <ScoreCard
                title="Past Performance"
                score={completeness?.past_performance || 0}
                maxScore={20}
              />
              <ScoreCard
                title="Personnel"
                score={completeness?.personnel || 0}
                maxScore={20}
              />
              <ScoreCard
                title="Differentiators"
                score={completeness?.differentiators || 0}
                maxScore={10}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
            <ActionCard
              icon={Building2}
              title="Company Information"
              description="Core company details and contacts"
              onClick={() => router.push('/company/profile')}
            />
            <ActionCard
              icon={FileCheck}
              title="Certifications"
              description="Small business set-asides and NAICS codes"
              onClick={() => router.push('/company/certifications')}
            />
            <ActionCard
              icon={Target}
              title="Capabilities"
              description="Services, tools, and methodologies"
              onClick={() => router.push('/company/capabilities')}
            />
            <ActionCard
              icon={BarChart3}
              title="Past Performance"
              description="Contract history and achievements"
              onClick={() => router.push('/company/past-performance')}
            />
            <ActionCard
              icon={Users}
              title="Personnel"
              description="Team members and key personnel"
              onClick={() => router.push('/company/personnel')}
            />
            <ActionCard
              icon={Sparkles}
              title="Differentiators"
              description="Win themes and value propositions"
              onClick={() => router.push('/company/differentiators')}
            />
            <ActionCard
              icon={FileText}
              title="Boilerplate Library"
              description="Reusable text and templates"
              onClick={() => router.push('/company/boilerplate')}
            />
          </div>

          {completeness && completeness.total < 70 && (
            <div className="rounded-xl border border-callout-border bg-callout p-6">
              <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" />
                Next Steps to Improve Proposal Quality
              </h3>
              <p className="text-muted-foreground mb-4">
                Your profile is at {completeness.total}% completion. To generate competitive proposals, we recommend reaching 70%+.
              </p>
              <div className="space-y-2 text-foreground">
                {completeness.past_performance < 20 && (
                  <div>
                    • Add at least <strong>3 past performance contracts</strong> (most critical for proposals)
                  </div>
                )}
                {completeness.personnel < 15 && (
                  <div>
                    • Add <strong>key personnel</strong> for common proposal roles
                  </div>
                )}
                {completeness.capabilities < 10 && (
                  <div>
                    • Add more <strong>service areas and capabilities</strong>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : null}
      </main>
    </div>
  );
}

function CompletionBadge({ score }: { score: number }) {
  if (score >= 91) {
    return (
      <span className="rounded-full bg-success/10 px-4 py-2 text-sm font-semibold text-success">
        Excellent - Fully Optimized
      </span>
    );
  }
  if (score >= 71) {
    return (
      <span className="rounded-full bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
        Good - Competitive Ready
      </span>
    );
  }
  if (score >= 41) {
    return (
      <span className="rounded-full bg-warning/10 px-4 py-2 text-sm font-semibold text-warning-foreground">
        Basic - Draft Quality
      </span>
    );
  }
  return (
    <span className="rounded-full bg-destructive/10 px-4 py-2 text-sm font-semibold text-destructive">
      Incomplete
    </span>
  );
}

function getProgressColor(score: number): string {
  if (score >= 91) return "bg-success";
  if (score >= 71) return "bg-primary";
  if (score >= 41) return "bg-warning";
  return "bg-destructive";
}

function ScoreCard({ title, score, maxScore }: { title: string; score: number; maxScore: number }) {
  const percentage = (score / maxScore) * 100;

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="text-sm text-muted-foreground mb-2">{title}</div>
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-2xl font-bold text-foreground">{score}</span>
        <span className="text-muted-foreground">/ {maxScore}</span>
      </div>
      <div className="w-full bg-muted rounded-full h-2">
        <div
          className={`h-2 rounded-full ${getProgressColor(percentage)}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function ActionCard({
  icon: Icon,
  title,
  description,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-xl border border-border bg-card p-6 text-left transition-shadow hover:shadow-md"
    >
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="h-6 w-6 text-primary" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm">{description}</p>
    </button>
  );
}
