'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCompany } from '@/lib/context/CompanyContext';
import { useFetchWithCompany } from '@/lib/hooks/useFetchWithCompany';

interface ValueProposition {
  id: string;
  theme: string;
  statement: string;
  proof_points: string[];
  applicable_to: string[];
}

interface Innovation {
  id: string;
  name: string;
  description: string;
  evidence: string;
  proprietary: boolean;
}

interface CompetitiveAdvantage {
  id: string;
  area: string;
  our_strength: string;
  competitor_weakness: string;
}

export default function DifferentiatorsPage() {
  const router = useRouter();
  const { selectedCompany, selectedCompanyId } = useCompany();
  const { fetchWithCompany } = useFetchWithCompany();
  const [loading, setLoading] = useState(true);
  const [valuePropositions, setValuePropositions] = useState<ValueProposition[]>([]);
  const [innovations, setInnovations] = useState<Innovation[]>([]);
  const [competitiveAdvantages, setCompetitiveAdvantages] = useState<CompetitiveAdvantage[]>([]);

  useEffect(() => {
    if (selectedCompanyId) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [selectedCompanyId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetchWithCompany('/api/company/differentiators');
      const data = await response.json();
      setValuePropositions(data.valuePropositions || []);
      setInnovations(data.innovations || []);
      setCompetitiveAdvantages(data.competitiveAdvantages || []);
    } catch (error) {
      console.error('Error fetching differentiators:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, type: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
      await fetchWithCompany(`/api/company/differentiators/${id}?type=${type}`, {
        method: 'DELETE',
      });
      fetchData();
    } catch (error) {
      console.error('Error deleting:', error);
    }
  };

  if (!selectedCompany) {
    return (
      <main className="min-h-screen p-8 max-w-6xl mx-auto">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h3 className="font-semibold text-yellow-900 mb-1">No Company Selected</h3>
          <p className="text-sm text-yellow-800">
            Please select a company from the header to manage differentiators.
          </p>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen p-8 max-w-6xl mx-auto">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <a href="/company" className="text-blue-600 hover:underline mb-4 inline-block">
          ← Back to Dashboard
        </a>
        <h1 className="text-4xl font-bold mb-2">Differentiators & Win Themes</h1>
        <p className="text-gray-600">Define what makes your company unique and why you win</p>
      </div>

      {/* Value Propositions */}
      <ValuePropositionsSection
        propositions={valuePropositions}
        onDelete={handleDelete}
        onRefresh={fetchData}
      />

      {/* Innovations */}
      <InnovationsSection
        innovations={innovations}
        onDelete={handleDelete}
        onRefresh={fetchData}
      />

      {/* Competitive Advantages */}
      <CompetitiveAdvantagesSection
        advantages={competitiveAdvantages}
        onDelete={handleDelete}
        onRefresh={fetchData}
      />
    </main>
  );
}

function ValuePropositionsSection({ propositions, onDelete, onRefresh }: any) {
  const { fetchWithCompany } = useFetchWithCompany();
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    theme: '',
    statement: '',
    proof_points: [] as string[],
    applicable_to: [] as string[],
  });
  const [proofPointInput, setProofPointInput] = useState('');
  const [applicableInput, setApplicableInput] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchWithCompany('/api/company/differentiators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'value_proposition', ...formData }),
      });
      setShowAddForm(false);
      setFormData({
        theme: '',
        statement: '',
        proof_points: [],
        applicable_to: [],
      });
      onRefresh();
    } catch (error) {
      console.error('Error adding value proposition:', error);
    }
  };

  const addProofPoint = () => {
    if (proofPointInput.trim()) {
      setFormData({
        ...formData,
        proof_points: [...formData.proof_points, proofPointInput.trim()]
      });
      setProofPointInput('');
    }
  };

  const addApplicable = () => {
    if (applicableInput.trim()) {
      setFormData({
        ...formData,
        applicable_to: [...formData.applicable_to, applicableInput.trim()]
      });
      setApplicableInput('');
    }
  };

  return (
    <div className="mb-12">
      <div className="bg-white shadow-md rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-semibold mb-2">Value Propositions</h2>
            <p className="text-gray-600">3-7 unique value propositions recommended</p>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
          >
            {showAddForm ? 'Cancel' : '+ Add Value Proposition'}
          </button>
        </div>

        {showAddForm && (
          <div className="border-t pt-6 mb-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Theme *
                </label>
                <input
                  type="text"
                  required
                  value={formData.theme}
                  onChange={(e) => setFormData({ ...formData, theme: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="Proven Federal Experience"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Statement * (max 200 characters)
                </label>
                <textarea
                  required
                  maxLength={200}
                  rows={2}
                  value={formData.statement}
                  onChange={(e) => setFormData({ ...formData, statement: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="One sentence stating this differentiator"
                />
                <p className="text-xs text-gray-500 mt-1">{formData.statement.length} / 200</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Proof Points * (at least 2)
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={proofPointInput}
                    onChange={(e) => setProofPointInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addProofPoint())}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    placeholder="Evidence that supports this differentiator"
                  />
                  <button
                    type="button"
                    onClick={addProofPoint}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.proof_points.map((point, idx) => (
                    <span key={idx} className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm flex items-center gap-2">
                      {point}
                      <button
                        type="button"
                        onClick={() => setFormData({
                          ...formData,
                          proof_points: formData.proof_points.filter((_, i) => i !== idx)
                        })}
                        className="text-green-600 hover:text-green-800"
                      >×</button>
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Applicable To
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={applicableInput}
                    onChange={(e) => setApplicableInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addApplicable())}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., PMO, IT Services, Federal Civilian"
                  />
                  <button
                    type="button"
                    onClick={addApplicable}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.applicable_to.map((item, idx) => (
                    <span key={idx} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-2">
                      {item}
                      <button
                        type="button"
                        onClick={() => setFormData({
                          ...formData,
                          applicable_to: formData.applicable_to.filter((_, i) => i !== idx)
                        })}
                        className="text-blue-600 hover:text-blue-800"
                      >×</button>
                    </span>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={formData.proof_points.length < 2}
                className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
              >
                Add Value Proposition
              </button>
            </form>
          </div>
        )}

        {propositions.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-600">No value propositions yet. Add 3-7 to define your unique value.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {propositions.map((prop: ValueProposition) => (
              <div key={prop.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold mb-2">{prop.theme}</h3>
                    <p className="text-gray-700 mb-3">{prop.statement}</p>
                    <div className="mb-2">
                      <span className="text-sm font-medium text-gray-600">Proof Points:</span>
                      <ul className="list-disc list-inside text-sm text-gray-700 mt-1">
                        {prop.proof_points.map((point, idx) => (
                          <li key={idx}>{point}</li>
                        ))}
                      </ul>
                    </div>
                    {prop.applicable_to.length > 0 && (
                      <div className="flex gap-2 flex-wrap">
                        <span className="text-sm text-gray-600">Applicable to:</span>
                        {prop.applicable_to.map((item, idx) => (
                          <span key={idx} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
                            {item}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => onDelete(prop.id, 'value_proposition')}
                    className="text-red-600 hover:underline ml-4"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InnovationsSection({ innovations, onDelete, onRefresh }: any) {
  const { fetchWithCompany } = useFetchWithCompany();
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    evidence: '',
    proprietary: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchWithCompany('/api/company/differentiators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'innovation', ...formData }),
      });
      setShowAddForm(false);
      setFormData({
        name: '',
        description: '',
        evidence: '',
        proprietary: false,
      });
      onRefresh();
    } catch (error) {
      console.error('Error adding innovation:', error);
    }
  };

  return (
    <div className="mb-12">
      <div className="bg-white shadow-md rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-semibold mb-2">Innovations</h2>
            <p className="text-gray-600">Unique capabilities, tools, or methods</p>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
          >
            {showAddForm ? 'Cancel' : '+ Add Innovation'}
          </button>
        </div>

        {showAddForm && (
          <div className="border-t pt-6 mb-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="Agile Maturity Accelerator"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description * (max 500 characters)
                </label>
                <textarea
                  required
                  maxLength={500}
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="What is it and how does it benefit clients?"
                />
                <p className="text-xs text-gray-500 mt-1">{formData.description.length} / 500</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Evidence * (max 300 characters)
                </label>
                <textarea
                  required
                  maxLength={300}
                  rows={2}
                  value={formData.evidence}
                  onChange={(e) => setFormData({ ...formData, evidence: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="Results achieved using this innovation"
                />
                <p className="text-xs text-gray-500 mt-1">{formData.evidence.length} / 300</p>
              </div>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.proprietary}
                  onChange={(e) => setFormData({ ...formData, proprietary: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-900">Proprietary tool/method</span>
              </label>

              <button
                type="submit"
                className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
              >
                Add Innovation
              </button>
            </form>
          </div>
        )}

        {innovations.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-600">No innovations yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {innovations.map((innovation: Innovation) => (
              <div key={innovation.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold">{innovation.name}</h3>
                      {innovation.proprietary && (
                        <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-semibold rounded">
                          Proprietary
                        </span>
                      )}
                    </div>
                    <p className="text-gray-700 mb-2">{innovation.description}</p>
                    <p className="text-sm text-gray-600">
                      <strong>Evidence:</strong> {innovation.evidence}
                    </p>
                  </div>
                  <button
                    onClick={() => onDelete(innovation.id, 'innovation')}
                    className="text-red-600 hover:underline ml-4"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CompetitiveAdvantagesSection({ advantages, onDelete, onRefresh }: any) {
  const { fetchWithCompany } = useFetchWithCompany();
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    area: '',
    our_strength: '',
    competitor_weakness: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchWithCompany('/api/company/differentiators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'competitive_advantage', ...formData }),
      });
      setShowAddForm(false);
      setFormData({
        area: '',
        our_strength: '',
        competitor_weakness: '',
      });
      onRefresh();
    } catch (error) {
      console.error('Error adding competitive advantage:', error);
    }
  };

  return (
    <div className="mb-12">
      <div className="bg-white shadow-md rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-semibold mb-2">Competitive Advantages</h2>
            <p className="text-gray-600">What you do better than competitors</p>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
          >
            {showAddForm ? 'Cancel' : '+ Add Advantage'}
          </button>
        </div>

        {showAddForm && (
          <div className="border-t pt-6 mb-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Area *
                </label>
                <input
                  type="text"
                  required
                  value={formData.area}
                  onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="Transition Speed"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Our Strength * (max 200 characters)
                </label>
                <textarea
                  required
                  maxLength={200}
                  rows={2}
                  value={formData.our_strength}
                  onChange={(e) => setFormData({ ...formData, our_strength: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="Average 15-day transition vs. industry standard 30 days"
                />
                <p className="text-xs text-gray-500 mt-1">{formData.our_strength.length} / 200</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Competitor Weakness * (max 200 characters)
                </label>
                <p className="text-xs text-gray-500 mb-2">Never name competitors - describe general market gap</p>
                <textarea
                  required
                  maxLength={200}
                  rows={2}
                  value={formData.competitor_weakness}
                  onChange={(e) => setFormData({ ...formData, competitor_weakness: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="Many contractors require extended ramp-up periods"
                />
                <p className="text-xs text-gray-500 mt-1">{formData.competitor_weakness.length} / 200</p>
              </div>

              <button
                type="submit"
                className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
              >
                Add Competitive Advantage
              </button>
            </form>
          </div>
        )}

        {advantages.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-600">No competitive advantages yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {advantages.map((advantage: CompetitiveAdvantage) => (
              <div key={advantage.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold mb-2">{advantage.area}</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-green-700">Our Strength:</span>
                        <p className="text-gray-700 mt-1">{advantage.our_strength}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-600">Market Gap:</span>
                        <p className="text-gray-700 mt-1">{advantage.competitor_weakness}</p>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => onDelete(advantage.id, 'competitive_advantage')}
                    className="text-red-600 hover:underline ml-4"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
