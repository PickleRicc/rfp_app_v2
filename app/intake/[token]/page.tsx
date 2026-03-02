'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { Tier1TabLayout, type Tab } from '@/app/components/tier1/Tier1TabLayout';
import { CorporateIdentityTab } from '@/app/components/tier1/CorporateIdentityTab';
import { VehiclesCertificationsTab } from '@/app/components/tier1/VehiclesCertificationsTab';
import { CapabilitiesPositioningTab } from '@/app/components/tier1/CapabilitiesPositioningTab';
import { Tier1CompletenessBar } from '@/app/components/tier1/Tier1CompletenessBar';
import type { CompanyProfile } from '@/lib/supabase/company-types';
import { FileText, Shield, CheckCircle2 } from 'lucide-react';

const TABS: Tab[] = [
  { id: 'corporate-identity', label: 'Corporate Identity' },
  { id: 'vehicles-certifications', label: 'Vehicles & Certifications' },
  { id: 'capabilities-positioning', label: 'Capabilities & Positioning' },
];

type PageState = 'loading' | 'error' | 'ready';

export default function PublicIntakePage() {
  const params = useParams();
  const token = params.token as string;

  const [state, setState] = useState<PageState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [profileData, setProfileData] = useState<Partial<CompanyProfile>>({});
  const [activeTab, setActiveTab] = useState('corporate-identity');

  const refreshCompletenessRef = useRef<(() => void) | null>(null);

  const fetchWithToken = useCallback(
    async (url: string, options?: RequestInit): Promise<Response> => {
      const baseUrl = url.startsWith('/api/company/')
        ? url.replace('/api/company/', `/api/intake/${token}/`)
        : url;
      return fetch(baseUrl, options);
    },
    [token]
  );

  const fetchWithTokenForCompleteness = useMemo(() => {
    return async (url: string, options?: RequestInit): Promise<Response> => {
      const baseUrl = url.replace('/api/company/', `/api/intake/${token}/`);
      return fetch(baseUrl, options);
    };
  }, [token]);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch(`/api/intake/${token}/profile`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Unknown error' }));
        setError(data.error || `Error ${res.status}`);
        setState('error');
        return;
      }
      const data = await res.json();
      if (data.profile) {
        setProfileData(data.profile);
        setCompanyId(data.profile.id);
        setCompanyName(data.companyName || data.profile.company_name || 'Company');
      }
      setState('ready');
      refreshCompletenessRef.current?.();
    } catch {
      setError('Failed to load profile. Please check your link and try again.');
      setState('error');
    }
  }, [token]);

  useEffect(() => {
    if (token) fetchProfile();
  }, [token, fetchProfile]);

  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-2 border-blue-600 border-t-transparent mx-auto mb-4" />
          <p className="text-slate-500">Loading your intake form...</p>
        </div>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="rounded-xl border border-red-200 bg-white shadow-lg p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 mx-auto mb-4">
              <Shield className="h-8 w-8 text-red-600" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 mb-2">Unable to Access Form</h1>
            <p className="text-slate-600 mb-6">{error}</p>
            <p className="text-sm text-slate-400">
              If you believe this is an error, please contact the person who sent you this link.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Enterprise Profile Intake</p>
                <p className="text-xs text-slate-500">{companyName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Shield className="h-3.5 w-3.5" />
              Secure link
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Enterprise Profile
          </h1>
          <p className="text-slate-500 text-sm">
            Please complete the sections below. Your data is saved automatically when you click Save on each section.
            You can return to this link at any time to update your information.
          </p>
        </div>

        <div className="mb-6 rounded-lg border border-blue-100 bg-blue-50 p-4">
          <div className="flex gap-3">
            <CheckCircle2 className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Three sections to complete:</p>
              <ol className="list-decimal list-inside space-y-0.5 text-blue-700">
                <li><strong>Corporate Identity</strong> — Company name, registration, contacts, and classification</li>
                <li><strong>Vehicles & Certifications</strong> — Contract vehicles, ISO/CMMI, DCAA, and clearances</li>
                <li><strong>Capabilities & Positioning</strong> — Corporate overview, services, win themes, and differentiators</li>
              </ol>
            </div>
          </div>
        </div>

        {companyId && (
          <Tier1CompletenessBar
            companyId={companyId}
            onRefreshRef={(fn) => { refreshCompletenessRef.current = fn; }}
            fetchFn={fetchWithTokenForCompleteness}
          />
        )}

        {companyId && (
          <Tier1TabLayout activeTab={activeTab} onTabChange={setActiveTab} tabs={TABS}>
            {activeTab === 'corporate-identity' && (
              <CorporateIdentityTab
                companyId={companyId}
                initialData={profileData}
                onSaved={fetchProfile}
                fetchFn={fetchWithToken}
              />
            )}
            {activeTab === 'vehicles-certifications' && (
              <VehiclesCertificationsTab
                companyId={companyId}
                initialProfileData={profileData}
                onSaved={fetchProfile}
                fetchFn={fetchWithToken}
              />
            )}
            {activeTab === 'capabilities-positioning' && (
              <CapabilitiesPositioningTab
                companyId={companyId}
                initialProfileData={profileData}
                onSaved={fetchProfile}
                fetchFn={fetchWithToken}
              />
            )}
          </Tier1TabLayout>
        )}

        <div className="mt-12 border-t border-slate-200 pt-6 text-center text-xs text-slate-400">
          <p>This is a secure intake form. Your data is encrypted in transit and at rest.</p>
          <p className="mt-1">If you have questions, please contact your proposal representative.</p>
        </div>
      </main>
    </div>
  );
}
