'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCompany } from '@/lib/context/CompanyContext';

interface CompanyListItem {
  id: string;
  company_name: string;
  cage_code: string;
  uei_number: string;
  completeness_score: number;
  elevator_pitch: string;
}

export default function CompaniesListPage() {
  const router = useRouter();
  const { companies, selectCompany, selectedCompanyId, refreshCompanies } = useCompany();
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCompanies = companies.filter((company) =>
    company.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    company.cage_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    company.uei_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectAndView = (companyId: string) => {
    selectCompany(companyId);
    router.push('/company');
  };

  return (
    <main className="min-h-screen p-8 max-w-7xl mx-auto pt-4">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-4xl font-bold mb-2">All Companies</h1>
            <p className="text-gray-600">Manage all contractor companies in your system</p>
          </div>
          <button
            onClick={() => router.push('/company/profile/new')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            + Add New Company
          </button>
        </div>

        {/* Search */}
        <div className="max-w-md">
          <input
            type="text"
            placeholder="Search companies by name, CAGE, or UEI..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white shadow-md rounded-lg p-6">
          <div className="text-sm text-gray-600 mb-1">Total Companies</div>
          <div className="text-3xl font-bold text-gray-900">{companies.length}</div>
        </div>
        <div className="bg-white shadow-md rounded-lg p-6">
          <div className="text-sm text-gray-600 mb-1">Fully Complete (90%+)</div>
          <div className="text-3xl font-bold text-green-600">
            {companies.filter(c => c.completeness_score >= 90).length}
          </div>
        </div>
        <div className="bg-white shadow-md rounded-lg p-6">
          <div className="text-sm text-gray-600 mb-1">Needs Attention (&lt;70%)</div>
          <div className="text-3xl font-bold text-yellow-600">
            {companies.filter(c => c.completeness_score < 70).length}
          </div>
        </div>
      </div>

      {/* Companies List */}
      {filteredCompanies.length === 0 ? (
        <div className="bg-white shadow-md rounded-lg p-12 text-center">
          <div className="text-6xl mb-4">🏢</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {companies.length === 0 ? 'No Companies Yet' : 'No Matching Companies'}
          </h2>
          <p className="text-gray-600 mb-6">
            {companies.length === 0
              ? 'Get started by creating your first company profile'
              : 'Try adjusting your search criteria'}
          </p>
          {companies.length === 0 && (
            <button
              onClick={() => router.push('/company/profile/new')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              Create First Company
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredCompanies.map((company) => (
            <div
              key={company.id}
              className={`bg-white shadow-md rounded-lg p-6 hover:shadow-lg transition-shadow ${
                selectedCompanyId === company.id ? 'ring-2 ring-blue-500' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-bold text-gray-900">
                      {company.company_name}
                    </h3>
                    {selectedCompanyId === company.id && (
                      <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                        Currently Selected
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                    <span>CAGE: {company.cage_code}</span>
                    <span>•</span>
                    <span>UEI: {company.uei_number}</span>
                  </div>
                  <p className="text-gray-700 text-sm mb-4 line-clamp-2">
                    {company.elevator_pitch}
                  </p>

                  {/* Completeness Bar */}
                  <div>
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>Profile Completeness</span>
                      <span>{company.completeness_score}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          company.completeness_score >= 90
                            ? 'bg-green-600'
                            : company.completeness_score >= 70
                            ? 'bg-blue-600'
                            : company.completeness_score >= 40
                            ? 'bg-yellow-600'
                            : 'bg-red-600'
                        }`}
                        style={{ width: `${company.completeness_score}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="ml-6 flex flex-col gap-2">
                  {selectedCompanyId !== company.id && (
                    <button
                      onClick={() => selectCompany(company.id)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium whitespace-nowrap"
                    >
                      Select Company
                    </button>
                  )}
                  <button
                    onClick={() => handleSelectAndView(company.id)}
                    className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium whitespace-nowrap"
                  >
                    View/Edit Data
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Results Count */}
      {searchQuery && (
        <div className="mt-4 text-center text-sm text-gray-600">
          Showing {filteredCompanies.length} of {companies.length} companies
        </div>
      )}
    </main>
  );
}
