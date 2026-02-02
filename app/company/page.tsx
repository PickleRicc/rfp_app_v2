'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
      <main className="min-h-screen p-8 max-w-6xl mx-auto">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading company profile...</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-8 max-w-7xl mx-auto pt-4">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold mb-2">
              {selectedCompany ? `${selectedCompany.company_name} - Company Data` : 'Company Data'}
            </h1>
            <p className="text-gray-600">Manage company information for proposal generation</p>
          </div>
        </div>
      </div>

      {/* No Company Selected Warning */}
      {!selectedCompany && !loading && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <h3 className="font-semibold text-yellow-900 mb-1">No Company Selected</h3>
              <p className="text-sm text-yellow-800 mb-3">
                Please select a company from the header above to view and manage its data.
              </p>
              <button
                onClick={() => router.push('/company/profile/new')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
              >
                Create New Company
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedCompany && !hasProfile ? (
        /* No Profile - Getting Started */
        <div className="bg-white shadow-md rounded-lg p-8">
          <h2 className="text-2xl font-bold mb-4">Get Started</h2>
          <p className="text-gray-700 mb-6">
            Welcome! To generate winning proposals, we need to collect your company information.
            This is a one-time setup that will enable rapid proposal generation for all future opportunities.
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
            <h3 className="font-semibold text-blue-900 mb-3">Progressive Intake Process</h3>
            <ol className="list-decimal list-inside space-y-2 text-blue-800">
              <li><strong>Company Basics</strong> (5-10 min) - Essential information to get started</li>
              <li><strong>Certifications</strong> (5-10 min) - Set-asides and registrations</li>
              <li><strong>Capabilities</strong> (10-15 min) - What you do and how you do it</li>
              <li><strong>Past Performance</strong> (15-30 min per contract) - Your track record</li>
              <li><strong>Personnel</strong> (10-20 min per person) - Key team members</li>
              <li><strong>Differentiators</strong> (15-20 min) - Why you win</li>
            </ol>
          </div>

          <button
            onClick={() => router.push('/company/profile/new')}
            className="bg-blue-600 text-white px-8 py-3 rounded-md hover:bg-blue-700 text-lg font-semibold"
          >
            Start Company Profile
          </button>
        </div>
      ) : selectedCompany && hasProfile ? (
        /* Has Profile - Dashboard */
        <div>
          {/* Completeness Score Card */}
          <div className="bg-white shadow-md rounded-lg p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Profile Completeness</h2>
              <CompletionBadge score={completeness?.total || 0} />
            </div>

            <div className="mb-6">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Overall Progress</span>
                <span>{completeness?.total || 0}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div
                  className={`h-4 rounded-full ${getProgressColor(completeness?.total || 0)}`}
                  style={{ width: `${completeness?.total || 0}%` }}
                ></div>
              </div>
            </div>

            {/* Section Breakdown */}
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

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
            <ActionCard
              icon="🏢"
              title="Company Information"
              description="Core company details and contacts"
              onClick={() => router.push('/company/profile')}
            />
            <ActionCard
              icon="📜"
              title="Certifications"
              description="Small business set-asides and NAICS codes"
              onClick={() => router.push('/company/certifications')}
            />
            <ActionCard
              icon="🎯"
              title="Capabilities"
              description="Services, tools, and methodologies"
              onClick={() => router.push('/company/capabilities')}
            />
            <ActionCard
              icon="📊"
              title="Past Performance"
              description="Contract history and achievements"
              onClick={() => router.push('/company/past-performance')}
            />
            <ActionCard
              icon="👥"
              title="Personnel"
              description="Team members and key personnel"
              onClick={() => router.push('/company/personnel')}
            />
            <ActionCard
              icon="⭐"
              title="Differentiators"
              description="Win themes and value propositions"
              onClick={() => router.push('/company/differentiators')}
            />
            <ActionCard
              icon="📝"
              title="Boilerplate Library"
              description="Reusable text and templates"
              onClick={() => router.push('/company/boilerplate')}
            />
          </div>

          {/* Recommendation Banner */}
          {completeness && completeness.total < 70 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <h3 className="font-semibold text-yellow-900 mb-2">
                📋 Next Steps to Improve Proposal Quality
              </h3>
              <p className="text-yellow-800 mb-4">
                Your profile is at {completeness.total}% completion. To generate competitive proposals, we recommend reaching 70%+.
              </p>
              <div className="space-y-2">
                {completeness.past_performance < 20 && (
                  <div className="text-yellow-900">
                    • Add at least <strong>3 past performance contracts</strong> (most critical for proposals)
                  </div>
                )}
                {completeness.personnel < 15 && (
                  <div className="text-yellow-900">
                    • Add <strong>key personnel</strong> for common proposal roles
                  </div>
                )}
                {completeness.capabilities < 10 && (
                  <div className="text-yellow-900">
                    • Add more <strong>service areas and capabilities</strong>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </main>
  );
}

function CompletionBadge({ score }: { score: number }) {
  if (score >= 91) {
    return (
      <span className="px-4 py-2 rounded-full text-sm font-semibold bg-green-100 text-green-800">
        Excellent - Fully Optimized
      </span>
    );
  } else if (score >= 71) {
    return (
      <span className="px-4 py-2 rounded-full text-sm font-semibold bg-blue-100 text-blue-800">
        Good - Competitive Ready
      </span>
    );
  } else if (score >= 41) {
    return (
      <span className="px-4 py-2 rounded-full text-sm font-semibold bg-yellow-100 text-yellow-800">
        Basic - Draft Quality
      </span>
    );
  } else {
    return (
      <span className="px-4 py-2 rounded-full text-sm font-semibold bg-red-100 text-red-800">
        Incomplete
      </span>
    );
  }
}

function getProgressColor(score: number): string {
  if (score >= 91) return 'bg-green-600';
  if (score >= 71) return 'bg-blue-600';
  if (score >= 41) return 'bg-yellow-600';
  return 'bg-red-600';
}

function ScoreCard({ title, score, maxScore }: { title: string; score: number; maxScore: number }) {
  const percentage = (score / maxScore) * 100;

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="text-sm text-gray-600 mb-2">{title}</div>
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-2xl font-bold">{score}</span>
        <span className="text-gray-500">/ {maxScore}</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full ${getProgressColor(percentage)}`}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
}

function ActionCard({
  icon,
  title,
  description,
  onClick,
}: {
  icon: string;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="bg-white shadow-md rounded-lg p-6 hover:shadow-lg transition-shadow text-left"
    >
      <div className="text-4xl mb-3">{icon}</div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-gray-600 text-sm">{description}</p>
    </button>
  );
}
