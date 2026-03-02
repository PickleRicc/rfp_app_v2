'use client';

import { useState, useEffect } from 'react';
import { useFetchWithCompany } from '@/lib/hooks/useFetchWithCompany';
import type { CompanyProfile, ContractVehicle, Certification, ISOCMMIStatus, DCAAApprovedSystems } from '@/lib/supabase/company-types';

type FetchFn = (url: string, options?: RequestInit) => Promise<Response>;

interface VehiclesCertificationsTabProps {
  companyId: string;
  initialProfileData: Partial<CompanyProfile>;
  onSaved: () => void;
  fetchFn?: FetchFn;
}

interface VehicleForm {
  vehicle_name: string;
  contract_number: string;
  vehicle_type: ContractVehicle['vehicle_type'] | '';
  ordering_period_end: string;
  ceiling_value: string;
}

interface FacilityClearanceForm {
  has_facility_clearance: boolean;
  clearance_level: string;
  sponsoring_agency: string;
  cage_code_cleared: string;
}

interface CertForm {
  certification_type: string;
  certifying_agency: string;
  certification_number: string;
  effective_date: string;
  expiration_date: string;
}

const DEFAULT_ISO_CMMI: ISOCMMIStatus = {
  iso_9001: false,
  iso_27001: false,
  iso_20000: false,
  cmmi_dev_level: null,
  cmmi_svc_level: null,
  itil_certified: false,
};

const DEFAULT_DCAA: DCAAApprovedSystems = {
  accounting: false,
  estimating: false,
  purchasing: false,
  timekeeping: false,
  compensation: false,
  billing: false,
};

const CMMI_LEVELS = [
  { label: 'None', value: '' },
  { label: 'Level 1', value: '1' },
  { label: 'Level 2', value: '2' },
  { label: 'Level 3', value: '3' },
  { label: 'Level 4', value: '4' },
  { label: 'Level 5', value: '5' },
];

const COMMON_CERT_TYPES = [
  '8(a)',
  'HUBZone',
  'SDVOSB',
  'VOSB',
  'WOSB',
  'EDWOSB',
  'SDB',
  'Minority-Owned',
  'Other',
];

export function VehiclesCertificationsTab({
  companyId,
  initialProfileData,
  onSaved,
  fetchFn,
}: VehiclesCertificationsTabProps) {
  const { fetchWithCompany } = useFetchWithCompany();
  const doFetch: FetchFn = fetchFn || fetchWithCompany;

  // Profile-level JSONB state
  const [isoCmmi, setIsoCmmi] = useState<ISOCMMIStatus>({ ...DEFAULT_ISO_CMMI });
  const [dcaaSystems, setDcaaSystems] = useState<DCAAApprovedSystems>({ ...DEFAULT_DCAA });

  // Relational data fetched from GET /api/company/certifications
  const [vehicles, setVehicles] = useState<ContractVehicle[]>([]);
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [facilityClearance, setFacilityClearance] = useState<FacilityClearanceForm>({
    has_facility_clearance: false,
    clearance_level: '',
    sponsoring_agency: '',
    cage_code_cleared: '',
  });

  // UI state — inline forms
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [vehicleForm, setVehicleForm] = useState<VehicleForm>({
    vehicle_name: '',
    contract_number: '',
    vehicle_type: '',
    ordering_period_end: '',
    ceiling_value: '',
  });

  const [showCertForm, setShowCertForm] = useState(false);
  const [certForm, setCertForm] = useState<CertForm>({
    certification_type: '',
    certifying_agency: '',
    certification_number: '',
    effective_date: '',
    expiration_date: '',
  });

  // Save state
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [certDataLoading, setCertDataLoading] = useState(true);

  // Initialize JSONB fields from initialProfileData
  useEffect(() => {
    if (initialProfileData.iso_cmmi_status) {
      setIsoCmmi({ ...DEFAULT_ISO_CMMI, ...initialProfileData.iso_cmmi_status });
    }
    if (initialProfileData.dcaa_approved_systems) {
      setDcaaSystems({ ...DEFAULT_DCAA, ...initialProfileData.dcaa_approved_systems });
    }
  }, [initialProfileData]);

  // Fetch relational certification data on mount
  useEffect(() => {
    fetchCertData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const fetchCertData = async () => {
    try {
      setCertDataLoading(true);
      const response = await doFetch('/api/company/certifications');
      const data = await response.json();
      setVehicles(data.contractVehicles || []);
      setCertifications(data.certifications || []);
      if (data.facilityClearance) {
        setFacilityClearance({
          has_facility_clearance: data.facilityClearance.has_facility_clearance || false,
          clearance_level: data.facilityClearance.clearance_level || '',
          sponsoring_agency: data.facilityClearance.sponsoring_agency || '',
          cage_code_cleared: data.facilityClearance.cage_code_cleared || '',
        });
      }
    } catch (err) {
      console.error('Error fetching certification data:', err);
    } finally {
      setCertDataLoading(false);
    }
  };

  // ---- Contract vehicle actions ----
  const addVehicle = async () => {
    if (!vehicleForm.vehicle_name || !vehicleForm.vehicle_type) return;
    try {
      const response = await doFetch('/api/company/certifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'vehicle',
          vehicle_name: vehicleForm.vehicle_name,
          contract_number: vehicleForm.contract_number || null,
          vehicle_type: vehicleForm.vehicle_type,
          ordering_period_end: vehicleForm.ordering_period_end || null,
          ceiling_value: vehicleForm.ceiling_value ? parseFloat(vehicleForm.ceiling_value) : null,
        }),
      });
      if (!response.ok) throw new Error('Failed to add vehicle');
      setVehicleForm({
        vehicle_name: '',
        contract_number: '',
        vehicle_type: '',
        ordering_period_end: '',
        ceiling_value: '',
      });
      setShowVehicleForm(false);
      await fetchCertData();
    } catch (err) {
      console.error(err);
    }
  };

  // ---- Certification actions ----
  const addCertification = async () => {
    if (!certForm.certification_type) return;
    try {
      const response = await doFetch('/api/company/certifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'certification',
          ...certForm,
        }),
      });
      if (!response.ok) throw new Error('Failed to add certification');
      setCertForm({
        certification_type: '',
        certifying_agency: '',
        certification_number: '',
        effective_date: '',
        expiration_date: '',
      });
      setShowCertForm(false);
      await fetchCertData();
    } catch (err) {
      console.error(err);
    }
  };

  // ---- Facility clearance save ----
  const saveFacilityClearance = async () => {
    try {
      const response = await doFetch('/api/company/certifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'facility_clearance',
          has_facility_clearance: facilityClearance.has_facility_clearance,
          clearance_level: facilityClearance.clearance_level || null,
          sponsoring_agency: facilityClearance.sponsoring_agency || null,
          cage_code_cleared: facilityClearance.cage_code_cleared || null,
        }),
      });
      if (!response.ok) throw new Error('Failed to save facility clearance');
    } catch (err) {
      console.error(err);
    }
  };

  // ---- Main save: PUT profile-level JSONB fields + facility clearance ----
  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    setSaveError(null);
    try {
      // Save facility clearance
      await saveFacilityClearance();

      // Save JSONB fields on profile
      const response = await doFetch('/api/company/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          iso_cmmi_status: isoCmmi,
          dcaa_approved_systems: dcaaSystems,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save');
      }
      setSaveSuccess(true);
      onSaved();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // ---- Toggle helpers ----
  const toggleISO = (key: keyof Pick<ISOCMMIStatus, 'iso_9001' | 'iso_27001' | 'iso_20000' | 'itil_certified'>) => {
    setIsoCmmi((prev) => ({ ...prev, [key]: !prev[key] }));
  };
  const setCMMILevel = (key: 'cmmi_dev_level' | 'cmmi_svc_level', val: string) => {
    setIsoCmmi((prev) => ({ ...prev, [key]: val ? parseInt(val, 10) : null }));
  };
  const toggleDCAA = (key: keyof DCAAApprovedSystems) => {
    setDcaaSystems((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="space-y-6">
      {/* Success / Error banners */}
      {saveSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-800 font-medium">Vehicles & Certifications saved successfully.</p>
        </div>
      )}
      {saveError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{saveError}</p>
        </div>
      )}

      {/* Contract Vehicles */}
      <div className="bg-white shadow-md rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Contract Vehicles</h2>
          <button
            type="button"
            onClick={() => setShowVehicleForm(!showVehicleForm)}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
          >
            {showVehicleForm ? 'Cancel' : '+ Add Vehicle'}
          </button>
        </div>

        {certDataLoading ? (
          <p className="text-gray-400 text-sm">Loading vehicles...</p>
        ) : vehicles.length === 0 && !showVehicleForm ? (
          <p className="text-gray-400 text-sm">No contract vehicles added yet.</p>
        ) : null}

        {/* Vehicle cards */}
        <div className="space-y-3 mb-4">
          {vehicles.map((v) => (
            <div key={v.id} className="border border-gray-200 rounded-lg p-4 flex items-start justify-between">
              <div>
                <p className="font-medium text-gray-900">{v.vehicle_name}</p>
                <p className="text-sm text-gray-500">
                  {v.vehicle_type}
                  {v.contract_number && ` — ${v.contract_number}`}
                  {v.ordering_period_end && ` — Expires: ${v.ordering_period_end}`}
                  {v.ceiling_value && ` — Ceiling: $${v.ceiling_value.toLocaleString()}`}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Inline add form */}
        {showVehicleForm && (
          <div className="border border-blue-200 bg-blue-50 rounded-lg p-4 space-y-3">
            <h3 className="font-medium text-gray-800">Add Contract Vehicle</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Vehicle Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={vehicleForm.vehicle_name}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, vehicle_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., CIO-SP3"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Vehicle Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={vehicleForm.vehicle_type}
                  onChange={(e) =>
                    setVehicleForm({
                      ...vehicleForm,
                      vehicle_type: e.target.value as ContractVehicle['vehicle_type'] | '',
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select type...</option>
                  <option value="GWAC">GWAC</option>
                  <option value="BPA">BPA</option>
                  <option value="IDIQ">IDIQ</option>
                  <option value="GSA Schedule">GSA Schedule</option>
                  <option value="State/Local Vehicle">State/Local Vehicle</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Contract Number</label>
                <input
                  type="text"
                  value={vehicleForm.contract_number}
                  onChange={(e) =>
                    setVehicleForm({ ...vehicleForm, contract_number: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 75N98119D00xxx"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Ordering Period End</label>
                <input
                  type="date"
                  value={vehicleForm.ordering_period_end}
                  onChange={(e) =>
                    setVehicleForm({ ...vehicleForm, ordering_period_end: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Ceiling Value ($)</label>
                <input
                  type="number"
                  min={0}
                  value={vehicleForm.ceiling_value}
                  onChange={(e) =>
                    setVehicleForm({ ...vehicleForm, ceiling_value: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowVehicleForm(false)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={addVehicle}
                disabled={!vehicleForm.vehicle_name || !vehicleForm.vehicle_type}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Add Vehicle
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Quality & Compliance Certifications (ISO/CMMI/ITIL) */}
      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Quality & Compliance Certifications</h2>
        <p className="text-sm text-gray-500 mb-4">
          ISO, CMMI, and ITIL status. These appear in proposal quality management sections.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Boolean toggles */}
          {(
            [
              { key: 'iso_9001' as const, label: 'ISO 9001 — Quality Management' },
              { key: 'iso_27001' as const, label: 'ISO 27001 — Information Security' },
              { key: 'iso_20000' as const, label: 'ISO 20000 — IT Service Management' },
              { key: 'itil_certified' as const, label: 'ITIL Certified' },
            ] as const
          ).map(({ key, label }) => (
            <label
              key={key}
              className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                isoCmmi[key]
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <button
                type="button"
                role="switch"
                aria-checked={isoCmmi[key]}
                onClick={() => toggleISO(key)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                  isoCmmi[key] ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${
                    isoCmmi[key] ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
              <span className="text-sm font-medium text-gray-700">{label}</span>
            </label>
          ))}

          {/* CMMI-DEV Level */}
          <div className="p-3 border border-gray-200 rounded-lg">
            <label className="block text-sm font-medium text-gray-700 mb-2">CMMI-DEV Level</label>
            <select
              value={isoCmmi.cmmi_dev_level?.toString() || ''}
              onChange={(e) => setCMMILevel('cmmi_dev_level', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
            >
              {CMMI_LEVELS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>

          {/* CMMI-SVC Level */}
          <div className="p-3 border border-gray-200 rounded-lg">
            <label className="block text-sm font-medium text-gray-700 mb-2">CMMI-SVC Level</label>
            <select
              value={isoCmmi.cmmi_svc_level?.toString() || ''}
              onChange={(e) => setCMMILevel('cmmi_svc_level', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
            >
              {CMMI_LEVELS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* DCAA-Approved Systems */}
      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">DCAA-Approved Systems</h2>
        <p className="text-sm text-gray-500 mb-4">
          Toggle each system that has received DCAA approval. Referenced in cost proposal sections.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(
            [
              { key: 'accounting' as const, label: 'Accounting System' },
              { key: 'estimating' as const, label: 'Estimating System' },
              { key: 'purchasing' as const, label: 'Purchasing System' },
              { key: 'timekeeping' as const, label: 'Timekeeping System' },
              { key: 'compensation' as const, label: 'Compensation System' },
              { key: 'billing' as const, label: 'Billing System' },
            ] as const
          ).map(({ key, label }) => (
            <label
              key={key}
              className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                dcaaSystems[key]
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <button
                type="button"
                role="switch"
                aria-checked={dcaaSystems[key]}
                onClick={() => toggleDCAA(key)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                  dcaaSystems[key] ? 'bg-green-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${
                    dcaaSystems[key] ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
              <span className="text-sm font-medium text-gray-700">{label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Facility Clearance */}
      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Facility Clearance</h2>

        <label className="flex items-center gap-3 cursor-pointer mb-4">
          <button
            type="button"
            role="switch"
            aria-checked={facilityClearance.has_facility_clearance}
            onClick={() =>
              setFacilityClearance((prev) => ({
                ...prev,
                has_facility_clearance: !prev.has_facility_clearance,
              }))
            }
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
              facilityClearance.has_facility_clearance ? 'bg-blue-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${
                facilityClearance.has_facility_clearance ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
          <span className="text-sm font-medium text-gray-700">Company has facility clearance</span>
        </label>

        {facilityClearance.has_facility_clearance && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Clearance Level</label>
              <select
                value={facilityClearance.clearance_level}
                onChange={(e) =>
                  setFacilityClearance({ ...facilityClearance, clearance_level: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select level...</option>
                <option value="Confidential">Confidential</option>
                <option value="Secret">Secret</option>
                <option value="Top Secret">Top Secret</option>
                <option value="TS/SCI">TS/SCI</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sponsoring Agency</label>
              <input
                type="text"
                value={facilityClearance.sponsoring_agency}
                onChange={(e) =>
                  setFacilityClearance({ ...facilityClearance, sponsoring_agency: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                placeholder="DoD, DHS, etc."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CAGE Code (Cleared)</label>
              <input
                type="text"
                value={facilityClearance.cage_code_cleared}
                onChange={(e) =>
                  setFacilityClearance({ ...facilityClearance, cage_code_cleared: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                placeholder="5-character CAGE code"
              />
            </div>
          </div>
        )}
      </div>

      {/* Socioeconomic Certifications (formal relational records) */}
      <div className="bg-white shadow-md rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Socioeconomic Certifications</h2>
            <p className="text-sm text-gray-500 mt-1">
              Formal certification records with certifying agency and dates. Selected designations on the Corporate Identity tab for quick set-aside filtering.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCertForm(!showCertForm)}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
          >
            {showCertForm ? 'Cancel' : '+ Add Certification'}
          </button>
        </div>

        {certDataLoading ? (
          <p className="text-gray-400 text-sm">Loading certifications...</p>
        ) : certifications.length === 0 && !showCertForm ? (
          <p className="text-gray-400 text-sm">No certification records added yet.</p>
        ) : null}

        {/* Certification cards */}
        <div className="space-y-3 mb-4">
          {certifications.map((c) => (
            <div key={c.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-gray-900">{c.certification_type}</p>
                  <p className="text-sm text-gray-500">
                    {c.certifying_agency && `Agency: ${c.certifying_agency}`}
                    {c.certification_number && ` — #${c.certification_number}`}
                  </p>
                  {(c.effective_date || c.expiration_date) && (
                    <p className="text-xs text-gray-400 mt-1">
                      {c.effective_date && `Effective: ${c.effective_date}`}
                      {c.effective_date && c.expiration_date && ' — '}
                      {c.expiration_date && `Expires: ${c.expiration_date}`}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Inline add form */}
        {showCertForm && (
          <div className="border border-blue-200 bg-blue-50 rounded-lg p-4 space-y-3">
            <h3 className="font-medium text-gray-800">Add Certification Record</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Certification Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={certForm.certification_type}
                  onChange={(e) =>
                    setCertForm({ ...certForm, certification_type: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select type...</option>
                  {COMMON_CERT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Certifying Agency</label>
                <input
                  type="text"
                  value={certForm.certifying_agency}
                  onChange={(e) => setCertForm({ ...certForm, certifying_agency: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="SBA, DVA, etc."
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Certification Number</label>
                <input
                  type="text"
                  value={certForm.certification_number}
                  onChange={(e) =>
                    setCertForm({ ...certForm, certification_number: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Effective Date</label>
                  <input
                    type="date"
                    value={certForm.effective_date}
                    onChange={(e) => setCertForm({ ...certForm, effective_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Expiration Date</label>
                  <input
                    type="date"
                    value={certForm.expiration_date}
                    onChange={(e) =>
                      setCertForm({ ...certForm, expiration_date: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCertForm(false)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={addCertification}
                disabled={!certForm.certification_type}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Add Certification
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Save button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 text-white px-8 py-3 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold"
        >
          {saving ? 'Saving...' : 'Save Vehicles & Certifications'}
        </button>
      </div>
    </div>
  );
}
