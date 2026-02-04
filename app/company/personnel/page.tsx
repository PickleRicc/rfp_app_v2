'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Mail, MapPin } from 'lucide-react';
import { useCompany } from '@/lib/context/CompanyContext';
import { useFetchWithCompany } from '@/lib/hooks/useFetchWithCompany';

interface Personnel {
  id: string;
  full_name: string;
  status: string;
  employment_type: string;
  email: string;
  clearance_level?: string;
  availability: string;
  geographic_location: string;
  total_experience_years: number;
}

export default function PersonnelList() {
  const router = useRouter();
  const { selectedCompany, selectedCompanyId } = useCompany();
  const { fetchWithCompany } = useFetchWithCompany();
  const [loading, setLoading] = useState(true);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [filteredPersonnel, setFilteredPersonnel] = useState<Personnel[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    if (selectedCompanyId) {
      fetchPersonnel();
    } else {
      setLoading(false);
    }
  }, [selectedCompanyId]);

  useEffect(() => {
    if (statusFilter === 'all') {
      setFilteredPersonnel(personnel);
    } else {
      setFilteredPersonnel(personnel.filter(p => p.status === statusFilter));
    }
  }, [statusFilter, personnel]);

  const fetchPersonnel = async () => {
    try {
      setLoading(true);
      const response = await fetchWithCompany('/api/company/personnel');
      const data = await response.json();
      setPersonnel(data.personnel || []);
      setFilteredPersonnel(data.personnel || []);
    } catch (error) {
      console.error('Error fetching personnel:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this person?')) return;

    try {
      await fetchWithCompany(`/api/company/personnel/${id}`, {
        method: 'DELETE',
      });
      fetchPersonnel();
    } catch (error) {
      console.error('Error deleting personnel:', error);
    }
  };

  if (!selectedCompany) {
    return (
      <main className="min-h-screen p-8 max-w-6xl mx-auto">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h3 className="font-semibold text-yellow-900 mb-1">No Company Selected</h3>
          <p className="text-sm text-yellow-800">
            Please select a company from the header to manage personnel.
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
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold mb-2">Personnel</h1>
            <p className="text-gray-600">Manage your team members and key personnel</p>
          </div>
          <button
            onClick={() => router.push('/company/personnel/new')}
            className="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 font-semibold"
          >
            + Add Person
          </button>
        </div>
      </div>

      {/* Status Filter */}
      <div className="mb-6 flex gap-2">
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-4 py-2 rounded-md ${
            statusFilter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All ({personnel.length})
        </button>
        {['Active', 'Available', 'Committed', 'Pending', 'Former'].map((status) => {
          const count = personnel.filter(p => p.status === status).length;
          return (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-md ${
                statusFilter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {status} ({count})
            </button>
          );
        })}
      </div>

      {personnel.length === 0 ? (
        <div className="bg-white shadow-md rounded-lg p-8 text-center">
          <div className="mb-4 flex justify-center">
            <Users className="h-16 w-16 text-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-4">No Personnel Yet</h2>
          <p className="text-gray-600 mb-6">
            Add key personnel to include in your proposals. Most RFPs require detailed information
            about your team members.
          </p>
          <button
            onClick={() => router.push('/company/personnel/new')}
            className="bg-blue-600 text-white px-8 py-3 rounded-md hover:bg-blue-700 font-semibold"
          >
            Add Your First Person
          </button>
        </div>
      ) : filteredPersonnel.length === 0 ? (
        <div className="bg-white shadow-md rounded-lg p-8 text-center">
          <p className="text-gray-600">No personnel found with status: {statusFilter}</p>
          <button
            onClick={() => setStatusFilter('all')}
            className="mt-4 text-blue-600 hover:underline"
          >
            View All Personnel
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPersonnel.map((person) => (
            <div key={person.id} className="bg-white shadow-md rounded-lg p-6">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-semibold">{person.full_name}</h3>
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                      person.status === 'Active' ? 'bg-green-100 text-green-800' :
                      person.status === 'Available' ? 'bg-blue-100 text-blue-800' :
                      person.status === 'Committed' ? 'bg-yellow-100 text-yellow-800' :
                      person.status === 'Former' ? 'bg-gray-100 text-gray-800' :
                      'bg-purple-100 text-purple-800'
                    }`}>
                      {person.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
                    <div>
                      <span className="text-gray-500">Employment:</span>
                      <p className="font-medium">{person.employment_type}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Experience:</span>
                      <p className="font-medium">{person.total_experience_years} years</p>
                    </div>
                    {person.clearance_level && person.clearance_level !== 'None' && (
                      <div>
                        <span className="text-gray-500">Clearance:</span>
                        <p className="font-medium">{person.clearance_level}</p>
                      </div>
                    )}
                    <div>
                      <span className="text-gray-500">Location:</span>
                      <p className="font-medium">{person.geographic_location}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Mail className="h-4 w-4 shrink-0" />
                      {person.email}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 shrink-0" />
                      {person.availability}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => router.push(`/company/personnel/${person.id}`)}
                    className="text-blue-600 hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(person.id)}
                    className="text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}

          {personnel.length < 5 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-yellow-800">
                <strong>Tip:</strong> Most proposals require key personnel information. Consider adding
                personnel for common roles like Program Manager, Technical Lead, and other key positions.
              </p>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
