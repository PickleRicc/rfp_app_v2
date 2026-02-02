'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NewCompanyProfile() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    // Identity
    company_name: '',
    legal_name: '',

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
    website: '',
    employee_count: 1,

    // Contacts
    proposal_poc: {
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
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/company/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to create company profile');
      }

      const data = await response.json();
      router.push('/company');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <a href="/company" className="text-blue-600 hover:underline mb-4 inline-block">
          ← Back to Dashboard
        </a>
        <h1 className="text-4xl font-bold mb-2">Company Basics</h1>
        <p className="text-gray-600">Step 1 of 6 - Essential information (5-10 minutes)</p>
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

        {/* Elevator Pitch */}
        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-2xl font-semibold mb-4">Company Description</h2>

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
            {saving ? 'Saving...' : 'Save Company Profile'}
          </button>
        </div>
      </form>
    </main>
  );
}
