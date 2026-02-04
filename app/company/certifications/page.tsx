'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ScrollText, Building2, Car } from 'lucide-react';
import { useCompany } from '@/lib/context/CompanyContext';
import { useFetchWithCompany } from '@/lib/hooks/useFetchWithCompany';

type TabType = 'certifications' | 'naics' | 'vehicles' | 'clearance';

interface Certification {
  id: string;
  certification_type: string;
  certifying_agency?: string;
  certification_number?: string;
  effective_date?: string;
  expiration_date?: string;
}

interface NaicsCode {
  id: string;
  code: string;
  title: string;
  size_standard?: string;
  is_primary: boolean;
}

interface ContractVehicle {
  id: string;
  vehicle_name: string;
  contract_number?: string;
  vehicle_type: string;
  ordering_period_end?: string;
  ceiling_value?: number;
  remaining_ceiling?: number;
  labor_categories: string[];
}

interface FacilityClearance {
  id?: string;
  has_facility_clearance: boolean;
  clearance_level?: string;
  sponsoring_agency?: string;
  cage_code_cleared?: string;
  safeguarding_capability?: string;
}

export default function CertificationsPage() {
  const router = useRouter();
  const { selectedCompany, selectedCompanyId } = useCompany();
  const { fetchWithCompany } = useFetchWithCompany();
  const [activeTab, setActiveTab] = useState<TabType>('certifications');
  const [loading, setLoading] = useState(true);
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [naicsCodes, setNaicsCodes] = useState<NaicsCode[]>([]);
  const [contractVehicles, setContractVehicles] = useState<ContractVehicle[]>([]);
  const [facilityClearance, setFacilityClearance] = useState<FacilityClearance | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

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
      const response = await fetchWithCompany('/api/company/certifications');
      const data = await response.json();
      setCertifications(data.certifications || []);
      setNaicsCodes(data.naicsCodes || []);
      setContractVehicles(data.contractVehicles || []);
      setFacilityClearance(data.facilityClearance || { has_facility_clearance: false });
    } catch (error) {
      console.error('Error fetching certifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, type: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
      await fetchWithCompany(`/api/company/certifications/${id}?type=${type}`, {
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
            Please select a company from the header to manage certifications.
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
        <h1 className="text-4xl font-bold mb-2">Certifications & Registrations</h1>
        <p className="text-gray-600">Manage your company's certifications, NAICS codes, contract vehicles, and facility clearance</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('certifications')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'certifications'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Small Business Certifications ({certifications.length})
          </button>
          <button
            onClick={() => setActiveTab('naics')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'naics'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            NAICS Codes ({naicsCodes.length})
          </button>
          <button
            onClick={() => setActiveTab('vehicles')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'vehicles'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Contract Vehicles ({contractVehicles.length})
          </button>
          <button
            onClick={() => setActiveTab('clearance')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'clearance'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Facility Clearance
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'certifications' && (
        <CertificationsTab
          certifications={certifications}
          onDelete={handleDelete}
          onAdd={() => setShowAddModal(true)}
          onRefresh={fetchData}
        />
      )}

      {activeTab === 'naics' && (
        <NaicsTab
          naicsCodes={naicsCodes}
          onDelete={handleDelete}
          onRefresh={fetchData}
        />
      )}

      {activeTab === 'vehicles' && (
        <VehiclesTab
          vehicles={contractVehicles}
          onDelete={handleDelete}
          onRefresh={fetchData}
        />
      )}

      {activeTab === 'clearance' && (
        <ClearanceTab
          clearance={facilityClearance}
          onRefresh={fetchData}
        />
      )}
    </main>
  );
}

function CertificationsTab({ certifications, onDelete, onRefresh }: any) {
  const { fetchWithCompany } = useFetchWithCompany();
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    certification_type: '',
    certifying_agency: '',
    certification_number: '',
    effective_date: '',
    expiration_date: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchWithCompany('/api/company/certifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'certification', ...formData }),
      });
      setShowAddForm(false);
      setFormData({
        certification_type: '',
        certifying_agency: '',
        certification_number: '',
        effective_date: '',
        expiration_date: '',
      });
      onRefresh();
    } catch (error) {
      console.error('Error adding certification:', error);
    }
  };

  const certificationTypes = [
    '8(a) Business Development Program',
    'HUBZone',
    'Service-Disabled Veteran-Owned Small Business (SDVOSB)',
    'Veteran-Owned Small Business (VOSB)',
    'Women-Owned Small Business (WOSB)',
    'Economically Disadvantaged WOSB (EDWOSB)',
    'Small Disadvantaged Business (SDB)',
    'Minority-Owned Business',
    'LGBT Business Enterprise',
    'AbilityOne',
  ];

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <p className="text-gray-600">
          Small business certifications and set-asides that qualify you for specific opportunities
        </p>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
        >
          {showAddForm ? 'Cancel' : '+ Add Certification'}
        </button>
      </div>

      {showAddForm && (
        <div className="bg-white shadow-md rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Add Certification</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Certification Type *
              </label>
              <select
                required
                value={formData.certification_type}
                onChange={(e) => setFormData({ ...formData, certification_type: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a certification type</option>
                {certificationTypes.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Certifying Agency
                </label>
                <input
                  type="text"
                  value={formData.certifying_agency}
                  onChange={(e) => setFormData({ ...formData, certifying_agency: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="SBA, VA CVE, Self-Certified"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Certification Number
                </label>
                <input
                  type="text"
                  value={formData.certification_number}
                  onChange={(e) => setFormData({ ...formData, certification_number: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Effective Date
                </label>
                <input
                  type="date"
                  value={formData.effective_date}
                  onChange={(e) => setFormData({ ...formData, effective_date: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Expiration Date
                </label>
                <input
                  type="date"
                  value={formData.expiration_date}
                  onChange={(e) => setFormData({ ...formData, expiration_date: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <button
              type="submit"
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
            >
              Add Certification
            </button>
          </form>
        </div>
      )}

      {certifications.length === 0 ? (
        <div className="bg-white shadow-md rounded-lg p-8 text-center">
          <div className="mb-4 flex justify-center">
            <ScrollText className="h-16 w-16 text-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-2">No Certifications Yet</h2>
          <p className="text-gray-600 mb-4">
            Add your small business certifications and set-asides to qualify for specific opportunities.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {certifications.map((cert: Certification) => (
            <div key={cert.id} className="bg-white shadow-md rounded-lg p-6">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold mb-2">{cert.certification_type}</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    {cert.certifying_agency && (
                      <div>
                        <span className="text-gray-500">Agency:</span>
                        <p className="font-medium">{cert.certifying_agency}</p>
                      </div>
                    )}
                    {cert.certification_number && (
                      <div>
                        <span className="text-gray-500">Number:</span>
                        <p className="font-medium">{cert.certification_number}</p>
                      </div>
                    )}
                    {cert.effective_date && (
                      <div>
                        <span className="text-gray-500">Effective:</span>
                        <p className="font-medium">{new Date(cert.effective_date).toLocaleDateString()}</p>
                      </div>
                    )}
                    {cert.expiration_date && (
                      <div>
                        <span className="text-gray-500">Expires:</span>
                        <p className="font-medium">{new Date(cert.expiration_date).toLocaleDateString()}</p>
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => onDelete(cert.id, 'certification')}
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

function NaicsTab({ naicsCodes, onDelete, onRefresh }: any) {
  const { fetchWithCompany } = useFetchWithCompany();
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    title: '',
    size_standard: '',
    is_primary: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchWithCompany('/api/company/certifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'naics', ...formData }),
      });
      setShowAddForm(false);
      setFormData({ code: '', title: '', size_standard: '', is_primary: false });
      onRefresh();
    } catch (error) {
      console.error('Error adding NAICS code:', error);
    }
  };

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <p className="text-gray-600">
          NAICS codes your company is registered for in SAM.gov
        </p>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
        >
          {showAddForm ? 'Cancel' : '+ Add NAICS Code'}
        </button>
      </div>

      {showAddForm && (
        <div className="bg-white shadow-md rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Add NAICS Code</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  NAICS Code * (6 digits)
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="541512"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Size Standard
                </label>
                <input
                  type="text"
                  value={formData.size_standard}
                  onChange={(e) => setFormData({ ...formData, size_standard: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="$30M"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Title *
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                placeholder="Computer Systems Design Services"
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                checked={formData.is_primary}
                onChange={(e) => setFormData({ ...formData, is_primary: e.target.checked })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label className="ml-2 block text-sm text-gray-900">
                Set as Primary NAICS Code
              </label>
            </div>

            <button
              type="submit"
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
            >
              Add NAICS Code
            </button>
          </form>
        </div>
      )}

      {naicsCodes.length === 0 ? (
        <div className="bg-white shadow-md rounded-lg p-8 text-center">
          <div className="mb-4 flex justify-center">
            <Building2 className="h-16 w-16 text-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-2">No NAICS Codes Yet</h2>
          <p className="text-gray-600 mb-4">
            Add the NAICS codes your company is registered for in SAM.gov
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {naicsCodes.map((naics: NaicsCode) => (
            <div key={naics.id} className="bg-white shadow-md rounded-lg p-6">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold">{naics.code}</h3>
                    {naics.is_primary && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded">
                        PRIMARY
                      </span>
                    )}
                  </div>
                  <p className="text-gray-700 mb-2">{naics.title}</p>
                  {naics.size_standard && (
                    <p className="text-sm text-gray-500">Size Standard: {naics.size_standard}</p>
                  )}
                </div>
                <button
                  onClick={() => onDelete(naics.id, 'naics')}
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

function VehiclesTab({ vehicles, onDelete, onRefresh }: any) {
  const { fetchWithCompany } = useFetchWithCompany();
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    vehicle_name: '',
    contract_number: '',
    vehicle_type: 'GWAC' as const,
    ordering_period_end: '',
    ceiling_value: 0,
    remaining_ceiling: 0,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchWithCompany('/api/company/certifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'vehicle', ...formData, labor_categories: [] }),
      });
      setShowAddForm(false);
      setFormData({
        vehicle_name: '',
        contract_number: '',
        vehicle_type: 'GWAC',
        ordering_period_end: '',
        ceiling_value: 0,
        remaining_ceiling: 0,
      });
      onRefresh();
    } catch (error) {
      console.error('Error adding contract vehicle:', error);
    }
  };

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <p className="text-gray-600">
          Contract vehicles your company holds (GWACs, IDIQs, GSA Schedules, etc.)
        </p>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
        >
          {showAddForm ? 'Cancel' : '+ Add Vehicle'}
        </button>
      </div>

      {showAddForm && (
        <div className="bg-white shadow-md rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Add Contract Vehicle</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Vehicle Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.vehicle_name}
                  onChange={(e) => setFormData({ ...formData, vehicle_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="GSA MAS, CIO-SP3, Alliant 2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contract Number
                </label>
                <input
                  type="text"
                  value={formData.contract_number}
                  onChange={(e) => setFormData({ ...formData, contract_number: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Vehicle Type *
                </label>
                <select
                  required
                  value={formData.vehicle_type}
                  onChange={(e) => setFormData({ ...formData, vehicle_type: e.target.value as any })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  <option value="GWAC">GWAC</option>
                  <option value="BPA">BPA</option>
                  <option value="IDIQ">IDIQ</option>
                  <option value="GSA Schedule">GSA Schedule</option>
                  <option value="State/Local Vehicle">State/Local Vehicle</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ordering Period End
                </label>
                <input
                  type="date"
                  value={formData.ordering_period_end}
                  onChange={(e) => setFormData({ ...formData, ordering_period_end: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ceiling Value
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.ceiling_value}
                  onChange={(e) => setFormData({ ...formData, ceiling_value: parseFloat(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Remaining Ceiling
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.remaining_ceiling}
                  onChange={(e) => setFormData({ ...formData, remaining_ceiling: parseFloat(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <button
              type="submit"
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
            >
              Add Contract Vehicle
            </button>
          </form>
        </div>
      )}

      {vehicles.length === 0 ? (
        <div className="bg-white shadow-md rounded-lg p-8 text-center">
          <div className="mb-4 flex justify-center">
            <Car className="h-16 w-16 text-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-2">No Contract Vehicles Yet</h2>
          <p className="text-gray-600 mb-4">
            Add contract vehicles your company holds (GWACs, IDIQs, GSA Schedules, etc.)
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {vehicles.map((vehicle: ContractVehicle) => (
            <div key={vehicle.id} className="bg-white shadow-md rounded-lg p-6">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold mb-2">{vehicle.vehicle_name}</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Type:</span>
                      <p className="font-medium">{vehicle.vehicle_type}</p>
                    </div>
                    {vehicle.contract_number && (
                      <div>
                        <span className="text-gray-500">Contract #:</span>
                        <p className="font-medium">{vehicle.contract_number}</p>
                      </div>
                    )}
                    {vehicle.ceiling_value && (
                      <div>
                        <span className="text-gray-500">Ceiling:</span>
                        <p className="font-medium">${vehicle.ceiling_value.toLocaleString()}</p>
                      </div>
                    )}
                    {vehicle.ordering_period_end && (
                      <div>
                        <span className="text-gray-500">Ends:</span>
                        <p className="font-medium">{new Date(vehicle.ordering_period_end).toLocaleDateString()}</p>
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => onDelete(vehicle.id, 'vehicle')}
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

function ClearanceTab({ clearance, onRefresh }: any) {
  const { fetchWithCompany } = useFetchWithCompany();
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState(clearance || {
    has_facility_clearance: false,
    clearance_level: '',
    sponsoring_agency: '',
    cage_code_cleared: '',
    safeguarding_capability: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchWithCompany('/api/company/certifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'facility_clearance', ...formData }),
      });
      setEditing(false);
      onRefresh();
    } catch (error) {
      console.error('Error updating facility clearance:', error);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <p className="text-gray-600">
          Facility security clearance information for handling classified information
        </p>
      </div>

      <div className="bg-white shadow-md rounded-lg p-6">
        {!editing ? (
          <div>
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-semibold">Facility Clearance Status</h3>
              <button
                onClick={() => setEditing(true)}
                className="text-blue-600 hover:underline"
              >
                Edit
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <span className="text-gray-500">Has Facility Clearance:</span>
                <p className="font-medium">{formData.has_facility_clearance ? 'Yes' : 'No'}</p>
              </div>

              {formData.has_facility_clearance && (
                <>
                  {formData.clearance_level && (
                    <div>
                      <span className="text-gray-500">Clearance Level:</span>
                      <p className="font-medium">{formData.clearance_level}</p>
                    </div>
                  )}
                  {formData.sponsoring_agency && (
                    <div>
                      <span className="text-gray-500">Sponsoring Agency:</span>
                      <p className="font-medium">{formData.sponsoring_agency}</p>
                    </div>
                  )}
                  {formData.cage_code_cleared && (
                    <div>
                      <span className="text-gray-500">Cleared CAGE Code:</span>
                      <p className="font-medium">{formData.cage_code_cleared}</p>
                    </div>
                  )}
                  {formData.safeguarding_capability && (
                    <div>
                      <span className="text-gray-500">Safeguarding Capability:</span>
                      <p className="font-medium">{formData.safeguarding_capability}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center mb-4">
              <input
                type="checkbox"
                checked={formData.has_facility_clearance}
                onChange={(e) => setFormData({ ...formData, has_facility_clearance: e.target.checked })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label className="ml-2 block text-sm font-medium text-gray-900">
                Company has facility security clearance
              </label>
            </div>

            {formData.has_facility_clearance && (
              <div className="space-y-4 pl-6 border-l-2 border-blue-200">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Clearance Level
                  </label>
                  <select
                    value={formData.clearance_level}
                    onChange={(e) => setFormData({ ...formData, clearance_level: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select level</option>
                    <option value="Confidential">Confidential</option>
                    <option value="Secret">Secret</option>
                    <option value="Top Secret">Top Secret</option>
                    <option value="TS/SCI">TS/SCI</option>
                  </select>
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cleared CAGE Code
                  </label>
                  <input
                    type="text"
                    maxLength={5}
                    value={formData.cage_code_cleared}
                    onChange={(e) => setFormData({ ...formData, cage_code_cleared: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Safeguarding Capability
                  </label>
                  <select
                    value={formData.safeguarding_capability}
                    onChange={(e) => setFormData({ ...formData, safeguarding_capability: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select capability</option>
                    <option value="Confidential">Confidential</option>
                    <option value="Secret">Secret</option>
                    <option value="Top Secret">Top Secret</option>
                  </select>
                </div>
              </div>
            )}

            <div className="flex gap-4">
              <button
                type="submit"
                className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setFormData(clearance);
                }}
                className="px-6 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
