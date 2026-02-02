'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NewPastPerformance() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    // Identification
    contract_nickname: '',

    // Contract details
    contract_name: '',
    contract_number: '',
    task_order_number: '',
    client_agency: '',
    client_office: '',

    // Financials & period
    contract_type: 'FFP' as const,
    contract_value: 0,
    annual_value: 0,
    start_date: '',
    end_date: '',
    base_period: '',
    option_periods: 0,

    // Role & scope
    role: 'Prime' as const,
    percentage_of_work: 100,
    prime_contractor: '',
    team_size: 1,
    place_of_performance: '',

    // Point of contact
    client_poc: {
      name: '',
      title: '',
      phone: '',
      email: '',
      note: '',
    },

    // Narrative
    overview: '',
    description_of_effort: '',
    task_areas: [] as string[],
    tools_used: [] as string[],

    // Achievements
    achievements: [
      { statement: '', metric_value: '', metric_type: 'Quality Improvement' as const }
    ],

    // Relevance
    relevance_tags: [] as string[],
  });

  const [taskAreaInput, setTaskAreaInput] = useState('');
  const [toolInput, setToolInput] = useState('');
  const [tagInput, setTagInput] = useState('');

  const addTaskArea = () => {
    if (taskAreaInput.trim()) {
      setFormData({
        ...formData,
        task_areas: [...formData.task_areas, taskAreaInput.trim()]
      });
      setTaskAreaInput('');
    }
  };

  const removeTaskArea = (index: number) => {
    setFormData({
      ...formData,
      task_areas: formData.task_areas.filter((_, i) => i !== index)
    });
  };

  const addTool = () => {
    if (toolInput.trim()) {
      setFormData({
        ...formData,
        tools_used: [...formData.tools_used, toolInput.trim()]
      });
      setToolInput('');
    }
  };

  const removeTool = (index: number) => {
    setFormData({
      ...formData,
      tools_used: formData.tools_used.filter((_, i) => i !== index)
    });
  };

  const addTag = () => {
    if (tagInput.trim()) {
      setFormData({
        ...formData,
        relevance_tags: [...formData.relevance_tags, tagInput.trim()]
      });
      setTagInput('');
    }
  };

  const removeTag = (index: number) => {
    setFormData({
      ...formData,
      relevance_tags: formData.relevance_tags.filter((_, i) => i !== index)
    });
  };

  const addAchievement = () => {
    setFormData({
      ...formData,
      achievements: [
        ...formData.achievements,
        { statement: '', metric_value: '', metric_type: 'Quality Improvement' as const }
      ]
    });
  };

  const removeAchievement = (index: number) => {
    setFormData({
      ...formData,
      achievements: formData.achievements.filter((_, i) => i !== index)
    });
  };

  const updateAchievement = (index: number, field: string, value: string) => {
    const updated = [...formData.achievements];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, achievements: updated });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/company/past-performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to save contract');
      }

      router.push('/company/past-performance');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <a href="/company/past-performance" className="text-blue-600 hover:underline mb-4 inline-block">
          ← Back to Past Performance
        </a>
        <h1 className="text-4xl font-bold mb-2">Add Past Performance Contract</h1>
        <p className="text-gray-600">Step 4 of 6 - Contract history (15-30 minutes)</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Identification */}
        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-2xl font-semibold mb-4">Contract Identification</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Contract Nickname <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.contract_nickname}
                onChange={(e) => setFormData({ ...formData, contract_nickname: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                placeholder="FERC ePMO Support"
              />
              <p className="text-xs text-gray-500 mt-1">Internal reference name</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Official Contract Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.contract_name}
                onChange={(e) => setFormData({ ...formData, contract_name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                placeholder="Enterprise Program Management Support Services"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contract Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.contract_number}
                  onChange={(e) => setFormData({ ...formData, contract_number: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="47QFCA22D0001"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Task Order Number
                </label>
                <input
                  type="text"
                  value={formData.task_order_number}
                  onChange={(e) => setFormData({ ...formData, task_order_number: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="If under IDIQ/GWAC/BPA"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Client Agency <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.client_agency}
                  onChange={(e) => setFormData({ ...formData, client_agency: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="Federal Energy Regulatory Commission (FERC)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Client Office
                </label>
                <input
                  type="text"
                  value={formData.client_office}
                  onChange={(e) => setFormData({ ...formData, client_office: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="Chief Information Officer Organization (CIOO)"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Financials & Period */}
        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-2xl font-semibold mb-4">Contract Financials & Period</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Contract Type <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.contract_type}
                onChange={(e) => setFormData({ ...formData, contract_type: e.target.value as any })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="FFP">Firm Fixed Price (FFP)</option>
                <option value="T&M">Time & Materials (T&M)</option>
                <option value="Cost-Plus">Cost-Plus</option>
                <option value="Labor Hour">Labor Hour</option>
                <option value="Hybrid">Hybrid</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Total Contract Value <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={formData.contract_value}
                onChange={(e) => setFormData({ ...formData, contract_value: parseFloat(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                placeholder="YYYY-MM-DD or 'Ongoing'"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Base Period
              </label>
              <input
                type="text"
                value={formData.base_period}
                onChange={(e) => setFormData({ ...formData, base_period: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                placeholder="12 months"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Number of Option Periods
              </label>
              <input
                type="number"
                min="0"
                value={formData.option_periods}
                onChange={(e) => setFormData({ ...formData, option_periods: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Role & Scope */}
        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-2xl font-semibold mb-4">Role & Scope</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Role <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="Prime">Prime Contractor</option>
                <option value="Subcontractor">Subcontractor</option>
                <option value="Joint Venture">Joint Venture</option>
                <option value="Teaming Partner">Teaming Partner</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Team Size (FTEs) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min="1"
                value={formData.team_size}
                onChange={(e) => setFormData({ ...formData, team_size: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Place of Performance <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.place_of_performance}
                onChange={(e) => setFormData({ ...formData, place_of_performance: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                placeholder="Washington, DC (on-site) and Remote"
              />
            </div>
          </div>
        </div>

        {/* Client POC */}
        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-2xl font-semibold mb-4">Client Point of Contact</h2>
          <p className="text-sm text-gray-600 mb-4">For reference checks</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              required
              placeholder="Name *"
              value={formData.client_poc.name}
              onChange={(e) => setFormData({
                ...formData,
                client_poc: { ...formData.client_poc, name: e.target.value }
              })}
              className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              required
              placeholder="Title *"
              value={formData.client_poc.title}
              onChange={(e) => setFormData({
                ...formData,
                client_poc: { ...formData.client_poc, title: e.target.value }
              })}
              className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="tel"
              required
              placeholder="Phone *"
              value={formData.client_poc.phone}
              onChange={(e) => setFormData({
                ...formData,
                client_poc: { ...formData.client_poc, phone: e.target.value }
              })}
              className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="email"
              required
              placeholder="Email *"
              value={formData.client_poc.email}
              onChange={(e) => setFormData({
                ...formData,
                client_poc: { ...formData.client_poc, email: e.target.value }
              })}
              className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
            <div className="md:col-span-2">
              <input
                type="text"
                placeholder="Note (e.g., 'Best to call, prefers morning')"
                value={formData.client_poc.note}
                onChange={(e) => setFormData({
                  ...formData,
                  client_poc: { ...formData.client_poc, note: e.target.value }
                })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Narrative */}
        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-2xl font-semibold mb-4">Contract Description</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Overview <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-gray-500 mb-2">2-3 sentence summary (max 500 chars)</p>
              <textarea
                required
                maxLength={500}
                rows={3}
                value={formData.overview}
                onChange={(e) => setFormData({ ...formData, overview: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                placeholder="Acme provides enterprise program management support to FERC's Chief Information Officer Organization..."
              />
              <p className="text-xs text-gray-500 mt-1">{formData.overview.length} / 500</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Detailed Description of Effort <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-gray-500 mb-2">1-2 paragraphs (max 2000 chars)</p>
              <textarea
                required
                maxLength={2000}
                rows={6}
                value={formData.description_of_effort}
                onChange={(e) => setFormData({ ...formData, description_of_effort: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">{formData.description_of_effort.length} / 2000</p>
            </div>

            {/* Task Areas */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Task Areas <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={taskAreaInput}
                  onChange={(e) => setTaskAreaInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTaskArea())}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Program/Project Management"
                />
                <button
                  type="button"
                  onClick={addTaskArea}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.task_areas.map((area, idx) => (
                  <span key={idx} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-2">
                    {area}
                    <button type="button" onClick={() => removeTaskArea(idx)} className="text-blue-600 hover:text-blue-800">×</button>
                  </span>
                ))}
              </div>
            </div>

            {/* Tools Used */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tools/Technologies Used
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={toolInput}
                  onChange={(e) => setToolInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTool())}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Jira, ServiceNow"
                />
                <button
                  type="button"
                  onClick={addTool}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.tools_used.map((tool, idx) => (
                  <span key={idx} className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm flex items-center gap-2">
                    {tool}
                    <button type="button" onClick={() => removeTool(idx)} className="text-gray-600 hover:text-gray-800">×</button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Achievements */}
        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-2xl font-semibold mb-4">Achievements & Metrics</h2>
          <p className="text-sm text-gray-600 mb-4">Add at least 2 quantified accomplishments</p>

          <div className="space-y-4">
            {formData.achievements.map((achievement, idx) => (
              <div key={idx} className="p-4 border border-gray-200 rounded-md">
                <div className="flex justify-between items-start mb-3">
                  <h4 className="font-medium">Achievement {idx + 1}</h4>
                  {formData.achievements.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeAchievement(idx)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="space-y-3">
                  <input
                    type="text"
                    required
                    placeholder="Achievement statement (max 200 chars)"
                    maxLength={200}
                    value={achievement.statement}
                    onChange={(e) => updateAchievement(idx, 'statement', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Metric value (e.g., 30%)"
                      value={achievement.metric_value}
                      onChange={(e) => updateAchievement(idx, 'metric_value', e.target.value)}
                      className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    />
                    <select
                      value={achievement.metric_type}
                      onChange={(e) => updateAchievement(idx, 'metric_type', e.target.value)}
                      className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Cost Savings">Cost Savings</option>
                      <option value="Time Savings">Time Savings</option>
                      <option value="Quality Improvement">Quality Improvement</option>
                      <option value="Efficiency Gain">Efficiency Gain</option>
                      <option value="Customer Satisfaction">Customer Satisfaction</option>
                      <option value="Compliance">Compliance</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addAchievement}
              className="w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-md text-gray-600 hover:border-blue-500 hover:text-blue-600"
            >
              + Add Another Achievement
            </button>
          </div>
        </div>

        {/* Relevance Tags */}
        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-2xl font-semibold mb-4">Relevance Tags</h2>
          <p className="text-sm text-gray-600 mb-4">Keywords for auto-matching to RFP requirements</p>

          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., PMO, federal agency, Agile, SAFe"
            />
            <button
              type="button"
              onClick={addTag}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Add Tag
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {formData.relevance_tags.map((tag, idx) => (
              <span key={idx} className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm flex items-center gap-2">
                {tag}
                <button type="button" onClick={() => removeTag(idx)} className="text-purple-600 hover:text-purple-800">×</button>
              </span>
            ))}
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-between items-center">
          <button
            type="button"
            onClick={() => router.push('/company/past-performance')}
            className="px-6 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="bg-blue-600 text-white px-8 py-3 rounded-md hover:bg-blue-700 disabled:bg-gray-400 font-semibold"
          >
            {saving ? 'Saving...' : 'Save Contract'}
          </button>
        </div>
      </form>
    </main>
  );
}
