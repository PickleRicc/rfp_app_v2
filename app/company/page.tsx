'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
  UserPlus,
  X,
  Copy,
  Link2,
  ExternalLink,
  Trash2,
  CheckCircle2,
  type LucideIcon,
} from 'lucide-react';
import { useCompany } from '@/lib/context/CompanyContext';
import { useFetchWithCompany } from '@/lib/hooks/useFetchWithCompany';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';

interface CompletenessScore {
  core_information: number;
  certifications: number;
  capabilities: number;
  past_performance: number;
  personnel: number;
  differentiators: number;
  total: number;
}

export default function CompanyDashboardPage() {
  return (
    <Suspense>
      <CompanyDashboard />
    </Suspense>
  );
}

function CompanyDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { selectedCompany, selectedCompanyId, refreshCompanies } = useCompany();
  const { fetchWithCompany } = useFetchWithCompany();
  const [loading, setLoading] = useState(true);
  const [hasProfile, setHasProfile] = useState(false);
  const [completeness, setCompleteness] = useState<CompletenessScore | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteResult, setInviteResult] = useState<{
    loginUrl: string;
    email: string;
    temporaryPassword: string;
    companyName: string;
  } | null>(null);

  const [intakeLinkOpen, setIntakeLinkOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get('newIntake') === '1') {
      setIntakeLinkOpen(true);
      router.replace('/company', { scroll: false });
    }
  }, [searchParams, router]);

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
          <div className="flex justify-between items-center flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl mb-2">
                {selectedCompany ? `${selectedCompany.company_name} - Company Data` : "Company Data"}
              </h1>
              <p className="text-muted-foreground">Manage company information for proposal generation</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setIntakeLinkOpen(true)}
              >
                <Link2 className="h-4 w-4" />
                Share intake link
              </Button>
              {selectedCompany && hasProfile && (
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => {
                    setInviteOpen(true);
                    setInviteEmail('');
                    setInvitePassword('');
                    setInviteError(null);
                    setInviteResult(null);
                  }}
                >
                  <UserPlus className="h-4 w-4" />
                  Invite client
                </Button>
              )}
            </div>
          </div>
        </div>

        {intakeLinkOpen && (
          <IntakeLinkModal
            companyId={selectedCompanyId}
            companyName={selectedCompany?.company_name ?? ''}
            onClose={() => setIntakeLinkOpen(false)}
            onCompanyCreated={() => refreshCompanies()}
          />
        )}

        {inviteOpen && selectedCompanyId && (
          <InviteClientModal
            companyId={selectedCompanyId}
            companyName={selectedCompany?.company_name ?? ''}
            email={inviteEmail}
            setEmail={setInviteEmail}
            password={invitePassword}
            setPassword={setInvitePassword}
            loading={inviteLoading}
            setLoading={setInviteLoading}
            error={inviteError}
            setError={setInviteError}
            result={inviteResult}
            setResult={setInviteResult}
            onClose={() => setInviteOpen(false)}
          />
        )}

        {!selectedCompany && !loading && (
          <div className="rounded-xl border border-warning/30 bg-warning/5 p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-8 w-8 shrink-0 text-warning-foreground" />
              <div>
                <h3 className="font-semibold text-foreground mb-1">No Company Selected</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Select a company from the header above, or generate a remote intake link to onboard a new client.
                </p>
                <button
                  onClick={() => setIntakeLinkOpen(true)}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2"
                >
                  <Link2 className="h-4 w-4" />
                  Create New Company via Intake Link
                </button>
              </div>
            </div>
          </div>
        )}

        {selectedCompany && !hasProfile ? (
          <div className="rounded-xl border border-border bg-card p-8">
            <h2 className="text-2xl font-bold text-foreground mb-4">Get Started</h2>
            <p className="text-muted-foreground mb-6">
              This company profile is empty. Generate a remote intake link and send it to your client so they can fill in their Enterprise Profile directly.
            </p>

            <div className="rounded-xl border border-callout-border bg-callout p-6 mb-6">
              <h3 className="font-semibold text-foreground mb-3">What the client will complete</h3>
              <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                <li><strong className="text-foreground">Corporate Identity</strong> — Name, registration, contacts, classification</li>
                <li><strong className="text-foreground">Vehicles & Certifications</strong> — Contract vehicles, ISO/CMMI, DCAA, clearances</li>
                <li><strong className="text-foreground">Capabilities & Positioning</strong> — Overview, services, win themes, differentiators</li>
              </ol>
            </div>

            <button
              onClick={() => setIntakeLinkOpen(true)}
              className="rounded-md bg-primary px-8 py-3 text-lg font-semibold text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2"
            >
              <Link2 className="h-5 w-5" />
              Generate Intake Link
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

function InviteClientModal({
  companyId,
  companyName,
  email,
  setEmail,
  password,
  setPassword,
  loading,
  setLoading,
  error,
  setError,
  result,
  setResult,
  onClose,
}: {
  companyId: string;
  companyName: string;
  email: string;
  setEmail: (s: string) => void;
  password: string;
  setPassword: (s: string) => void;
  loading: boolean;
  setLoading: (b: boolean) => void;
  error: string | null;
  setError: (s: string | null) => void;
  result: {
    loginUrl: string;
    email: string;
    temporaryPassword: string;
    companyName: string;
  } | null;
  setResult: (r: typeof result) => void;
  onClose: () => void;
}) {
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/company/invite-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          email: email.trim(),
          temporaryPassword: password.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.error ?? 'Failed to invite client';
        setError(data.details ? `${msg}: ${data.details}` : msg);
        return;
      }
      setResult({
        loginUrl: data.loginUrl,
        email: data.email,
        temporaryPassword: data.temporaryPassword,
        companyName: data.companyName ?? companyName,
      });
    } catch {
      setError('Failed to invite client');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="rounded-xl border border-border bg-card shadow-lg max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-foreground">Invite client to portal</h2>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Create a client login for <strong>{companyName}</strong>. They will only see this company&apos;s proposals and onboarding.
        </p>

        {result ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-callout-border bg-callout p-4 text-sm">
              <p className="font-medium text-foreground mb-2">Share these details with the client securely:</p>
              <div className="space-y-2">
                <div>
                  <span className="text-muted-foreground">Portal login:</span>
                  <div className="flex gap-2 mt-1">
                    <Input readOnly value={result.loginUrl} className="font-mono text-xs" />
                    <Button type="button" variant="outline" size="icon" onClick={() => copyToClipboard(result.loginUrl)} title="Copy">
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Email:</span> <span className="font-mono">{result.email}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Temporary password:</span>
                  <div className="flex gap-2 mt-1">
                    <Input readOnly value={result.temporaryPassword} className="font-mono" />
                    <Button type="button" variant="outline" size="icon" onClick={() => copyToClipboard(result.temporaryPassword)} title="Copy">
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            <Button onClick={onClose} className="w-full">Done</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Client email *</label>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="client@company.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Temporary password (optional)</label>
              <Input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Leave blank to auto-generate"
              />
              <p className="text-xs text-muted-foreground mt-1">Min 8 characters. If blank, a random password is generated.</p>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? 'Creating...' : 'Invite client'}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

interface IntakeTokenDisplay {
  id: string;
  token: string;
  label: string | null;
  expires_at: string;
  access_count: number;
  last_accessed_at: string | null;
  created_at: string;
}

function IntakeLinkModal({
  companyId,
  companyName,
  onClose,
  onCompanyCreated,
}: {
  companyId: string | null;
  companyName: string;
  onClose: () => void;
  onCompanyCreated?: () => void;
}) {
  const [mode, setMode] = useState<'existing' | 'new'>(companyId ? 'existing' : 'new');
  const [newCompanyName, setNewCompanyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokens, setTokens] = useState<IntakeTokenDisplay[]>([]);
  const [newUrl, setNewUrl] = useState<string | null>(null);
  const [generatedCompanyName, setGeneratedCompanyName] = useState('');
  const [label, setLabel] = useState('');
  const [expiresInDays, setExpiresInDays] = useState(30);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (companyId) fetchTokens();
  }, [companyId]);

  const fetchTokens = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const res = await fetch('/api/company/intake-token', {
        headers: { 'X-Company-Id': companyId },
      });
      if (res.ok) {
        const data = await res.json();
        setTokens(data.tokens || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const generateLink = async () => {
    if (mode === 'new' && !newCompanyName.trim()) {
      setError('Company name is required');
      return;
    }

    setGenerating(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        label: label.trim() || null,
        expiresInDays,
      };

      if (mode === 'existing' && companyId) {
        payload.companyId = companyId;
      } else {
        payload.newCompanyName = newCompanyName.trim();
      }

      const res = await fetch('/api/company/intake-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to generate link');
        return;
      }
      setNewUrl(data.intakeUrl);
      setGeneratedCompanyName(data.companyName || newCompanyName.trim());
      setLabel('');
      setNewCompanyName('');
      if (mode === 'new' && onCompanyCreated) {
        onCompanyCreated();
      }
      if (companyId) await fetchTokens();
    } catch {
      setError('Failed to generate link');
    } finally {
      setGenerating(false);
    }
  };

  const revokeToken = async (tokenId: string) => {
    try {
      await fetch(`/api/company/intake-token?tokenId=${tokenId}`, {
        method: 'DELETE',
      });
      setTokens((prev) => prev.filter((t) => t.id !== tokenId));
    } catch {
      // ignore
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const baseUrl =
    typeof window !== 'undefined'
      ? window.location.origin
      : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="rounded-xl border border-border bg-card shadow-lg max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-foreground">Share Intake Link</h2>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Generate a secure link for a client to fill in their Enterprise Profile remotely.
          No login required — the link provides direct access to the full intake form.
        </p>

        {newUrl ? (
          <div className="space-y-4 mb-6">
            <div className="rounded-lg border border-green-200 bg-green-50 p-4">
              <p className="text-sm font-medium text-green-800 mb-2">
                Link generated for <strong>{generatedCompanyName}</strong>!
              </p>
              <div className="flex gap-2">
                <Input readOnly value={newUrl} className="font-mono text-xs" />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(newUrl)}
                  title="Copy link"
                >
                  {copied ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => window.open(newUrl, '_blank')}
                  title="Open in new tab"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-green-700 mt-2">
                Send this link to your client. They can open it in any browser to fill in their full profile.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setNewUrl(null)}
            >
              Generate another link
            </Button>
          </div>
        ) : (
          <div className="space-y-4 mb-6">
            {companyId && (
              <div className="flex rounded-lg border border-border overflow-hidden">
                <button
                  type="button"
                  onClick={() => setMode('existing')}
                  className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                    mode === 'existing'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/30 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  Current company
                </button>
                <button
                  type="button"
                  onClick={() => setMode('new')}
                  className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                    mode === 'new'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/30 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  New company
                </button>
              </div>
            )}

            {mode === 'existing' && companyId ? (
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-sm text-foreground">
                  Generating link for <strong>{companyName}</strong>
                </p>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Company name *</label>
                <Input
                  required
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  placeholder="e.g., Acme Federal Solutions"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  A new company will be created in your database. The client will fill in all details.
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Label (optional)</label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g., Sent to John Smith"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Expires in</label>
              <select
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(parseInt(e.target.value, 10))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value={7}>7 days</option>
                <option value={14}>14 days</option>
                <option value={30}>30 days</option>
                <option value={60}>60 days</option>
                <option value={90}>90 days</option>
              </select>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button
              onClick={generateLink}
              disabled={generating || (mode === 'new' && !newCompanyName.trim())}
              className="w-full gap-2"
            >
              <Link2 className="h-4 w-4" />
              {generating ? 'Generating...' : mode === 'new' ? 'Create company & generate link' : 'Generate intake link'}
            </Button>
          </div>
        )}

        {tokens.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Active links</h3>
            <div className="space-y-2">
              {tokens.map((t) => {
                const isExpired = new Date(t.expires_at) < new Date();
                const url = `${baseUrl}/intake/${t.token}`;
                return (
                  <div
                    key={t.id}
                    className={`rounded-lg border p-3 text-sm ${
                      isExpired ? 'border-red-200 bg-red-50' : 'border-border bg-muted/30'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground truncate">
                          {t.label || 'Intake link'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {isExpired ? 'Expired' : `Expires ${new Date(t.expires_at).toLocaleDateString()}`}
                          {' · '}{t.access_count} access{t.access_count !== 1 ? 'es' : ''}
                          {t.last_accessed_at && ` · Last used ${new Date(t.last_accessed_at).toLocaleDateString()}`}
                        </p>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        {!isExpired && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => copyToClipboard(url)}
                            title="Copy link"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => revokeToken(t.id)}
                          title="Revoke link"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {loading && tokens.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">Loading existing links...</p>
        )}
      </div>
    </div>
  );
}
