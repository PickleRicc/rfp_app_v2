'use client';

import { useCompany } from '../context/CompanyContext';

/**
 * Custom hook that provides a fetch function with automatic company_id header injection
 */
export function useFetchWithCompany() {
  const { selectedCompanyId } = useCompany();

  const fetchWithCompany = async (url: string, options?: RequestInit) => {
    const headers = new Headers(options?.headers);
    
    if (selectedCompanyId) {
      headers.set('X-Company-Id', selectedCompanyId);
    }
    
    return fetch(url, {
      ...options,
      headers,
    });
  };

  return { fetchWithCompany, selectedCompanyId };
}
