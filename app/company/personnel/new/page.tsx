'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFetchWithCompany } from '@/lib/hooks/useFetchWithCompany';

export default function NewPersonnel() {
  const router = useRouter();
  const { fetchWithCompany } = useFetchWithCompany();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    status: 'Active' as const,
    full_name: '',
    email: '',
    phone: '',
    employment_type: 'W2 Employee' as const,
    employer_company: '',
    availability: 'Immediately Available',
    current_assignment: '',
    geographic_location: '',
    relocation_willing: false,
    remote_capable: true,
    clearance_level: 'None',
    clearance_status: 'Active',
    investigation_date: '',
    sponsoring_agency: '',
    education: [{
      degree_level: 'Bachelor',
      field_of_study: '',
      institution: '',
      graduation_year: new Date().getFullYear(),
    }],
    certifications: [] as Array<{
      name: string;
      issuing_body: string;
      date_obtained: string;
      expiration_date: string;
      certification_number: string;
    }>,
    total_experience_years: 0,
    federal_experience_years: 0,
    relevant_experience_years: 0,
    work_history: [{
      job_title: '',
      employer: '',
      start_date: '',
      end_date: 'Present',
      description: '',
      client_agency: '',
      contract_reference: '',
      relevant_skills: [] as string[],
    }],
    proposed_roles: [] as Array<{
      role_title: string;
      is_key_personnel: boolean;
      labor_category: string;
      bill_rate: number;
      cost_rate: number;
      summary_for_role: string;
    }>,
    resume_url: '',
    resume_last_updated: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetchWithCompany('/api/company/personnel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to add person');
      }

      router.push('/company/personnel');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const addEducation = () => {
    setFormData({
      ...formData,
      education: [...formData.education, {
        degree_level: 'Bachelor',
        field_of_study: '',
        institution: '',
        graduation_year: new Date().getFullYear(),
      }]
    });
  };

  const removeEducation = (index: number) => {
    setFormData({
      ...formData,
      education: formData.education.filter((_, i) => i !== index)
    });
  };

  const updateEducation = (index: number, field: string, value: any) => {
    const updated = [...formData.education];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, education: updated });
  };

  const addCertification = () => {
    setFormData({
      ...formData,
      certifications: [...formData.certifications, {
        name: '',
        issuing_body: '',
        date_obtained: '',
        expiration_date: '',
        certification_number: '',
      }]
    });
  };

  const removeCertification = (index: number) => {
    setFormData({
      ...formData,
      certifications: formData.certifications.filter((_, i) => i !== index)
    });
  };

  const updateCertification = (index: number, field: string, value: string) => {
    const updated = [...formData.certifications];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, certifications: updated });
  };

  const addWorkHistory = () => {
    setFormData({
      ...formData,
      work_history: [...formData.work_history, {
        job_title: '',
        employer: '',
        start_date: '',
        end_date: 'Present',
        description: '',
        client_agency: '',
        contract_reference: '',
        relevant_skills: [],
      }]
    });
  };

  const removeWorkHistory = (index: number) => {
    setFormData({
      ...formData,
      work_history: formData.work_history.filter((_, i) => i !== index)
    });
  };

  const updateWorkHistory = (index: number, field: string, value: any) => {
    const updated = [...formData.work_history];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, work_history: updated });
  };

  const addProposedRole = () => {
    setFormData({
      ...formData,
      proposed_roles: [...formData.proposed_roles, {
        role_title: '',
        is_key_personnel: false,
        labor_category: '',
        bill_rate: 0,
        cost_rate: 0,
        summary_for_role: '',
      }]
    });
  };

  const removeProposedRole = (index: number) => {
    setFormData({
      ...formData,
      proposed_roles: formData.proposed_roles.filter((_, i) => i !== index)
    });
  };

  const updateProposedRole = (index: number, field: string, value: any) => {
    const updated = [...formData.proposed_roles];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, proposed_roles: updated });
  };

  return (
    <main className="min-h-screen p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <a href="/company/personnel" className="text-blue-600 hover:underline mb-4 inline-block">
          ← Back to Personnel
        </a>
        <h1 className="text-4xl font-bold mb-2">Add Personnel</h1>
        <p className="text-gray-600">Step 5 of 6 - Team members (10-20 minutes per person)</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Information */}
        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-2xl font-semibold mb-4">Basic Information</h2>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status *
                </label>
                <select
                  required
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Active">Active</option>
                  <option value="Available">Available</option>
                  <option value="Committed">Committed</option>
                  <option value="Pending">Pending</option>
                  <option value="Former">Former</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Employment Type *
                </label>
                <select
                  required
                  value={formData.employment_type}
                  onChange={(e) => setFormData({ ...formData, employment_type: e.target.value as any })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  <option value="W2 Employee">W2 Employee</option>
                  <option value="1099 Contractor">1099 Contractor</option>
                  <option value="Subcontractor">Subcontractor</option>
                  <option value="Teaming Partner Staff">Teaming Partner Staff</option>
                  <option value="To Be Hired">To Be Hired</option>
                </select>
              </div>

              {(formData.employment_type === 'Subcontractor' || formData.employment_type === 'Teaming Partner Staff') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Employer Company
                  </label>
                  <input
                    type="text"
                    value={formData.employer_company}
                    onChange={(e) => setFormData({ ...formData, employer_company: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Availability & Location */}
        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-2xl font-semibold mb-4">Availability & Location</h2>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Availability *
                </label>
                <input
                  type="text"
                  required
                  value={formData.availability}
                  onChange={(e) => setFormData({ ...formData, availability: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="Immediately Available, 2 Weeks Notice, etc."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Geographic Location *
                </label>
                <input
                  type="text"
                  required
                  value={formData.geographic_location}
                  onChange={(e) => setFormData({ ...formData, geographic_location: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="Washington, DC Metro Area"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Current Assignment
              </label>
              <input
                type="text"
                value={formData.current_assignment}
                onChange={(e) => setFormData({ ...formData, current_assignment: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-6">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.remote_capable}
                  onChange={(e) => setFormData({ ...formData, remote_capable: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-900">Remote Capable</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.relocation_willing}
                  onChange={(e) => setFormData({ ...formData, relocation_willing: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-900">Willing to Relocate</span>
              </label>
            </div>
          </div>
        </div>

        {/* Clearance */}
        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-2xl font-semibold mb-4">Security Clearance</h2>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Clearance Level
              </label>
              <select
                value={formData.clearance_level}
                onChange={(e) => setFormData({ ...formData, clearance_level: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="None">None</option>
                <option value="Public Trust">Public Trust</option>
                <option value="Secret">Secret</option>
                <option value="Top Secret">Top Secret</option>
                <option value="TS/SCI">TS/SCI</option>
              </select>
            </div>

            {formData.clearance_level !== 'None' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Clearance Status
                  </label>
                  <select
                    value={formData.clearance_status}
                    onChange={(e) => setFormData({ ...formData, clearance_status: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Active">Active</option>
                    <option value="Current">Current</option>
                    <option value="Inactive (within 2 years)">Inactive (within 2 years)</option>
                    <option value="Expired">Expired</option>
                    <option value="In Process">In Process</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Investigation Date
                  </label>
                  <input
                    type="date"
                    value={formData.investigation_date}
                    onChange={(e) => setFormData({ ...formData, investigation_date: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sponsoring Agency
                  </label>
                  <input
                    type="text"
                    value={formData.sponsoring_agency}
                    onChange={(e) => setFormData({ ...formData, sponsoring_agency: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Education */}
        <div className="bg-white shadow-md rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold">Education</h2>
            <button
              type="button"
              onClick={addEducation}
              className="text-blue-600 hover:underline text-sm"
            >
              + Add Degree
            </button>
          </div>
          
          <div className="space-y-4">
            {formData.education.map((edu, idx) => (
              <div key={idx} className="p-4 border border-gray-200 rounded-md">
                <div className="flex justify-between items-start mb-3">
                  <h4 className="font-medium">Degree {idx + 1}</h4>
                  {formData.education.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeEducation(idx)}
                      className="text-red-600 hover:underline text-sm"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Degree Level *
                    </label>
                    <select
                      required
                      value={edu.degree_level}
                      onChange={(e) => updateEducation(idx, 'degree_level', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="High School">High School</option>
                      <option value="Associate">Associate</option>
                      <option value="Bachelor">Bachelor</option>
                      <option value="Master">Master</option>
                      <option value="Doctorate">Doctorate</option>
                      <option value="Professional (JD, MD)">Professional (JD, MD)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Field of Study *
                    </label>
                    <input
                      type="text"
                      required
                      value={edu.field_of_study}
                      onChange={(e) => updateEducation(idx, 'field_of_study', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      placeholder="Computer Science"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Institution *
                    </label>
                    <input
                      type="text"
                      required
                      value={edu.institution}
                      onChange={(e) => updateEducation(idx, 'institution', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      placeholder="University of Maryland"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Graduation Year *
                    </label>
                    <input
                      type="number"
                      required
                      min="1950"
                      max={new Date().getFullYear() + 10}
                      value={edu.graduation_year}
                      onChange={(e) => updateEducation(idx, 'graduation_year', parseInt(e.target.value))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Experience Years */}
        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-2xl font-semibold mb-4">Experience</h2>
          
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Total Experience (years) *
              </label>
              <input
                type="number"
                required
                min="0"
                value={formData.total_experience_years}
                onChange={(e) => setFormData({ ...formData, total_experience_years: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Federal Experience (years)
              </label>
              <input
                type="number"
                min="0"
                value={formData.federal_experience_years}
                onChange={(e) => setFormData({ ...formData, federal_experience_years: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Relevant Experience (years)
              </label>
              <input
                type="number"
                min="0"
                value={formData.relevant_experience_years}
                onChange={(e) => setFormData({ ...formData, relevant_experience_years: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Work History (simplified for space) */}
        <div className="bg-white shadow-md rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold">Work History</h2>
            <button
              type="button"
              onClick={addWorkHistory}
              className="text-blue-600 hover:underline text-sm"
            >
              + Add Position
            </button>
          </div>
          
          <p className="text-sm text-gray-600 mb-4">Add at least one work history entry</p>

          <div className="space-y-4">
            {formData.work_history.map((work, idx) => (
              <div key={idx} className="p-4 border border-gray-200 rounded-md">
                <div className="flex justify-between items-start mb-3">
                  <h4 className="font-medium">Position {idx + 1}</h4>
                  {formData.work_history.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeWorkHistory(idx)}
                      className="text-red-600 hover:underline text-sm"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <input
                      type="text"
                      required
                      placeholder="Job Title *"
                      value={work.job_title}
                      onChange={(e) => updateWorkHistory(idx, 'job_title', e.target.value)}
                      className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      required
                      placeholder="Employer *"
                      value={work.employer}
                      onChange={(e) => updateWorkHistory(idx, 'employer', e.target.value)}
                      className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <input
                      type="text"
                      required
                      placeholder="Start Date (MM/YYYY) *"
                      value={work.start_date}
                      onChange={(e) => updateWorkHistory(idx, 'start_date', e.target.value)}
                      className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      required
                      placeholder="End Date (MM/YYYY or Present) *"
                      value={work.end_date}
                      onChange={(e) => updateWorkHistory(idx, 'end_date', e.target.value)}
                      className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <textarea
                    required
                    maxLength={1000}
                    placeholder="Description of responsibilities and achievements *"
                    value={work.description}
                    onChange={(e) => updateWorkHistory(idx, 'description', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    rows={3}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-between items-center">
          <button
            type="button"
            onClick={() => router.push('/company/personnel')}
            className="px-6 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="bg-blue-600 text-white px-8 py-3 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold"
          >
            {saving ? 'Saving...' : 'Add Person'}
          </button>
        </div>
      </form>
    </main>
  );
}
