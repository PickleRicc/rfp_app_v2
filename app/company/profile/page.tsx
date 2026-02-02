'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCompany } from '@/lib/context/CompanyContext';
import { useFetchWithCompany } from '@/lib/hooks/useFetchWithCompany';

export default function EditCompanyProfile() {
  const router = useRouter();
  const { selectedCompany, selectedCompanyId } = useCompany();
  const { fetchWithCompany } = useFetchWithCompany();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    // Identity
    company_name: '',
    legal_name: '',
    dba_names: [] as string[],

    // Registration
    cage_code: '',
    uei_number: '',
    sam_status: 'Active' as const,
    sam_expiration: '',

    // Company details
    year_founded: new Date().getFullYear(),
    headquarters_address: {
      street: '',
      suite: '',
      city: '',
      state: '',
      zip: '',
      country: 'USA',
    },
    additional_offices: [] as any[],
    website: '',
    employee_count: 1,
    annual_revenue: 0,
    fiscal_year_end: '',

    // Contacts
    proposal_poc: {
      name: '',
      title: '',
      email: '',
      phone: '',
    },
    contracts_poc: {
      name: '',
      title: '',
      email: '',
      phone: '',
    },
    authorized_signer: {
      name: '',
      title: '',
      email: '',
    },

    // Description
    elevator_pitch: '',
    full_description: '',
    mission_statement: '',
    vision_statement: '',
    core_values: [] as string[],
  });

  const [dbaInput, setDbaInput] = useState('');
  const [valueInput, setValueInput] = useState('');

  useEffect(() => {
    if (selectedCompanyId) {
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, [selectedCompanyId]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await fetchWithCompany('/api/company/profile');
      const data = await response.json();
      
      if (data.profile) {
        setFormData({
          ...data.profile,
          annual_revenue: data.profile.annual_revenue || 0,
          fiscal_year_end: data.profile.fiscal_year_end || '',
          contracts_poc: data.profile.contracts_poc || { name: '', title: '', email: '', phone: '' },
          full_description: data.profile.full_description || '',
          mission_statement: data.profile.mission_statement || '',
          vision_statement: data.profile.vision_statement || '',
        });
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const addDbaName = () => {
    if (dbaInput.trim()) {
      setFormData({
        ...formData,
        dba_names: [...formData.dba_names, dbaInput.trim()]
      });
      setDbaInput('');
    }
  };

  const removeDbaName = (index: number) => {
    setFormData({
      ...formData,
      dba_names: formData.dba_names.filter((_, i) => i !== index)
    });
  };

  const addCoreValue = () => {
    if (valueInput.trim()) {
      setFormData({
        ...formData,
        core_values: [...formData.core_values, valueInput.trim()]
      });
      setValueInput('');
    }
  };

  const removeCoreValue = (index: number) => {
    setFormData({
      ...formData,
      core_values: formData.core_values.filter((_, i) => i !== index)
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetchWithCompany('/api/company/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to update company profile');
      }

      router.push('/company');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen p-8 max-w-4xl mx-auto">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </main>
    );
  }

  if (!selectedCompany) {
    return (
      <main className="min-h-screen p-8 max-w-4xl mx-auto">
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
    <main className="min-h-screen p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <a href="/company" className="text-blue-600 hover:underline mb-4 inline-block">
          ← Back to Dashboard
        </a>
        <h1 className="text-4xl font-bold mb-2">Edit Company Profile</h1>
        <p className="text-gray-600">Update your company information</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Company Identity */}
        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-2xl font-semibold mb-4">Company Identity</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Company Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Acme Federal Solutions, LLC"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Legal Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.legal_name}
                onChange={(e) => setFormData({ ...formData, legal_name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="If different from company name"
              />
            </div>

            {/* DBA Names */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                DBA Names (Doing Business As)
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={dbaInput}
                  onChange={(e) => setDbaInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addDbaName())}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter a DBA name"
                />
                <button
                  type="button"
                  onClick={addDbaName}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.dba_names.map((name, idx) => (
                  <span key={idx} className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm flex items-center gap-2">
                    {name}
                    <button type="button" onClick={() => removeDbaName(idx)} className="text-gray-600 hover:text-gray-800">×</button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Registration */}
        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-2xl font-semibold mb-4">Registration & SAM</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                CAGE Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={5}
                value={formData.cage_code}
                onChange={(e) => setFormData({ ...formData, cage_code: e.target.value.toUpperCase() })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="1ABC2"
              />
              <p className="text-xs text-gray-500 mt-1">5 alphanumeric characters</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                UEI Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={12}
                value={formData.uei_number}
                onChange={(e) => setFormData({ ...formData, uei_number: e.target.value.toUpperCase() })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="ZXCVBNM12345"
              />
              <p className="text-xs text-gray-500 mt-1">12 characters (replaced DUNS in 2022)</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                SAM Status <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.sam_status}
                onChange={(e) => setFormData({ ...formData, sam_status: e.target.value as any })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="Active">Active</option>
                <option value="Pending">Pending</option>
                <option value="Expired">Expired</option>
                <option value="Not Registered">Not Registered</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                SAM Expiration Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.sam_expiration}
                onChange={(e) => setFormData({ ...formData, sam_expiration: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Company Details */}
        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-2xl font-semibold mb-4">Company Details</h2>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Year Founded <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="1900"
                  max={new Date().getFullYear()}
                  value={formData.year_founded}
                  onChange={(e) => setFormData({ ...formData, year_founded: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Employee Count <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={formData.employee_count}
                  onChange={(e) => setFormData({ ...formData, employee_count: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Annual Revenue
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.annual_revenue}
                  onChange={(e) => setFormData({ ...formData, annual_revenue: parseFloat(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Most recent fiscal year"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fiscal Year End
                </label>
                <input
                  type="text"
                  value={formData.fiscal_year_end}
                  onChange={(e) => setFormData({ ...formData, fiscal_year_end: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="December 31"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Website</label>
              <input
                type="url"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="https://www.acmefederal.com"
              />
            </div>

            {/* Headquarters Address */}
            <div>
              <h3 className="font-semibold text-gray-800 mb-3">Headquarters Address</h3>
              <div className="space-y-3">
                <input
                  type="text"
                  required
                  placeholder="Street Address *"
                  value={formData.headquarters_address.street}
                  onChange={(e) => setFormData({
                    ...formData,
                    headquarters_address: { ...formData.headquarters_address, street: e.target.value }
                  })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <input
                  type="text"
                  placeholder="Suite/Unit"
                  value={formData.headquarters_address.suite}
                  onChange={(e) => setFormData({
                    ...formData,
                    headquarters_address: { ...formData.headquarters_address, suite: e.target.value }
                  })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <input
                    type="text"
                    required
                    placeholder="City *"
                    value={formData.headquarters_address.city}
                    onChange={(e) => setFormData({
                      ...formData,
                      headquarters_address: { ...formData.headquarters_address, city: e.target.value }
                    })}
                    className="col-span-2 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <input
                    type="text"
                    required
                    placeholder="State *"
                    maxLength={2}
                    value={formData.headquarters_address.state}
                    onChange={(e) => setFormData({
                      ...formData,
                      headquarters_address: { ...formData.headquarters_address, state: e.target.value.toUpperCase() }
                    })}
                    className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <input
                    type="text"
                    required
                    placeholder="ZIP *"
                    value={formData.headquarters_address.zip}
                    onChange={(e) => setFormData({
                      ...formData,
                      headquarters_address: { ...formData.headquarters_address, zip: e.target.value }
                    })}
                    className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Contacts */}
        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-2xl font-semibold mb-4">Primary Contacts</h2>

          {/* Proposal POC */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-800 mb-3">Proposal Point of Contact</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                required
                placeholder="Name *"
                value={formData.proposal_poc.name}
                onChange={(e) => setFormData({
                  ...formData,
                  proposal_poc: { ...formData.proposal_poc, name: e.target.value }
                })}
                className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="text"
                required
                placeholder="Title *"
                value={formData.proposal_poc.title}
                onChange={(e) => setFormData({
                  ...formData,
                  proposal_poc: { ...formData.proposal_poc, title: e.target.value }
                })}
                className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="email"
                required
                placeholder="Email *"
                value={formData.proposal_poc.email}
                onChange={(e) => setFormData({
                  ...formData,
                  proposal_poc: { ...formData.proposal_poc, email: e.target.value }
                })}
                className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="tel"
                required
                placeholder="Phone *"
                value={formData.proposal_poc.phone}
                onChange={(e) => setFormData({
                  ...formData,
                  proposal_poc: { ...formData.proposal_poc, phone: e.target.value }
                })}
                className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Contracts POC */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-800 mb-3">Contracts Point of Contact (Optional)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Name"
                value={formData.contracts_poc.name}
                onChange={(e) => setFormData({
                  ...formData,
                  contracts_poc: { ...formData.contracts_poc, name: e.target.value }
                })}
                className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="text"
                placeholder="Title"
                value={formData.contracts_poc.title}
                onChange={(e) => setFormData({
                  ...formData,
                  contracts_poc: { ...formData.contracts_poc, title: e.target.value }
                })}
                className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="email"
                placeholder="Email"
                value={formData.contracts_poc.email}
                onChange={(e) => setFormData({
                  ...formData,
                  contracts_poc: { ...formData.contracts_poc, email: e.target.value }
                })}
                className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="tel"
                placeholder="Phone"
                value={formData.contracts_poc.phone}
                onChange={(e) => setFormData({
                  ...formData,
                  contracts_poc: { ...formData.contracts_poc, phone: e.target.value }
                })}
                className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Authorized Signer */}
          <div>
            <h3 className="font-semibold text-gray-800 mb-3">Authorized Signer</h3>
            <p className="text-sm text-gray-600 mb-3">Person authorized to bind company to contracts</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input
                type="text"
                required
                placeholder="Name *"
                value={formData.authorized_signer.name}
                onChange={(e) => setFormData({
                  ...formData,
                  authorized_signer: { ...formData.authorized_signer, name: e.target.value }
                })}
                className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="text"
                required
                placeholder="Title *"
                value={formData.authorized_signer.title}
                onChange={(e) => setFormData({
                  ...formData,
                  authorized_signer: { ...formData.authorized_signer, title: e.target.value }
                })}
                className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="email"
                required
                placeholder="Email *"
                value={formData.authorized_signer.email}
                onChange={(e) => setFormData({
                  ...formData,
                  authorized_signer: { ...formData.authorized_signer, email: e.target.value }
                })}
                className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Descriptions */}
        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-2xl font-semibold mb-4">Company Descriptions</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Elevator Pitch <span className="text-red-500">*</span>
              </label>
              <p className="text-sm text-gray-600 mb-2">
                Describe your company in 2-3 sentences (max 500 characters)
              </p>
              <textarea
                required
                maxLength={500}
                rows={4}
                value={formData.elevator_pitch}
                onChange={(e) => setFormData({ ...formData, elevator_pitch: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Acme Federal Solutions is a veteran-owned IT services firm specializing in enterprise program management and agile transformation for federal agencies..."
              />
              <p className="text-xs text-gray-500 mt-1">
                {formData.elevator_pitch.length} / 500 characters
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Description
              </label>
              <p className="text-sm text-gray-600 mb-2">
                Detailed company overview (max 2000 characters)
              </p>
              <textarea
                maxLength={2000}
                rows={6}
                value={formData.full_description}
                onChange={(e) => setFormData({ ...formData, full_description: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                {formData.full_description.length} / 2000 characters
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mission Statement
              </label>
              <textarea
                maxLength={300}
                rows={2}
                value={formData.mission_statement}
                onChange={(e) => setFormData({ ...formData, mission_statement: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                {formData.mission_statement.length} / 300 characters
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Vision Statement
              </label>
              <textarea
                maxLength={300}
                rows={2}
                value={formData.vision_statement}
                onChange={(e) => setFormData({ ...formData, vision_statement: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                {formData.vision_statement.length} / 300 characters
              </p>
            </div>

            {/* Core Values */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Core Values
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={valueInput}
                  onChange={(e) => setValueInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addCoreValue())}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Integrity, Excellence, Innovation"
                />
                <button
                  type="button"
                  onClick={addCoreValue}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.core_values.map((value, idx) => (
                  <span key={idx} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-2">
                    {value}
                    <button type="button" onClick={() => removeCoreValue(idx)} className="text-blue-600 hover:text-blue-800">×</button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-between items-center">
          <button
            type="button"
            onClick={() => router.push('/company')}
            className="px-6 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="bg-blue-600 text-white px-8 py-3 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </main>
  );
}
