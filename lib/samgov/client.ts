/**
 * SAM.gov Opportunities API Client
 *
 * Searches the SAM.gov Get Opportunities Public API v2 for active
 * federal contract opportunities matching the given criteria.
 *
 * API Docs: https://open.gsa.gov/api/get-opportunities-public-api/
 */

const SAM_API_BASE = 'https://api.sam.gov/opportunities/v2/search';

/** Procurement/notice type codes */
export const PTYPE = {
  PRESOLICITATION: 'p',
  SOLICITATION: 'o',
  COMBINED_SYNOPSIS: 'k',
  SOURCES_SOUGHT: 'r',
  SPECIAL_NOTICE: 's',
  AWARD_NOTICE: 'a',
} as const;

/** Set-aside type codes recognized by SAM.gov */
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

export interface SamSearchParams {
  /** NAICS codes to search (will run separate queries per code) */
  naicsCodes?: string[];
  /** Title keyword search */
  titleKeyword?: string;
  /** Set-aside type code */
  setAside?: string;
  /** Department name */
  department?: string;
  /** Place of performance state */
  state?: string;
  /** Procurement types to include */
  ptypes?: string[];
  /** Number of results per query (max 1000) */
  limit?: number;
  /** Date range start (MM/DD/YYYY) */
  postedFrom?: string;
  /** Date range end (MM/DD/YYYY) */
  postedTo?: string;
}

export interface SamApiOpportunity {
  noticeId: string;
  title: string;
  solicitationNumber?: string;
  department?: string;
  subTier?: string;
  office?: string;
  postedDate: string;
  responseDeadLine?: string;
  type: string;
  baseType?: string;
  naicsCode?: string;
  classificationCode?: string;
  typeOfSetAside?: string;
  typeOfSetAsideDescription?: string;
  active: string;
  description?: string;
  resourceLinks?: string[];
  pointOfContact?: Array<{
    type?: string;
    fullName?: string;
    email?: string;
    phone?: string;
    title?: string;
  }>;
  placeOfPerformance?: {
    state?: { code?: string; name?: string };
    zip?: string;
    city?: { code?: string; name?: string };
  };
  award?: {
    date?: string;
    number?: string;
    amount?: string;
    awardee?: { name?: string; ueiSAM?: string };
  };
  fullParentPathName?: string;
}

interface SamApiResponse {
  totalRecords: number;
  limit: number;
  offset: number;
  opportunitiesData: SamApiOpportunity[];
}

function formatDate(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const y = date.getFullYear();
  return `${m}/${d}/${y}`;
}

/**
 * Search SAM.gov opportunities API.
 * Returns raw API results. If no API key is configured, returns empty results.
 */
export async function searchSamOpportunities(
  params: SamSearchParams
): Promise<{ opportunities: SamApiOpportunity[]; totalRecords: number }> {
  const apiKey = process.env.SAM_GOV_API_KEY;
  if (!apiKey) {
    console.warn('[sam-client] SAM_GOV_API_KEY not configured — returning empty results');
    return { opportunities: [], totalRecords: 0 };
  }

  const now = new Date();
  const threeMonthsAgo = new Date(now);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  const postedFrom = params.postedFrom || formatDate(threeMonthsAgo);
  const postedTo = params.postedTo || formatDate(now);
  const limit = Math.min(params.limit || 100, 1000);
  const ptypes = params.ptypes || [PTYPE.SOLICITATION, PTYPE.COMBINED_SYNOPSIS, PTYPE.PRESOLICITATION];

  const allOpportunities: SamApiOpportunity[] = [];
  const seenIds = new Set<string>();

  // Build queries — one per NAICS code, plus a keyword-only query if provided
  const queries: URLSearchParams[] = [];

  const buildBaseParams = (): URLSearchParams => {
    const p = new URLSearchParams();
    p.set('api_key', apiKey);
    p.set('postedFrom', postedFrom);
    p.set('postedTo', postedTo);
    p.set('limit', String(limit));
    p.set('offset', '0');
    for (const pt of ptypes) {
      p.append('ptype', pt);
    }
    if (params.setAside) p.set('typeOfSetAside', params.setAside);
    if (params.department) p.set('deptname', params.department);
    if (params.state) p.set('state', params.state);
    return p;
  };

  // Query per NAICS code
  if (params.naicsCodes && params.naicsCodes.length > 0) {
    for (const ncode of params.naicsCodes) {
      const p = buildBaseParams();
      p.set('ncode', ncode);
      if (params.titleKeyword) p.set('title', params.titleKeyword);
      queries.push(p);
    }
  }

  // If we have a title keyword but no NAICS, do a title-only search
  if (params.titleKeyword && (!params.naicsCodes || params.naicsCodes.length === 0)) {
    const p = buildBaseParams();
    p.set('title', params.titleKeyword);
    queries.push(p);
  }

  // If we have neither, do a broad search with just set-aside/date filters
  if (queries.length === 0) {
    queries.push(buildBaseParams());
  }

  let totalRecords = 0;

  for (const queryParams of queries) {
    try {
      const url = `${SAM_API_BASE}?${queryParams.toString()}`;
      console.log(`[sam-client] Fetching: ${SAM_API_BASE}?ncode=${queryParams.get('ncode') || 'none'}&title=${queryParams.get('title') || 'none'}`);

      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
      });

      if (!res.ok) {
        console.error(`[sam-client] API error ${res.status}: ${await res.text().catch(() => 'no body')}`);
        continue;
      }

      const data: SamApiResponse = await res.json();
      totalRecords += data.totalRecords || 0;

      for (const opp of data.opportunitiesData || []) {
        if (!seenIds.has(opp.noticeId)) {
          seenIds.add(opp.noticeId);
          allOpportunities.push(opp);
        }
      }
    } catch (err) {
      console.error('[sam-client] Fetch error:', err);
    }
  }

  return { opportunities: allOpportunities, totalRecords };
}

/**
 * Run multiple search strategies to maximize opportunity coverage.
 * Searches by NAICS codes, then by keywords, then by set-asides.
 */
export async function comprehensiveOpportunitySearch(params: {
  naicsCodes: string[];
  keywords: string[];
  setAsideCodes: string[];
  state?: string;
  limit?: number;
}): Promise<{ opportunities: SamApiOpportunity[]; totalSearched: number }> {
  const allOpps: SamApiOpportunity[] = [];
  const seenIds = new Set<string>();
  let totalSearched = 0;

  const addResults = (opps: SamApiOpportunity[]) => {
    for (const opp of opps) {
      if (!seenIds.has(opp.noticeId)) {
        seenIds.add(opp.noticeId);
        allOpps.push(opp);
      }
    }
  };

  // Strategy 1: Search by NAICS codes (most targeted)
  if (params.naicsCodes.length > 0) {
    const result = await searchSamOpportunities({
      naicsCodes: params.naicsCodes.slice(0, 5), // Cap at 5 NAICS queries
      limit: params.limit || 100,
      state: params.state,
    });
    addResults(result.opportunities);
    totalSearched += result.totalRecords;
  }

  // Strategy 2: Search by keywords (top 3)
  for (const keyword of params.keywords.slice(0, 3)) {
    const result = await searchSamOpportunities({
      titleKeyword: keyword,
      limit: 50,
      state: params.state,
    });
    addResults(result.opportunities);
    totalSearched += result.totalRecords;
  }

  // Strategy 3: NAICS + set-aside combo (most qualified leads)
  for (const setAside of params.setAsideCodes.slice(0, 2)) {
    if (params.naicsCodes.length > 0) {
      const result = await searchSamOpportunities({
        naicsCodes: [params.naicsCodes[0]],
        setAside,
        limit: 50,
        state: params.state,
      });
      addResults(result.opportunities);
      totalSearched += result.totalRecords;
    }
  }

  return { opportunities: allOpps, totalSearched };
}
