'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useCompany } from '@/lib/context/CompanyContext';
import { useFetchWithCompany } from '@/lib/hooks/useFetchWithCompany';
import { useSearchParams } from 'next/navigation';
import { Tier1TabLayout, type Tab } from '@/app/components/tier1/Tier1TabLayout';
import { CorporateIdentityTab } from '@/app/components/tier1/CorporateIdentityTab';
import { VehiclesCertificationsTab } from '@/app/components/tier1/VehiclesCertificationsTab';
import { CapabilitiesPositioningTab } from '@/app/components/tier1/CapabilitiesPositioningTab';
import { PastPerformanceTab } from '@/app/components/tier1/PastPerformanceTab';
import { Tier1CompletenessBar } from '@/app/components/tier1/Tier1CompletenessBar';
import type { CompanyProfile } from '@/lib/supabase/company-types';

const TABS: Tab[] = [
  { id: 'corporate-identity', label: 'Corporate Identity' },
  { id: 'vehicles-certifications', label: 'Vehicles & Certifications' },
  { id: 'past-performance', label: 'Past Performance' },
  { id: 'capabilities-positioning', label: 'Capabilities & Positioning' },
];

export default function CompanyProfilePageWrapper() {
  return (
    <Suspense>
      <CompanyProfilePage />
    </Suspense>
  );
}

function CompanyProfilePage() {
  const { selectedCompany, selectedCompanyId } = useCompany();
  const { fetchWithCompany } = useFetchWithCompany();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab');

  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState<Partial<CompanyProfile>>({});
  const [activeTab, setActiveTab] = useState(
    initialTab && TABS.some((t) => t.id === initialTab) ? initialTab : 'corporate-identity'
  );

  // Ref to the Tier1CompletenessBar's refresh function so tabs can trigger re-fetch
  const refreshCompletenessRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (selectedCompanyId) {
      fetchProfile();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompanyId]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await fetchWithCompany('/api/company/profile');
      const data = await response.json();
      if (data.profile) {
        setProfileData(data.profile);
      }
      // After re-fetching the profile (triggered by a tab save), also refresh the
      // completeness bar so the score updates without needing a full page reload.
      refreshCompletenessRef.current?.();
    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen p-8 max-w-5xl mx-auto">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </main>
    );
  }

  if (!selectedCompany) {
    return (
      <main className="min-h-screen p-8 max-w-5xl mx-auto">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h3 className="font-semibold text-yellow-900 mb-1">No Company Selected</h3>
          <p className="text-sm text-yellow-800">
            Please select a company from the header to edit its profile.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <a href="/company" className="text-blue-600 hover:underline mb-4 inline-block text-sm">
          &larr; Back to Dashboard
        </a>
        <h1 className="text-3xl font-bold text-gray-900 mb-1">Enterprise Profile</h1>
        <p className="text-gray-500 text-sm">
          Tier 1 intake — stable corporate data used across all proposals
        </p>
      </div>

      <Tier1CompletenessBar
        companyId={selectedCompanyId || ''}
        onRefreshRef={(fn) => { refreshCompletenessRef.current = fn; }}
      />

      <Tier1TabLayout activeTab={activeTab} onTabChange={setActiveTab} tabs={TABS}>
        {activeTab === 'corporate-identity' && (
          <CorporateIdentityTab
            companyId={selectedCompanyId || ''}
            initialData={profileData}
            onSaved={fetchProfile}
          />
        )}
        {activeTab === 'vehicles-certifications' && (
          <VehiclesCertificationsTab
            companyId={selectedCompanyId || ''}
            initialProfileData={profileData}
            onSaved={fetchProfile}
          />
        )}
        {activeTab === 'capabilities-positioning' && (
          <CapabilitiesPositioningTab
            companyId={selectedCompanyId || ''}
            initialProfileData={profileData}
            onSaved={fetchProfile}
          />
        )}
        {activeTab === 'past-performance' && (
          <PastPerformanceTab
            companyId={selectedCompanyId || ''}
            onSaved={fetchProfile}
          />
        )}
      </Tier1TabLayout>
    </main>
  );
}
