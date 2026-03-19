/**
 * USASpending.gov API Client
 *
 * Free public API — no key required.
 * Docs: https://api.usaspending.gov/
 *
 * Used for pre-sales research: pull a company's federal contract history,
 * spending trends, agency relationships, and incumbent data.
 */

const BASE_URL = 'https://api.usaspending.gov/api/v2';

// ── Types ────────────────────────────────────────────────

export interface USASpendingAward {
  award_id: string;
  generated_internal_id: string;
  piid: string | null;
  fain: string | null;
  type: string;
  type_description: string;
  description: string | null;
  total_obligation: number;
  date_signed: string | null;
  period_of_performance_start_date: string | null;
  period_of_performance_current_end_date: string | null;
  awarding_agency_name: string | null;
  awarding_sub_agency_name: string | null;
  funding_agency_name: string | null;
  recipient_name: string | null;
  recipient_uei: string | null;
  naics_code: string | null;
  naics_description: string | null;
  psc_code: string | null;
  place_of_performance_city: string | null;
  place_of_performance_state: string | null;
}

export interface USASpendingRecipient {
  id: string;
  name: string;
  uei: string | null;
  duns: string | null;
  recipient_level: string;
  amount: number;
}

export interface AgencySpendingSummary {
  agency_name: string;
  total_obligation: number;
  award_count: number;
}

export interface USASpendingCompanyReport {
  recipient_name: string | null;
  recipient_id: string | null;
  total_awards: number;
  total_obligation: number;
  awards: USASpendingAward[];
  agency_breakdown: AgencySpendingSummary[];
  naics_breakdown: { code: string; description: string; amount: number; count: number }[];
  recent_awards: USASpendingAward[];
  largest_awards: USASpendingAward[];
}

// ── API Helpers ──────────────────────────────────────────

async function post<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error(`[usaspending] ${endpoint} failed (${res.status}):`, text.slice(0, 500));
    throw new Error(`USASpending API error: ${res.status}`);
  }

  return res.json();
}

async function get<T>(endpoint: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`USASpending API error: ${res.status}`);
  }

  return res.json();
}

// ── Public API ───────────────────────────────────────────

/**
 * Search for a recipient (company) by name, UEI, or CAGE code.
 */
export async function searchRecipient(query: string): Promise<USASpendingRecipient[]> {
  try {
    const data = await post<{
      results: Array<{
        id: string;
        name: string;
        uei: string | null;
        duns: string | null;
        recipient_level: string;
        amount: number;
      }>;
    }>('/recipient/autocomplete/', {
      search_text: query,
      limit: 10,
    });

    return (data.results || []).map((r) => ({
      id: r.id,
      name: r.name,
      uei: r.uei,
      duns: r.duns,
      recipient_level: r.recipient_level,
      amount: r.amount,
    }));
  } catch (err) {
    console.error('[usaspending] searchRecipient error:', err);
    return [];
  }
}

/**
 * Get contract awards for a company by recipient name or keyword filters.
 * Uses the Advanced Search (spending_by_award) endpoint.
 */
export async function getAwardsByRecipient(params: {
  recipientName?: string;
  uei?: string;
  naicsCodes?: string[];
  dateRange?: { start: string; end: string };
  limit?: number;
}): Promise<USASpendingAward[]> {
  const filters: Record<string, unknown> = {
    award_type_codes: ['A', 'B', 'C', 'D'],
  };

  if (params.recipientName) {
    filters.recipient_search_text = [params.recipientName];
  }

  if (params.naicsCodes?.length) {
    filters.naics_codes = { require: params.naicsCodes };
  }

  if (params.dateRange) {
    filters.time_period = [{
      start_date: params.dateRange.start,
      end_date: params.dateRange.end,
    }];
  } else {
    // Default: last 5 years
    const end = new Date().toISOString().split('T')[0];
    const start = new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    filters.time_period = [{ start_date: start, end_date: end }];
  }

  try {
    const data = await post<{
      results: Array<Record<string, unknown>>;
      page_metadata: { total: number };
    }>('/search/spending_by_award/', {
      filters,
      fields: [
        'Award ID', 'Recipient Name', 'Start Date', 'End Date',
        'Award Amount', 'Total Outlays', 'Description',
        'Contract Award Type', 'Awarding Agency', 'Awarding Sub Agency',
        'Funding Agency', 'NAICS Code', 'NAICS Description',
        'PSC Code', 'Place of Performance City', 'Place of Performance State Code',
        'Period of Performance Start Date', 'Period of Performance Current End Date',
        'generated_internal_id', 'recipient_id',
      ],
      limit: params.limit || 100,
      page: 1,
      sort: 'Award Amount',
      order: 'desc',
      subawards: false,
    });

    return (data.results || []).map((r) => ({
      award_id: String(r['Award ID'] || ''),
      generated_internal_id: String(r['generated_internal_id'] || ''),
      piid: r['Award ID'] as string | null,
      fain: null,
      type: String(r['Contract Award Type'] || ''),
      type_description: String(r['Contract Award Type'] || ''),
      description: r['Description'] as string | null,
      total_obligation: Number(r['Award Amount']) || 0,
      date_signed: r['Start Date'] as string | null,
      period_of_performance_start_date: r['Period of Performance Start Date'] as string | null,
      period_of_performance_current_end_date: r['Period of Performance Current End Date'] as string | null,
      awarding_agency_name: r['Awarding Agency'] as string | null,
      awarding_sub_agency_name: r['Awarding Sub Agency'] as string | null,
      funding_agency_name: r['Funding Agency'] as string | null,
      recipient_name: r['Recipient Name'] as string | null,
      recipient_uei: null,
      naics_code: r['NAICS Code'] as string | null,
      naics_description: r['NAICS Description'] as string | null,
      psc_code: r['PSC Code'] as string | null,
      place_of_performance_city: r['Place of Performance City'] as string | null,
      place_of_performance_state: r['Place of Performance State Code'] as string | null,
    }));
  } catch (err) {
    console.error('[usaspending] getAwardsByRecipient error:', err);
    return [];
  }
}

/**
 * Build a full spending report for a company.
 * Searches by name, then aggregates awards by agency and NAICS.
 */
export async function buildCompanySpendingReport(params: {
  companyName: string;
  uei?: string;
  cageCode?: string;
}): Promise<USASpendingCompanyReport> {
  // Try to find the recipient
  const searchQuery = params.uei || params.companyName;
  const recipients = await searchRecipient(searchQuery);
  const matched = recipients[0] || null;

  // Fetch awards
  const awards = await getAwardsByRecipient({
    recipientName: params.companyName,
    limit: 100,
  });

  // Aggregate by agency
  const agencyMap = new Map<string, { total: number; count: number }>();
  for (const award of awards) {
    const agency = award.awarding_agency_name || 'Unknown';
    const existing = agencyMap.get(agency) || { total: 0, count: 0 };
    existing.total += award.total_obligation;
    existing.count += 1;
    agencyMap.set(agency, existing);
  }

  const agencyBreakdown: AgencySpendingSummary[] = Array.from(agencyMap.entries())
    .map(([name, data]) => ({
      agency_name: name,
      total_obligation: data.total,
      award_count: data.count,
    }))
    .sort((a, b) => b.total_obligation - a.total_obligation);

  // Aggregate by NAICS
  const naicsMap = new Map<string, { desc: string; amount: number; count: number }>();
  for (const award of awards) {
    if (award.naics_code) {
      const existing = naicsMap.get(award.naics_code) || {
        desc: award.naics_description || '',
        amount: 0,
        count: 0,
      };
      existing.amount += award.total_obligation;
      existing.count += 1;
      naicsMap.set(award.naics_code, existing);
    }
  }

  const naicsBreakdown = Array.from(naicsMap.entries())
    .map(([code, data]) => ({
      code,
      description: data.desc,
      amount: data.amount,
      count: data.count,
    }))
    .sort((a, b) => b.amount - a.amount);

  // Sort for recent and largest
  const recentAwards = [...awards]
    .sort((a, b) => {
      const da = a.date_signed || '';
      const db = b.date_signed || '';
      return db.localeCompare(da);
    })
    .slice(0, 10);

  const largestAwards = [...awards]
    .sort((a, b) => b.total_obligation - a.total_obligation)
    .slice(0, 10);

  const totalObligation = awards.reduce((sum, a) => sum + a.total_obligation, 0);

  return {
    recipient_name: matched?.name || params.companyName,
    recipient_id: matched?.id || null,
    total_awards: awards.length,
    total_obligation: totalObligation,
    awards,
    agency_breakdown: agencyBreakdown,
    naics_breakdown: naicsBreakdown,
    recent_awards: recentAwards,
    largest_awards: largestAwards,
  };
}
