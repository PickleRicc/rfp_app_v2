'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useFetchWithCompany } from '@/lib/hooks/useFetchWithCompany';

export default function EditPastPerformance({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { fetchWithCompany } = useFetchWithCompany();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    contract_nickname: '',
    contract_name: '',
    contract_number: '',
    task_order_number: '',
    client_agency: '',
    client_office: '',
    contract_type: 'FFP' as const,
    contract_value: 0,
    annual_value: 0,
    start_date: '',
    end_date: '',
    base_period: '',
    option_periods: 0,
    role: 'Prime' as const,
    percentage_of_work: 100,
    prime_contractor: '',
    team_size: 1,
    place_of_performance: '',
    client_poc: {
      name: '',
      title: '',
      phone: '',
      email: '',
      note: '',
    },
    overview: '',
    description_of_effort: '',
    task_areas: [] as string[],
    tools_used: [] as string[],
    achievements: [] as string[],
    relevance_tags: [] as string[],
  });

  const [taskInput, setTaskInput] = useState('');
  const [toolInput, setToolInput] = useState('');
  const [achievementInput, setAchievementInput] = useState('');
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    fetchContract();
  }, [params.id]);

  const fetchContract = async () => {
    try {
      setLoading(true);
      const response = await fetchWithCompany(`/api/company/past-performance/${params.id}`);
      const data = await response.json();
      if (data.contract) {
        setFormData({
          ...data.contract,
          contract_value: data.contract.contract_value || 0,
          annual_value: data.contract.annual_value || 0,
          task_order_number: data.contract.task_order_number || '',
          client_office: data.contract.client_office || '',
          base_period: data.contract.base_period || '',
          option_periods: data.contract.option_periods || 0,
          prime_contractor: data.contract.prime_contractor || '',
        });
      }
    } catch (err) {
      console.error('Error fetching contract:', err);
      setError('Failed to load contract');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetchWithCompany(`/api/company/past-performance/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to update contract');
      }

      router.push('/company/past-performance');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const addTaskArea = () => {
    if (taskInput.trim()) {
      setFormData({
        ...formData,
        task_areas: [...formData.task_areas, taskInput.trim()]
      });
      setTaskInput('');
    }
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

  const addAchievement = () => {
    if (achievementInput.trim()) {
      setFormData({
        ...formData,
        achievements: [...formData.achievements, achievementInput.trim()]
      });
      setAchievementInput('');
    }
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

  if (loading) {
    return (
      <main className="min-h-screen p-8 max-w-4xl mx-auto">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <a href="/company/past-performance" className="text-blue-600 hover:underline mb-4 inline-block">
          ← Back to Past Performance
        </a>
        <h1 className="text-4xl font-bold mb-2">Edit Past Performance</h1>
        <p className="text-gray-600">Update contract details and achievements</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Contract Identification */}
        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-2xl font-semibold mb-4">Contract Identification</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Contract Nickname * <span className="text-gray-500">(for internal use)</span>
              </label>
              <input
                type="text"
                required
                maxLength={100}
                value={formData.contract_nickname}
                onChange={(e) => setFormData({ ...formData, contract_nickname: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                placeholder="EPA LEAN Initiative"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contract Number *
                </label>
                <input
                  type="text"
                  required
                  value={formData.contract_number}
                  onChange={(e) => setFormData({ ...formData, contract_number: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
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
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Official Contract Name *
              </label>
              <input
                type="text"
                required
                value={formData.contract_name}
                onChange={(e) => setFormData({ ...formData, contract_name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Client Agency *
                </label>
                <input
                  type="text"
                  required
                  value={formData.client_agency}
                  onChange={(e) => setFormData({ ...formData, client_agency: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="Department of Homeland Security"
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
                  placeholder="Office of the CIO"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Contract Details */}
        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-2xl font-semibold mb-4">Contract Details</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Contract Type *
              </label>
              <select
                required
                value={formData.contract_type}
                onChange={(e) => setFormData({ ...formData, contract_type: e.target.value as any })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="FFP">FFP (Firm Fixed Price)</option>
                <option value="T&M">T&M (Time & Materials)</option>
                <option value="CPFF">CPFF (Cost Plus Fixed Fee)</option>
                <option value="IDIQ">IDIQ</option>
                <option value="BPA">BPA</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Total Contract Value *
              </label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={formData.contract_value}
                onChange={(e) => setFormData({ ...formData, contract_value: parseFloat(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date *
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
                End Date *
              </label>
              <input
                type="date"
                required
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Role *
              </label>
              <select
                required
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="Prime">Prime</option>
                <option value="Sub">Subcontractor</option>
                <option value="Teaming">Teaming Partner</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Team Size *
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

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Place of Performance *
              </label>
              <input
                type="text"
                required
                value={formData.place_of_performance}
                onChange={(e) => setFormData({ ...formData, place_of_performance: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Description & Relevance */}
        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-2xl font-semibold mb-4">Description & Relevance</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Overview * (2-3 sentences, max 500 characters)
              </label>
              <textarea
                required
                maxLength={500}
                rows={4}
                value={formData.overview}
                onChange={(e) => setFormData({ ...formData, overview: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">{formData.overview.length} / 500</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Detailed Description * (max 2000 characters)
              </label>
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
                Task Areas/Services Provided *
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={taskInput}
                  onChange={(e) => setTaskInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTaskArea())}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="Program Management"
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
                {formData.task_areas.map((task, idx) => (
                  <span key={idx} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-2">
                    {task}
                    <button
                      type="button"
                      onClick={() => setFormData({
                        ...formData,
                        task_areas: formData.task_areas.filter((_, i) => i !== idx)
                      })}
                      className="text-blue-600 hover:text-blue-800"
                    >×</button>
                  </span>
                ))}
              </div>
            </div>

            {/* Tools Used */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tools & Technologies Used
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={toolInput}
                  onChange={(e) => setToolInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTool())}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="ServiceNow"
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
                  <span key={idx} className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm flex items-center gap-2">
                    {tool}
                    <button
                      type="button"
                      onClick={() => setFormData({
                        ...formData,
                        tools_used: formData.tools_used.filter((_, i) => i !== idx)
                      })}
                      className="text-green-600 hover:text-green-800"
                    >×</button>
                  </span>
                ))}
              </div>
            </div>

            {/* Achievements */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Key Achievements *
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={achievementInput}
                  onChange={(e) => setAchievementInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addAchievement())}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="Delivered ahead of schedule with 98% client satisfaction"
                />
                <button
                  type="button"
                  onClick={addAchievement}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Add
                </button>
              </div>
              <div className="space-y-2">
                {formData.achievements.map((achievement, idx) => (
                  <div key={idx} className="flex items-start gap-2 p-2 bg-yellow-50 rounded">
                    <span className="text-sm flex-1">{achievement}</span>
                    <button
                      type="button"
                      onClick={() => setFormData({
                        ...formData,
                        achievements: formData.achievements.filter((_, i) => i !== idx)
                      })}
                      className="text-red-600 hover:underline text-sm"
                    >Remove</button>
                  </div>
                ))}
              </div>
            </div>

            {/* Relevance Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Relevance Tags
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="Agile, Federal Civilian, Enterprise IT"
                />
                <button
                  type="button"
                  onClick={addTag}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.relevance_tags.map((tag, idx) => (
                  <span key={idx} className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm flex items-center gap-2">
                    {tag}
                    <button
                      type="button"
                      onClick={() => setFormData({
                        ...formData,
                        relevance_tags: formData.relevance_tags.filter((_, i) => i !== idx)
                      })}
                      className="text-purple-600 hover:text-purple-800"
                    >×</button>
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
            onClick={() => router.push('/company/past-performance')}
            className="px-6 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || formData.task_areas.length === 0 || formData.achievements.length === 0}
            className="bg-blue-600 text-white px-8 py-3 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </main>
  );
}
