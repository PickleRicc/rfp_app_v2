/**
 * Tango API Client — Opportunity Search
 *
 * Uses the MakeGov Tango API to search for active federal contract
 * opportunities. Tango unifies SAM.gov, FPDS, USAspending data behind
 * a single API with full-text search and smart filtering.
 *
 * Docs: https://tango.makegov.com/docs/
 * SDK:  @makegov/tango-node
 */

import { TangoClient, ShapeConfig } from '@makegov/tango-node';
import type { PaginatedResponse } from '@makegov/tango-node';

/** Set-aside type codes */
export const SET_ASIDE_CODES: Record<string, string> = {
  SBA: 'Total Small Business Set-Aside',
  SBP: 'Partial Small Business Set-Aside',
  '8A': '8(a) Set-Aside',
  '8AN': '8(a) Sole Source',
  HZC: 'HUBZone Set-Aside',
  HZS: 'HUBZone Sole Source',
  SDVOSBC: 'SDVOSB Set-Aside',
  SDVOSBS: 'SDVOSB Sole Source',
  WOSB: 'Women-Owned Small Business',
  WOSBSS: 'WOSB Sole Source',
  EDWOSB: 'Economically Disadvantaged WOSB',
  EDWOSBSS: 'EDWOSB Sole Source',
  VSA: 'Veteran Set-Aside',
  VSS: 'Veteran Sole Source',
};

/** Shape string requesting all fields we need for opportunity scoring */
const OPPORTUNITY_FULL_SHAPE =
  'opportunity_id,title,solicitation_number,description,response_deadline,active,' +
  'naics_code,psc_code';

export interface TangoOpportunity {
  opportunity_id: string;
  title: string;
  solicitation_number?: string | null;
  description?: string | null;
  response_deadline?: string | null;
  active?: boolean | null;
  naics_code?: string | null;
  psc_code?: string | null;
  // Additional fields that may be returned by the API
  [key: string]: unknown;
}

function getClient(): TangoClient | null {
  const apiKey = process.env.TANGO_API_KEY;
  if (!apiKey) {
    console.warn('[tango-client] TANGO_API_KEY not configured — returning empty results');
    return null;
  }
  return new TangoClient({ apiKey });
}

/**
 * Search Tango API for opportunities matching a query.
 */
export async function searchOpportunities(params: {
  keyword?: string;
  naicsCode?: string;
  setAside?: string;
  active?: boolean;
  limit?: number;
  page?: number;
}): Promise<{ opportunities: TangoOpportunity[]; totalRecords: number }> {
  const client = getClient();
  if (!client) return { opportunities: [], totalRecords: 0 };

  const limit = Math.min(params.limit || 100, 100);

  try {
    const filters: Record<string, unknown> = {
      shape: OPPORTUNITY_FULL_SHAPE,
      limit,
      page: params.page || 1,
    };

    // Apply filters — Tango passes these through as query params
    if (params.keyword) filters.search = params.keyword;
    if (params.naicsCode) filters.naics_code = params.naicsCode;
    if (params.setAside) filters.set_aside = params.setAside;
    if (params.active !== undefined) filters.active = params.active;

    console.log(`[tango-client] Searching opportunities: keyword=${params.keyword || 'none'}, naics=${params.naicsCode || 'none'}, set_aside=${params.setAside || 'none'}`);

    const result: PaginatedResponse<Record<string, unknown>> = await client.listOpportunities(filters);

    const opportunities: TangoOpportunity[] = (result.results || []).map((r) => ({
      opportunity_id: String(r.opportunity_id || ''),
      title: String(r.title || ''),
      solicitation_number: r.solicitation_number as string | null,
      description: r.description as string | null,
      response_deadline: r.response_deadline as string | null,
      active: r.active as boolean | null,
      naics_code: r.naics_code as string | null,
      psc_code: r.psc_code as string | null,
      ...r,
    }));

    return { opportunities, totalRecords: result.count || opportunities.length };
  } catch (err) {
    console.error('[tango-client] Search error:', err);
    return { opportunities: [], totalRecords: 0 };
  }
}

/**
 * Run multiple search strategies to maximize opportunity coverage.
 * Searches by NAICS codes, then by keywords, then by set-aside combos.
 */
export async function comprehensiveOpportunitySearch(params: {
  naicsCodes: string[];
  keywords: string[];
  setAsideCodes: string[];
  state?: string;
  limit?: number;
}): Promise<{ opportunities: TangoOpportunity[]; totalSearched: number }> {
  const allOpps: TangoOpportunity[] = [];
  const seenIds = new Set<string>();
  let totalSearched = 0;

  const addResults = (opps: TangoOpportunity[]) => {
    for (const opp of opps) {
      if (opp.opportunity_id && !seenIds.has(opp.opportunity_id)) {
        seenIds.add(opp.opportunity_id);
        allOpps.push(opp);
      }
    }
  };

  // Strategy 1: Search by each NAICS code (most targeted)
  for (const naics of params.naicsCodes.slice(0, 5)) {
    const result = await searchOpportunities({
      naicsCode: naics,
      active: true,
      limit: params.limit || 100,
    });
    addResults(result.opportunities);
    totalSearched += result.totalRecords;
  }

  // Strategy 2: Search by keywords (top 3)
  for (const keyword of params.keywords.slice(0, 3)) {
    const result = await searchOpportunities({
      keyword,
      active: true,
      limit: 50,
    });
    addResults(result.opportunities);
    totalSearched += result.totalRecords;
  }

  // Strategy 3: NAICS + set-aside combo (most qualified leads)
  for (const setAside of params.setAsideCodes.slice(0, 2)) {
    if (params.naicsCodes.length > 0) {
      const result = await searchOpportunities({
        naicsCode: params.naicsCodes[0],
        setAside,
        active: true,
        limit: 50,
      });
      addResults(result.opportunities);
      totalSearched += result.totalRecords;
    }
  }

  return { opportunities: allOpps, totalSearched };
}
