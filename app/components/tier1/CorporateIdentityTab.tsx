'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useFetchWithCompany } from '@/lib/hooks/useFetchWithCompany';
import type { CompanyProfile } from '@/lib/supabase/company-types';
import {
  validateUEI,
  validateCAGE,
  validateNAICS,
  checkSAMStatus,
  type SAMStatusResult,
} from '@/lib/validation/tier1-validators';

type FetchFn = (url: string, options?: RequestInit) => Promise<Response>;

interface CorporateIdentityTabProps {
  companyId: string;
  initialData: Partial<CompanyProfile>;
  onSaved: () => void;
  fetchFn?: FetchFn;
}

const SOCIOECONOMIC_OPTIONS = [
  '8(a)',
  'HUBZone',
  'SDVOSB',
  'VOSB',
  'WOSB',
  'EDWOSB',
  'SDB',
  'Minority-Owned',
];

interface FormErrors {
  uei_number?: string;
  cage_code?: string;
  primary_naics?: string;
  [key: string]: string | undefined;
}

export function CorporateIdentityTab({
  companyId,
  initialData,
  onSaved,
  fetchFn,
}: CorporateIdentityTabProps) {
  const { fetchWithCompany } = useFetchWithCompany();
  const doFetch: FetchFn = fetchFn || fetchWithCompany;

  // ---- Form state (each tab manages its own) ----
  const [legalName, setLegalName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [dbaNames, setDbaNames] = useState<string[]>([]);
  const [dbaInput, setDbaInput] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('');
  const [secondaryColor, setSecondaryColor] = useState('');

  const [ueiNumber, setUeiNumber] = useState('');
  const [cageCode, setCageCode] = useState('');
  const [samStatus, setSamStatus] = useState<CompanyProfile['sam_status']>('Active');
  const [samExpiration, setSamExpiration] = useState('');

  const [primaryNaics, setPrimaryNaics] = useState('');
  const [primaryNaicsTitle, setPrimaryNaicsTitle] = useState('');
  const [businessSize, setBusinessSize] = useState<CompanyProfile['business_size']>(undefined);
  const [socioCerts, setSocioCerts] = useState<string[]>([]);

  const [yearFounded, setYearFounded] = useState<number>(new Date().getFullYear());
  const [employeeCount, setEmployeeCount] = useState(1);
  const [annualRevenue, setAnnualRevenue] = useState(0);
  const [fiscalYearEnd, setFiscalYearEnd] = useState('');
  const [website, setWebsite] = useState('');
  const [headquartersAddress, setHeadquartersAddress] = useState({
    street: '',
    suite: '',
    city: '',
    state: '',
    zip: '',
    country: 'USA',
  });

  const [proposalPoc, setProposalPoc] = useState({
    name: '',
    title: '',
    email: '',
    phone: '',
  });
  const [contractsPoc, setContractsPoc] = useState({
    name: '',
    title: '',
    email: '',
    phone: '',
  });
  const [authorizedSigner, setAuthorizedSigner] = useState({
    name: '',
    title: '',
    email: '',
  });

  // ---- Validation / status state ----
  const [errors, setErrors] = useState<FormErrors>({});
  const [samStatusResult, setSamStatusResult] = useState<SAMStatusResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ---- Unsaved-changes guard ----
  const [isDirty, setIsDirty] = useState(false);
  const hydratedRef = useRef(false);

  const markDirty = useCallback(() => {
    if (hydratedRef.current) setIsDirty(true);
  }, []);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // ---- Initialize from initialData ----
  useEffect(() => {
    if (!initialData) return;
    setLegalName(initialData.legal_name || '');
    setCompanyName(initialData.company_name || '');
    setDbaNames(initialData.dba_names || []);
    setLogoUrl(initialData.logo_url || '');
    setPrimaryColor(initialData.primary_color || '');
    setSecondaryColor(initialData.secondary_color || '');
    setUeiNumber(initialData.uei_number || '');
    setCageCode(initialData.cage_code || '');
    setSamStatus(initialData.sam_status || 'Active');
    setSamExpiration(initialData.sam_expiration || '');
    setPrimaryNaics((initialData as any).primary_naics || '');
    setPrimaryNaicsTitle((initialData as any).primary_naics_title || '');
    setBusinessSize(initialData.business_size);
    setSocioCerts(initialData.socioeconomic_certs || []);
    setYearFounded(initialData.year_founded || new Date().getFullYear());
    setEmployeeCount(initialData.employee_count || 1);
    setAnnualRevenue(initialData.annual_revenue || 0);
    setFiscalYearEnd(initialData.fiscal_year_end || '');
    setWebsite(initialData.website || '');
    if (initialData.headquarters_address) {
      setHeadquartersAddress({
        street: initialData.headquarters_address.street || '',
        suite: initialData.headquarters_address.suite || '',
        city: initialData.headquarters_address.city || '',
        state: initialData.headquarters_address.state || '',
        zip: initialData.headquarters_address.zip || '',
        country: initialData.headquarters_address.country || 'USA',
      });
    }
    if (initialData.proposal_poc) {
      setProposalPoc({
        name: initialData.proposal_poc.name || '',
        title: initialData.proposal_poc.title || '',
        email: initialData.proposal_poc.email || '',
        phone: initialData.proposal_poc.phone || '',
      });
    }
    if (initialData.contracts_poc) {
      setContractsPoc({
        name: initialData.contracts_poc.name || '',
        title: initialData.contracts_poc.title || '',
        email: initialData.contracts_poc.email || '',
        phone: initialData.contracts_poc.phone || '',
      });
    }
    if (initialData.authorized_signer) {
      setAuthorizedSigner({
        name: initialData.authorized_signer.name || '',
        title: initialData.authorized_signer.title || '',
        email: initialData.authorized_signer.email || '',
      });
    }
    setIsDirty(false);
    requestAnimationFrame(() => { hydratedRef.current = true; });
  }, [initialData]);

  // ---- DBA helpers ----
  const addDbaName = () => {
    if (dbaInput.trim()) {
      setDbaNames([...dbaNames, dbaInput.trim()]);
      setDbaInput('');
      markDirty();
    }
  };
  const removeDbaName = (idx: number) => {
    setDbaNames(dbaNames.filter((_, i) => i !== idx));
    markDirty();
  };

  // ---- Socioeconomic cert helpers ----
  const toggleSocioCert = (cert: string) => {
    setSocioCerts((prev) =>
      prev.includes(cert) ? prev.filter((c) => c !== cert) : [...prev, cert]
    );
    markDirty();
  };

  // ---- UEI blur validation + SAM check ----
  const handleUeiBlur = async () => {
    const result = validateUEI(ueiNumber);
    if (!result.valid) {
      setErrors((prev) => ({ ...prev, uei_number: result.error }));
      setSamStatusResult(null);
    } else {
      setErrors((prev) => ({ ...prev, uei_number: undefined }));
      const status = await checkSAMStatus(ueiNumber);
      setSamStatusResult(status);
    }
  };

  // ---- CAGE blur validation ----
  const handleCageBlur = () => {
    const result = validateCAGE(cageCode);
    if (!result.valid) {
      setErrors((prev) => ({ ...prev, cage_code: result.error }));
    } else {
      setErrors((prev) => ({ ...prev, cage_code: undefined }));
    }
  };

  // ---- NAICS blur validation ----
  const handleNaicsBlur = () => {
    if (!primaryNaics) return;
    const result = validateNAICS(primaryNaics);
    if (!result.valid) {
      setErrors((prev) => ({ ...prev, primary_naics: result.error }));
    } else {
      setErrors((prev) => ({ ...prev, primary_naics: undefined }));
    }
  };

  // ---- Client-side validation before submit ----
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    const ueiResult = validateUEI(ueiNumber);
    if (!ueiResult.valid) newErrors.uei_number = ueiResult.error;

    const cageResult = validateCAGE(cageCode);
    if (!cageResult.valid) newErrors.cage_code = cageResult.error;

    if (primaryNaics) {
      const naicsResult = validateNAICS(primaryNaics);
      if (!naicsResult.valid) newErrors.primary_naics = naicsResult.error;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ---- Save handler ----
  const handleSave = async () => {
    if (!validateForm()) return;

    setSaving(true);
    setSaveSuccess(false);
    setSaveError(null);

    try {
      const payload = {
        // Company Identity
        legal_name: legalName,
        company_name: companyName,
        dba_names: dbaNames,
        logo_url: logoUrl,
        primary_color: primaryColor || null,
        secondary_color: secondaryColor || null,

        // Government Registration
        uei_number: ueiNumber,
        cage_code: cageCode,
        sam_status: samStatus,
        sam_expiration: samExpiration || null,

        // Business Classification
        primary_naics: primaryNaics,
        primary_naics_title: primaryNaicsTitle,
        business_size: businessSize,
        socioeconomic_certs: socioCerts,

        // Company Details
        year_founded: yearFounded,
        employee_count: employeeCount,
        annual_revenue: annualRevenue,
        fiscal_year_end: fiscalYearEnd || null,
        website: website,
        headquarters_address: headquartersAddress,

        // Contacts
        proposal_poc: proposalPoc,
        contracts_poc: contractsPoc,
        authorized_signer: authorizedSigner,
      };

      const response = await doFetch('/api/company/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save Corporate Identity');
      }

      setSaveSuccess(true);
      setIsDirty(false);
      onSaved();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // ---- SAM status badge ----
  const renderSamBadge = () => {
    if (!samStatusResult) return null;
    const colorClass =
      samStatusResult.status === 'Active'
        ? 'bg-success/10 text-success border-success/30'
        : samStatusResult.status === 'Not Found'
        ? 'bg-destructive/10 text-destructive border-destructive/30'
        : 'bg-warning/10 text-warning-foreground border-warning/30';
    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorClass} ml-2`}
      >
        SAM: {samStatusResult.status}
        {samStatusResult.expiration && ` (exp. ${samStatusResult.expiration})`}
      </span>
    );
  };

  return (
    <div className="space-y-6" onChange={markDirty}>
      {/* Success / Error banners */}
      {saveSuccess && (
        <div className="bg-success/10 border border-success/20 rounded-lg p-4">
          <p className="text-success font-medium">Corporate Identity saved successfully.</p>
        </div>
      )}
      {saveError && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
          <p className="text-destructive">{saveError}</p>
        </div>
      )}

      {/* Company Identity */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-xl font-semibold text-foreground mb-4">Company Identity</h2>
        <div className="space-y-4">

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Legal Entity Name <span className="text-muted-foreground text-xs font-normal ml-1">(required)</span>
              </label>
              <input
                type="text"
                required
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                className="w-full px-4 py-2 border border-input bg-background rounded-md focus:ring-2 focus:ring-primary/50 focus:border-transparent"
                placeholder="Acme Federal Solutions, LLC"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Company Name / DBA <span className="text-muted-foreground text-xs font-normal ml-1">(required)</span>
              </label>
              <input
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-4 py-2 border border-input bg-background rounded-md focus:ring-2 focus:ring-primary/50 focus:border-transparent"
                placeholder="Acme Federal"
              />
            </div>
          </div>

          {/* Logo URL */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Company Logo URL</label>
            <input
              type="url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              className="w-full px-4 py-2 border border-input bg-background rounded-md focus:ring-2 focus:ring-primary/50 focus:border-transparent"
              placeholder="https://example.com/logo.png"
            />
            <p className="text-xs text-muted-foreground mt-1">URL to your company logo. Used on proposal cover pages and headers.</p>
            {logoUrl && (
              <div className="mt-2 p-2 bg-muted/50 rounded-md inline-block">
                <img
                  src={logoUrl}
                  alt="Logo preview"
                  className="max-h-16 max-w-48 object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}
          </div>

          {/* Brand Colors */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Brand Colors</label>
            <p className="text-xs text-muted-foreground mb-3">
              Used for proposal headings, table headers, callout boxes, and cover pages. Leave blank for default blue.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Primary Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={primaryColor ? (primaryColor.startsWith('#') ? primaryColor : `#${primaryColor}`) : '#2563eb'}
                    onChange={(e) => setPrimaryColor(e.target.value.replace('#', ''))}
                    className="w-10 h-10 rounded cursor-pointer border border-gray-300 p-0.5"
                  />
                  <input
                    type="text"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value.replace('#', ''))}
                    className="flex-1 px-4 py-2 border border-input bg-background rounded-md focus:ring-2 focus:ring-primary/50 focus:border-transparent font-mono"
                    placeholder="2563eb"
                    maxLength={6}
                  />
                  {primaryColor && (
                    <div
                      className="w-10 h-10 rounded border border-border"
                      style={{ backgroundColor: `#${primaryColor}` }}
                    />
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Secondary Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={secondaryColor ? (secondaryColor.startsWith('#') ? secondaryColor : `#${secondaryColor}`) : '#1e40af'}
                    onChange={(e) => setSecondaryColor(e.target.value.replace('#', ''))}
                    className="w-10 h-10 rounded cursor-pointer border border-gray-300 p-0.5"
                  />
                  <input
                    type="text"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value.replace('#', ''))}
                    className="flex-1 px-4 py-2 border border-input bg-background rounded-md focus:ring-2 focus:ring-primary/50 focus:border-transparent font-mono"
                    placeholder="1e40af"
                    maxLength={6}
                  />
                  {secondaryColor && (
                    <div
                      className="w-10 h-10 rounded border border-border"
                      style={{ backgroundColor: `#${secondaryColor}` }}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* DBA Names */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">DBA Names (Doing Business As)</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={dbaInput}
                onChange={(e) => setDbaInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addDbaName();
                  }
                }}
                className="flex-1 px-4 py-2 border border-input bg-background rounded-md focus:ring-2 focus:ring-primary/50"
                placeholder="Enter a DBA name"
              />
              <button
                type="button"
                onClick={addDbaName}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {dbaNames.map((name, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 bg-muted text-foreground rounded-full text-sm flex items-center gap-2"
                >
                  {name}
                  <button
                    type="button"
                    onClick={() => removeDbaName(idx)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Government Registration */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-xl font-semibold text-foreground mb-4">Government Registration</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* UEI */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              UEI Number <span className="text-muted-foreground text-xs font-normal ml-1">(required)</span>
              {renderSamBadge()}
            </label>
            <input
              type="text"
              required
              maxLength={12}
              value={ueiNumber}
              onChange={(e) => setUeiNumber(e.target.value.toUpperCase())}
              onBlur={handleUeiBlur}
              className={`w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.uei_number ? 'border-destructive bg-destructive/10' : 'border-input bg-background'
              }`}
              placeholder="A1B2C3D4E5F6"
            />
            <p className="text-xs text-muted-foreground mt-1">12 alphanumeric characters — replaced DUNS in 2022. No letters O or I.</p>
            {errors.uei_number && (
              <p className="text-xs text-destructive mt-1">{errors.uei_number}</p>
            )}
          </div>

          {/* CAGE */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              CAGE Code <span className="text-muted-foreground text-xs font-normal ml-1">(required)</span>
            </label>
            <input
              type="text"
              required
              maxLength={5}
              value={cageCode}
              onChange={(e) => setCageCode(e.target.value.toUpperCase())}
              onBlur={handleCageBlur}
              className={`w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.cage_code ? 'border-destructive bg-destructive/10' : 'border-input bg-background'
              }`}
              placeholder="1ABC2"
            />
            <p className="text-xs text-muted-foreground mt-1">5 alphanumeric characters</p>
            {errors.cage_code && (
              <p className="text-xs text-destructive mt-1">{errors.cage_code}</p>
            )}
          </div>

          {/* SAM Status */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">SAM Status</label>
            <select
              value={samStatus}
              onChange={(e) => setSamStatus(e.target.value as CompanyProfile['sam_status'])}
              className="w-full px-4 py-2 border border-input bg-background rounded-md focus:ring-2 focus:ring-primary/50 focus:border-transparent"
            >
              <option value="Active">Active</option>
              <option value="Pending">Pending</option>
              <option value="Expired">Expired</option>
              <option value="Not Registered">Not Registered</option>
            </select>
          </div>

          {/* SAM Expiration */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">SAM Expiration Date</label>
            <input
              type="date"
              value={samExpiration}
              onChange={(e) => setSamExpiration(e.target.value)}
              className="w-full px-4 py-2 border border-input bg-background rounded-md focus:ring-2 focus:ring-primary/50 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Business Classification */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-xl font-semibold text-foreground mb-4">Business Classification</h2>
        <div className="space-y-4">

          {/* Primary NAICS */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Primary NAICS Code <span className="text-muted-foreground text-xs font-normal ml-1">(required)</span>
            </label>
            <div className="flex gap-3">
              <div className="w-36">
                <input
                  type="text"
                  maxLength={6}
                  value={primaryNaics}
                  onChange={(e) => setPrimaryNaics(e.target.value)}
                  onBlur={handleNaicsBlur}
                  className={`w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.primary_naics ? 'border-destructive bg-destructive/10' : 'border-input bg-background'
                  }`}
                  placeholder="541511"
                />
              </div>
              <div className="flex-1">
                <input
                  type="text"
                  value={primaryNaicsTitle}
                  onChange={(e) => setPrimaryNaicsTitle(e.target.value)}
                  className="w-full px-4 py-2 border border-input bg-background rounded-md focus:ring-2 focus:ring-primary/50 focus:border-transparent"
                  placeholder="Custom Computer Programming Services"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Primary 6-digit NAICS code. Additional NAICS codes can be added in Vehicles & Certifications.</p>
            {errors.primary_naics && (
              <p className="text-xs text-destructive mt-1">{errors.primary_naics}</p>
            )}
          </div>

          {/* Business Size */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Business Size</label>
            <select
              value={businessSize || ''}
              onChange={(e) =>
                setBusinessSize((e.target.value as CompanyProfile['business_size']) || undefined)
              }
              className="w-full px-4 py-2 border border-input bg-background rounded-md focus:ring-2 focus:ring-primary/50 focus:border-transparent"
            >
              <option value="">Select size...</option>
              <option value="Small">Small</option>
              <option value="Other Than Small">Other Than Small</option>
              <option value="Large">Large</option>
            </select>
          </div>

          {/* Socioeconomic Certifications */}
          <div>
            <            label className="block text-sm font-medium text-foreground mb-2">
              Socioeconomic Certifications
            </label>
            <p className="text-xs text-muted-foreground mb-3">
              Select all designations that apply. These drive set-aside eligibility filtering.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {SOCIOECONOMIC_OPTIONS.map((cert) => {
                const isChecked = socioCerts.includes(cert);
                return (
                  <label
                    key={cert}
                    className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${
                      isChecked
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-card text-foreground hover:bg-muted'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={isChecked}
                      onChange={() => toggleSocioCert(cert)}
                    />
                    <span
                      className={`w-4 h-4 flex-shrink-0 rounded border-2 flex items-center justify-center ${
                        isChecked ? 'border-primary bg-primary' : 'border-border'
                      }`}
                    >
                      {isChecked && (
                        <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 12 12">
                          <path d="M10.28 2.28L4 8.56 1.72 6.28a1 1 0 00-1.42 1.42l3 3a1 1 0 001.42 0l7-7a1 1 0 10-1.42-1.42z" />
                        </svg>
                      )}
                    </span>
                    <span className="text-sm font-medium">{cert}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Company Details */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-xl font-semibold text-foreground mb-4">Company Details</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Year Founded <span className="text-muted-foreground text-xs font-normal ml-1">(required)</span>
              </label>
              <input
                type="number"
                required
                min={1900}
                max={new Date().getFullYear()}
                value={yearFounded}
                onChange={(e) => setYearFounded(parseInt(e.target.value, 10))}
                className="w-full px-4 py-2 border border-input bg-background rounded-md focus:ring-2 focus:ring-primary/50 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Employee Count <span className="text-muted-foreground text-xs font-normal ml-1">(required)</span>
              </label>
              <input
                type="number"
                required
                min={1}
                value={employeeCount}
                onChange={(e) => setEmployeeCount(parseInt(e.target.value, 10))}
                className="w-full px-4 py-2 border border-input bg-background rounded-md focus:ring-2 focus:ring-primary/50 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Annual Revenue</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={annualRevenue}
                onChange={(e) => setAnnualRevenue(parseFloat(e.target.value))}
                className="w-full px-4 py-2 border border-input bg-background rounded-md focus:ring-2 focus:ring-primary/50 focus:border-transparent"
                placeholder="Most recent fiscal year"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Fiscal Year End</label>
              <input
                type="text"
                value={fiscalYearEnd}
                onChange={(e) => setFiscalYearEnd(e.target.value)}
                className="w-full px-4 py-2 border border-input bg-background rounded-md focus:ring-2 focus:ring-primary/50 focus:border-transparent"
                placeholder="December 31"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Website</label>
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="w-full px-4 py-2 border border-input bg-background rounded-md focus:ring-2 focus:ring-primary/50 focus:border-transparent"
              placeholder="https://www.acmefederal.com"
            />
          </div>

          {/* Headquarters Address */}
          <div>
            <h3 className="font-medium text-foreground mb-3">Headquarters Address</h3>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Street Address"
                value={headquartersAddress.street}
                onChange={(e) =>
                  setHeadquartersAddress({ ...headquartersAddress, street: e.target.value })
                }
                className="w-full px-4 py-2 border border-input bg-background rounded-md focus:ring-2 focus:ring-primary/50 focus:border-transparent"
              />
              <input
                type="text"
                placeholder="Suite / Unit"
                value={headquartersAddress.suite}
                onChange={(e) =>
                  setHeadquartersAddress({ ...headquartersAddress, suite: e.target.value })
                }
                className="w-full px-4 py-2 border border-input bg-background rounded-md focus:ring-2 focus:ring-primary/50 focus:border-transparent"
              />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <input
                  type="text"
                  placeholder="City"
                  value={headquartersAddress.city}
                  onChange={(e) =>
                    setHeadquartersAddress({ ...headquartersAddress, city: e.target.value })
                  }
                  className="col-span-2 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <input
                  type="text"
                  placeholder="State"
                  maxLength={2}
                  value={headquartersAddress.state}
                  onChange={(e) =>
                    setHeadquartersAddress({
                      ...headquartersAddress,
                      state: e.target.value.toUpperCase(),
                    })
                  }
                  className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <input
                  type="text"
                  placeholder="ZIP"
                  value={headquartersAddress.zip}
                  onChange={(e) =>
                    setHeadquartersAddress({ ...headquartersAddress, zip: e.target.value })
                  }
                  className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Primary Contacts */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-xl font-semibold text-foreground mb-4">Primary Contacts</h2>

        {/* Proposal POC */}
        <div className="mb-6">
          <h3 className="font-medium text-foreground mb-3">Proposal Point of Contact</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Name"
              value={proposalPoc.name}
              onChange={(e) => setProposalPoc({ ...proposalPoc, name: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <input
              type="text"
              placeholder="Title"
              value={proposalPoc.title}
              onChange={(e) => setProposalPoc({ ...proposalPoc, title: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <input
              type="email"
              placeholder="Email"
              value={proposalPoc.email}
              onChange={(e) => setProposalPoc({ ...proposalPoc, email: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <input
              type="tel"
              placeholder="Phone"
              value={proposalPoc.phone}
              onChange={(e) => setProposalPoc({ ...proposalPoc, phone: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Contracts POC */}
        <div className="mb-6">
          <h3 className="font-medium text-foreground mb-3">Contracts Point of Contact (Optional)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Name"
              value={contractsPoc.name}
              onChange={(e) => setContractsPoc({ ...contractsPoc, name: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <input
              type="text"
              placeholder="Title"
              value={contractsPoc.title}
              onChange={(e) => setContractsPoc({ ...contractsPoc, title: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <input
              type="email"
              placeholder="Email"
              value={contractsPoc.email}
              onChange={(e) => setContractsPoc({ ...contractsPoc, email: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <input
              type="tel"
              placeholder="Phone"
              value={contractsPoc.phone}
              onChange={(e) => setContractsPoc({ ...contractsPoc, phone: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Authorized Signer */}
        <div>
          <h3 className="font-medium text-foreground mb-1">Authorized Signer</h3>
          <p className="text-sm text-muted-foreground mb-3">Person authorized to bind company to contracts</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="text"
              placeholder="Name"
              value={authorizedSigner.name}
              onChange={(e) =>
                setAuthorizedSigner({ ...authorizedSigner, name: e.target.value })
              }
              className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <input
              type="text"
              placeholder="Title"
              value={authorizedSigner.title}
              onChange={(e) =>
                setAuthorizedSigner({ ...authorizedSigner, title: e.target.value })
              }
              className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <input
              type="email"
              placeholder="Email"
              value={authorizedSigner.email}
              onChange={(e) =>
                setAuthorizedSigner({ ...authorizedSigner, email: e.target.value })
              }
              className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Save button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="bg-primary text-primary-foreground px-8 py-3 rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
        >
          {saving ? 'Saving...' : 'Save Corporate Identity'}
        </button>
      </div>
    </div>
  );
}
