import { NextRequest, NextResponse } from 'next/server';

/**
 * Extracts the company_id from request headers
 * Returns the company_id or throws an error response
 */
export function getCompanyIdFromRequest(request: NextRequest): string {
  const companyId = request.headers.get('X-Company-Id');
  
  if (!companyId) {
    throw NextResponse.json(
      { error: 'No company selected. Please select a company first.' },
      { status: 400 }
    );
  }
  
  return companyId;
}

/**
 * Creates a fetch wrapper that automatically includes the company_id header
 * Usage in client components:
 * 
 * const { selectedCompanyId } = useCompany();
 * const response = await fetchWithCompany('/api/company/profile', selectedCompanyId);
 */
export function createFetchWithCompany(companyId: string | null) {
  return async (url: string, options?: RequestInit) => {
    const headers = new Headers(options?.headers);
    
    if (companyId) {
      headers.set('X-Company-Id', companyId);
    }
    
    return fetch(url, {
      ...options,
      headers,
    });
  };
}

/**
 * Hook for client-side components to easily fetch with company context
 */
export function useFetchWithCompany() {
  // This will be imported in client components
  // For now, returning the creator function
  return { createFetchWithCompany };
}
