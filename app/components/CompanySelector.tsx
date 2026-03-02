'use client';

import { Building2, AlertTriangle } from 'lucide-react';
import { useCompany } from '@/lib/context/CompanyContext';
import { useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';

export default function CompanySelector() {
  const { selectedCompany, companies, selectCompany, loading } = useCompany();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredCompanies = companies.filter((company) =>
    company.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    company.cage_code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectCompany = (companyId: string) => {
    selectCompany(companyId);
    setIsOpen(false);
    setSearchQuery('');
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
        <span className="text-sm text-gray-600">Loading companies...</span>
      </div>
    );
  }

  if (companies.length === 0) {
    return (
      <div className="flex items-center gap-3">
        <div className="px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-lg">
          <span className="text-sm text-yellow-800">No companies yet</span>
        </div>
        <button
          onClick={() => router.push('/company?newIntake=1')}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          + Create First Company
        </button>
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Selected Company Display */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:border-blue-500 transition-colors min-w-[280px]"
      >
        <Building2 className="h-5 w-5 text-primary" />
        <div className="flex-1 text-left">
          {selectedCompany ? (
            <>
              <div className="text-sm font-semibold text-gray-900">
                {selectedCompany.company_name}
              </div>
              <div className="text-xs text-gray-500">
                CAGE: {selectedCompany.cage_code}
              </div>
            </>
          ) : (
            <div className="text-sm text-gray-500">Select a company...</div>
          )}
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full mt-2 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-96 overflow-hidden">
          {/* Search Input */}
          <div className="p-3 border-b border-gray-200">
            <input
              type="text"
              placeholder="Search companies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>

          {/* Companies List */}
          <div className="overflow-y-auto max-h-64">
            {filteredCompanies.length === 0 ? (
              <div className="p-4 text-center text-sm text-gray-500">
                No companies found
              </div>
            ) : (
              filteredCompanies.map((company) => (
                <button
                  key={company.id}
                  onClick={() => handleSelectCompany(company.id)}
                  className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0 ${
                    selectedCompany?.id === company.id ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">
                        {company.company_name}
                      </div>
                      <div className="text-xs text-gray-500">
                        CAGE: {company.cage_code} | UEI: {company.uei_number}
                      </div>
                    </div>
                    {selectedCompany?.id === company.id && (
                      <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </div>
                  {company.completeness_score < 70 && (
                    <div className="mt-1 flex items-center gap-1 text-xs text-warning-foreground">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      {company.completeness_score}% complete
                    </div>
                  )}
                </button>
              ))
            )}
          </div>

          {/* Actions */}
          <div className="p-3 border-t border-gray-200 bg-gray-50">
            <div className="flex gap-2">
              <button
                onClick={() => {
                  router.push('/companies');
                  setIsOpen(false);
                }}
                className="flex-1 px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Manage Companies
              </button>
              <button
                onClick={() => {
                  router.push('/company?newIntake=1');
                  setIsOpen(false);
                }}
                className="flex-1 px-3 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                + New Company
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
