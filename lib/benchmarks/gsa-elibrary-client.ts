/**
 * GSA eLibrary Rate Lookup
 * Queries public GSA Schedule pricing data.
 * All failures return null — never throws.
 */

export interface GsaRateLookupResult {
  labor_category: string;
  rate_low: number | null;
  rate_high: number | null;
  contract_count: number;
  vintage: string;
  source: 'gsa_elibrary' | 'unavailable';
}

const GSA_API_TIMEOUT_MS = 15000;
const GSA_VINTAGE = 'GSA eLibrary 2025';

/**
 * Look up GSA Schedule rates for a labor category.
 * Uses the public GSA Advantage/eLibrary API — no API key required.
 * Returns null on any network or parse error.
 */
export async function lookupGsaRates(
  laborCategory: string
): Promise<GsaRateLookupResult | null> {
  try {
    const encoded = encodeURIComponent(laborCategory);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GSA_API_TIMEOUT_MS);

    const response = await fetch(
      `https://buy.gsa.gov/pricing/api/v1/search?q=${encoded}&schedule_sin=132-51`,
      {
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);

    if (!response.ok) return buildUnavailableResult(laborCategory);

    const data = await response.json() as {
      results?: Array<{ price?: number; labor_category?: string }>;
    };

    const results = data.results || [];
    if (results.length === 0) return buildUnavailableResult(laborCategory);

    const prices = results
      .map(r => r.price)
      .filter((p): p is number => typeof p === 'number' && p > 0)
      .sort((a, b) => a - b);

    if (prices.length === 0) return buildUnavailableResult(laborCategory);

    return {
      labor_category: laborCategory,
      rate_low: prices[0],
      rate_high: prices[prices.length - 1],
      contract_count: prices.length,
      vintage: GSA_VINTAGE,
      source: 'gsa_elibrary',
    };
  } catch {
    return buildUnavailableResult(laborCategory);
  }
}

function buildUnavailableResult(laborCategory: string): GsaRateLookupResult {
  return {
    labor_category: laborCategory,
    rate_low: null,
    rate_high: null,
    contract_count: 0,
    vintage: GSA_VINTAGE,
    source: 'unavailable',
  };
}
