'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface CompanyProfile {
  id: string;
  company_name: string;
  legal_name: string;
  cage_code: string;
  uei_number: string;
  elevator_pitch: string;
  completeness_score: number;
}

interface CompanyContextType {
  selectedCompanyId: string | null;
  selectedCompany: CompanyProfile | null;
  companies: CompanyProfile[];
  selectCompany: (companyId: string) => void;
  refreshCompanies: () => Promise<void>;
  loading: boolean;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

const STORAGE_KEY = 'rfp_app_selected_company_id';

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<CompanyProfile | null>(null);
  const [companies, setCompanies] = useState<CompanyProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Load companies on mount
  useEffect(() => {
    loadCompanies();
  }, []);

  // Load selected company from localStorage on mount
  useEffect(() => {
    const savedCompanyId = localStorage.getItem(STORAGE_KEY);
    if (savedCompanyId) {
      setSelectedCompanyId(savedCompanyId);
    }
  }, []);

  // Update selected company details when ID changes
  useEffect(() => {
    if (selectedCompanyId && companies.length > 0) {
      const company = companies.find(c => c.id === selectedCompanyId);
      setSelectedCompany(company || null);
      
      // If company not found in list, clear selection
      if (!company) {
        setSelectedCompanyId(null);
        localStorage.removeItem(STORAGE_KEY);
      }
    } else {
      setSelectedCompany(null);
    }
  }, [selectedCompanyId, companies]);

  const loadCompanies = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/companies');
      if (response.ok) {
        const data = await response.json();
        setCompanies(data.companies || []);
        
        // If no company selected but companies exist, select the first one
        const savedCompanyId = localStorage.getItem(STORAGE_KEY);
        if (!savedCompanyId && data.companies && data.companies.length > 0) {
          selectCompany(data.companies[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to load companies:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectCompany = (companyId: string) => {
    setSelectedCompanyId(companyId);
    localStorage.setItem(STORAGE_KEY, companyId);
  };

  const refreshCompanies = async () => {
    await loadCompanies();
  };

  return (
    <CompanyContext.Provider
      value={{
        selectedCompanyId,
        selectedCompany,
        companies,
        selectCompany,
        refreshCompanies,
        loading,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
}
