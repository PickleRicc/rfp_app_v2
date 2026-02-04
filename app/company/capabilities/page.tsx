'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Briefcase, Wrench, BarChart3 } from 'lucide-react';
import { useCompany } from '@/lib/context/CompanyContext';
import { useFetchWithCompany } from '@/lib/hooks/useFetchWithCompany';

type TabType = 'services' | 'tools' | 'methodologies';

interface ServiceArea {
  id: string;
  service_name: string;
  description: string;
  experience_years?: number;
  key_clients: string[];
  relevant_naics: string[];
}

interface Tool {
  id: string;
  name: string;
  category?: string;
  proficiency: string;
  years_experience?: number;
  certified_practitioners?: number;
  description?: string;
}

interface Methodology {
  id: string;
  name: string;
  category?: string;
  implementation_experience?: string;
  certified_practitioners?: number;
}

export default function CapabilitiesPage() {
  const router = useRouter();
  const { selectedCompany, selectedCompanyId } = useCompany();
  const { fetchWithCompany } = useFetchWithCompany();
  const [activeTab, setActiveTab] = useState<TabType>('services');
  const [loading, setLoading] = useState(true);
  const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [methodologies, setMethodologies] = useState<Methodology[]>([]);

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
      const response = await fetchWithCompany('/api/company/capabilities');
      const data = await response.json();
      setServiceAreas(data.serviceAreas || []);
      setTools(data.tools || []);
      setMethodologies(data.methodologies || []);
    } catch (error) {
      console.error('Error fetching capabilities:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, type: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
      await fetchWithCompany(`/api/company/capabilities/${id}?type=${type}`, {
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
            Please select a company from the header to manage capabilities.
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
        <h1 className="text-4xl font-bold mb-2">Capabilities</h1>
        <p className="text-gray-600">Manage your company's services, tools, technologies, and methodologies</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('services')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'services'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Service Areas ({serviceAreas.length})
          </button>
          <button
            onClick={() => setActiveTab('tools')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'tools'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Tools & Technologies ({tools.length})
          </button>
          <button
            onClick={() => setActiveTab('methodologies')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'methodologies'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Methodologies & Frameworks ({methodologies.length})
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'services' && (
        <ServicesTab
          services={serviceAreas}
          onDelete={handleDelete}
          onRefresh={fetchData}
        />
      )}

      {activeTab === 'tools' && (
        <ToolsTab
          tools={tools}
          onDelete={handleDelete}
          onRefresh={fetchData}
        />
      )}

      {activeTab === 'methodologies' && (
        <MethodologiesTab
          methodologies={methodologies}
          onDelete={handleDelete}
          onRefresh={fetchData}
        />
      )}
    </main>
  );
}

function ServicesTab({ services, onDelete, onRefresh }: any) {
  const { fetchWithCompany } = useFetchWithCompany();
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    service_name: '',
    description: '',
    experience_years: 0,
    key_clients: [] as string[],
    relevant_naics: [] as string[],
  });
  const [clientInput, setClientInput] = useState('');
  const [naicsInput, setNaicsInput] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchWithCompany('/api/company/capabilities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'service', ...formData }),
      });
      setShowAddForm(false);
      setFormData({
        service_name: '',
        description: '',
        experience_years: 0,
        key_clients: [],
        relevant_naics: [],
      });
      onRefresh();
    } catch (error) {
      console.error('Error adding service:', error);
    }
  };

  const addClient = () => {
    if (clientInput.trim()) {
      setFormData({
        ...formData,
        key_clients: [...formData.key_clients, clientInput.trim()]
      });
      setClientInput('');
    }
  };

  const addNaics = () => {
    if (naicsInput.trim()) {
      setFormData({
        ...formData,
        relevant_naics: [...formData.relevant_naics, naicsInput.trim()]
      });
      setNaicsInput('');
    }
  };

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <p className="text-gray-600">
          Primary services and service areas your company provides
        </p>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
        >
          {showAddForm ? 'Cancel' : '+ Add Service Area'}
        </button>
      </div>

      {showAddForm && (
        <div className="bg-white shadow-md rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Add Service Area</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Service Name *
              </label>
              <input
                type="text"
                required
                value={formData.service_name}
                onChange={(e) => setFormData({ ...formData, service_name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                placeholder="Enterprise Program Management"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description *
              </label>
              <textarea
                required
                maxLength={500}
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                placeholder="Describe this service offering in 2-3 sentences"
              />
              <p className="text-xs text-gray-500 mt-1">{formData.description.length} / 500</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Years of Experience
              </label>
              <input
                type="number"
                min="0"
                value={formData.experience_years}
                onChange={(e) => setFormData({ ...formData, experience_years: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Key Clients
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={clientInput}
                  onChange={(e) => setClientInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addClient())}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="Notable client name"
                />
                <button
                  type="button"
                  onClick={addClient}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.key_clients.map((client, idx) => (
                  <span key={idx} className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm flex items-center gap-2">
                    {client}
                    <button
                      type="button"
                      onClick={() => setFormData({
                        ...formData,
                        key_clients: formData.key_clients.filter((_, i) => i !== idx)
                      })}
                      className="text-gray-600 hover:text-gray-800"
                    >×</button>
                  </span>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Relevant NAICS Codes
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={naicsInput}
                  onChange={(e) => setNaicsInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addNaics())}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="6-digit NAICS code"
                />
                <button
                  type="button"
                  onClick={addNaics}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.relevant_naics.map((naics, idx) => (
                  <span key={idx} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-2">
                    {naics}
                    <button
                      type="button"
                      onClick={() => setFormData({
                        ...formData,
                        relevant_naics: formData.relevant_naics.filter((_, i) => i !== idx)
                      })}
                      className="text-blue-600 hover:text-blue-800"
                    >×</button>
                  </span>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
            >
              Add Service Area
            </button>
          </form>
        </div>
      )}

      {services.length === 0 ? (
        <div className="bg-white shadow-md rounded-lg p-8 text-center">
          <div className="mb-4 flex justify-center">
            <Briefcase className="h-16 w-16 text-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-2">No Service Areas Yet</h2>
          <p className="text-gray-600 mb-4">
            Add the primary services and capabilities your company provides
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {services.map((service: ServiceArea) => (
            <div key={service.id} className="bg-white shadow-md rounded-lg p-6">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold mb-2">{service.service_name}</h3>
                  <p className="text-gray-700 mb-3">{service.description}</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    {service.experience_years && (
                      <div>
                        <span className="text-gray-500">Experience:</span>
                        <p className="font-medium">{service.experience_years} years</p>
                      </div>
                    )}
                    {service.key_clients.length > 0 && (
                      <div className="col-span-2">
                        <span className="text-gray-500">Key Clients:</span>
                        <p className="font-medium">{service.key_clients.join(', ')}</p>
                      </div>
                    )}
                  </div>
                  {service.relevant_naics.length > 0 && (
                    <div className="mt-3">
                      <span className="text-xs text-gray-500">NAICS: </span>
                      {service.relevant_naics.map((naics, idx) => (
                        <span key={idx} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded mr-2">
                          {naics}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => onDelete(service.id, 'service')}
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
  );
}

function ToolsTab({ tools, onDelete, onRefresh }: any) {
  const { fetchWithCompany } = useFetchWithCompany();
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    proficiency: 'Proficient' as const,
    years_experience: 0,
    certified_practitioners: 0,
    description: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchWithCompany('/api/company/capabilities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'tool', ...formData }),
      });
      setShowAddForm(false);
      setFormData({
        name: '',
        category: '',
        proficiency: 'Proficient',
        years_experience: 0,
        certified_practitioners: 0,
        description: '',
      });
      onRefresh();
    } catch (error) {
      console.error('Error adding tool:', error);
    }
  };

  const toolCategories = [
    'Project Management',
    'Agile/Scrum',
    'DevOps/CI-CD',
    'Cloud Platform',
    'Collaboration',
    'Analytics/BI',
    'Security',
    'Development',
    'Database',
    'Other',
  ];

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <p className="text-gray-600">
          Tools and technologies your company has expertise in
        </p>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
        >
          {showAddForm ? 'Cancel' : '+ Add Tool/Technology'}
        </button>
      </div>

      {showAddForm && (
        <div className="bg-white shadow-md rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Add Tool/Technology</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tool/Technology Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="ServiceNow, Jira, AWS, etc."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select category</option>
                  {toolCategories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Proficiency Level *
                </label>
                <select
                  required
                  value={formData.proficiency}
                  onChange={(e) => setFormData({ ...formData, proficiency: e.target.value as any })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Basic">Basic</option>
                  <option value="Proficient">Proficient</option>
                  <option value="Expert">Expert</option>
                  <option value="Certified Partner">Certified Partner</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Years of Experience
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.years_experience}
                  onChange={(e) => setFormData({ ...formData, years_experience: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Certified Practitioners
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.certified_practitioners}
                  onChange={(e) => setFormData({ ...formData, certified_practitioners: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                maxLength={200}
                rows={2}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                placeholder="How do you use this tool for clients?"
              />
              <p className="text-xs text-gray-500 mt-1">{formData.description.length} / 200</p>
            </div>

            <button
              type="submit"
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
            >
              Add Tool/Technology
            </button>
          </form>
        </div>
      )}

      {tools.length === 0 ? (
        <div className="bg-white shadow-md rounded-lg p-8 text-center">
          <div className="mb-4 flex justify-center">
            <Wrench className="h-16 w-16 text-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-2">No Tools/Technologies Yet</h2>
          <p className="text-gray-600 mb-4">
            Add the tools and technologies your company has expertise in
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {tools.map((tool: Tool) => (
            <div key={tool.id} className="bg-white shadow-md rounded-lg p-6">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold">{tool.name}</h3>
                    <span className={`px-2 py-1 text-xs font-semibold rounded ${
                      tool.proficiency === 'Expert' || tool.proficiency === 'Certified Partner'
                        ? 'bg-green-100 text-green-800'
                        : tool.proficiency === 'Proficient'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {tool.proficiency}
                    </span>
                    {tool.category && (
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                        {tool.category}
                      </span>
                    )}
                  </div>
                  {tool.description && (
                    <p className="text-gray-700 mb-2">{tool.description}</p>
                  )}
                  <div className="flex gap-4 text-sm text-gray-600">
                    {tool.years_experience && (
                      <span>{tool.years_experience} years experience</span>
                    )}
                    {tool.certified_practitioners && (
                      <span>{tool.certified_practitioners} certified practitioners</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => onDelete(tool.id, 'tool')}
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
  );
}

function MethodologiesTab({ methodologies, onDelete, onRefresh }: any) {
  const { fetchWithCompany } = useFetchWithCompany();
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    implementation_experience: '',
    certified_practitioners: 0,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchWithCompany('/api/company/capabilities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'methodology', ...formData }),
      });
      setShowAddForm(false);
      setFormData({
        name: '',
        category: '',
        implementation_experience: '',
        certified_practitioners: 0,
      });
      onRefresh();
    } catch (error) {
      console.error('Error adding methodology:', error);
    }
  };

  const methodologyCategories = [
    'Agile',
    'Project Management',
    'IT Service Management',
    'Security',
    'Quality',
    'Architecture',
    'Other',
  ];

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <p className="text-gray-600">
          Methodologies and frameworks your company implements
        </p>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
        >
          {showAddForm ? 'Cancel' : '+ Add Methodology/Framework'}
        </button>
      </div>

      {showAddForm && (
        <div className="bg-white shadow-md rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Add Methodology/Framework</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Methodology/Framework Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="SAFe, ITIL, PMBOK, etc."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select category</option>
                  {methodologyCategories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Certified Practitioners
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.certified_practitioners}
                  onChange={(e) => setFormData({ ...formData, certified_practitioners: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Implementation Experience
              </label>
              <textarea
                maxLength={300}
                rows={3}
                value={formData.implementation_experience}
                onChange={(e) => setFormData({ ...formData, implementation_experience: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                placeholder="Describe your experience implementing this framework"
              />
              <p className="text-xs text-gray-500 mt-1">{formData.implementation_experience.length} / 300</p>
            </div>

            <button
              type="submit"
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
            >
              Add Methodology/Framework
            </button>
          </form>
        </div>
      )}

      {methodologies.length === 0 ? (
        <div className="bg-white shadow-md rounded-lg p-8 text-center">
          <div className="mb-4 flex justify-center">
            <BarChart3 className="h-16 w-16 text-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-2">No Methodologies/Frameworks Yet</h2>
          <p className="text-gray-600 mb-4">
            Add the methodologies and frameworks your company implements
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {methodologies.map((methodology: Methodology) => (
            <div key={methodology.id} className="bg-white shadow-md rounded-lg p-6">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold">{methodology.name}</h3>
                    {methodology.category && (
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                        {methodology.category}
                      </span>
                    )}
                  </div>
                  {methodology.implementation_experience && (
                    <p className="text-gray-700 mb-2">{methodology.implementation_experience}</p>
                  )}
                  {methodology.certified_practitioners && (
                    <p className="text-sm text-gray-600">
                      {methodology.certified_practitioners} certified practitioners
                    </p>
                  )}
                </div>
                <button
                  onClick={() => onDelete(methodology.id, 'methodology')}
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
  );
}
