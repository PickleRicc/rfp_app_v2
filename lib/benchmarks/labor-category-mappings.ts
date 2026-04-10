/**
 * Federal contractor labor category → BLS SOC code mappings.
 * Handles common naming variations in federal proposals.
 * Used by P2W analyzer to look up BLS OES rates.
 */

export interface LaborCategoryMapping {
  soc_code: string;
  bls_title: string;           // The key in bls-oes-data.json national_rates
  confidence: 'exact' | 'close' | 'approximate';
}

// Exact and near-exact matches for common federal IT contractor categories
const LABOR_CATEGORY_MAP: Record<string, LaborCategoryMapping> = {
  // Program/Project Management
  'program manager': { soc_code: '11-9041', bls_title: 'Program Manager', confidence: 'exact' },
  'project manager': { soc_code: '11-9041', bls_title: 'Program Manager', confidence: 'close' },
  'deputy program manager': { soc_code: '11-9041', bls_title: 'Program Manager', confidence: 'close' },
  'task order manager': { soc_code: '11-9041', bls_title: 'Program Manager', confidence: 'approximate' },

  // Systems Engineering
  'systems engineer': { soc_code: '15-1299', bls_title: 'Project Manager (IT)', confidence: 'close' },
  'senior systems engineer': { soc_code: '15-1299', bls_title: 'Project Manager (IT)', confidence: 'close' },
  'lead systems engineer': { soc_code: '15-1299', bls_title: 'Project Manager (IT)', confidence: 'close' },
  'systems administrator': { soc_code: '15-1244', bls_title: 'Systems Administrator', confidence: 'exact' },
  'senior systems administrator': { soc_code: '15-1244', bls_title: 'Systems Administrator', confidence: 'close' },

  // Software Development
  'software developer': { soc_code: '15-1252', bls_title: 'Software Developer', confidence: 'exact' },
  'software engineer': { soc_code: '15-1252', bls_title: 'Software Developer', confidence: 'exact' },
  'senior software developer': { soc_code: '15-1252', bls_title: 'Software Developer', confidence: 'close' },
  'senior software engineer': { soc_code: '15-1252', bls_title: 'Software Developer', confidence: 'close' },
  'full stack developer': { soc_code: '15-1252', bls_title: 'Software Developer', confidence: 'close' },
  'devops engineer': { soc_code: '15-1299', bls_title: 'DevOps Engineer', confidence: 'exact' },
  'site reliability engineer': { soc_code: '15-1299', bls_title: 'DevOps Engineer', confidence: 'close' },

  // Cybersecurity
  'cybersecurity analyst': { soc_code: '15-1212', bls_title: 'Information Security Analyst', confidence: 'exact' },
  'information security analyst': { soc_code: '15-1212', bls_title: 'Information Security Analyst', confidence: 'exact' },
  'cybersecurity engineer': { soc_code: '15-1212', bls_title: 'Cybersecurity Engineer', confidence: 'exact' },
  'security engineer': { soc_code: '15-1212', bls_title: 'Cybersecurity Engineer', confidence: 'close' },
  'information assurance analyst': { soc_code: '15-1212', bls_title: 'Information Security Analyst', confidence: 'close' },
  'isso': { soc_code: '15-1212', bls_title: 'Information Security Analyst', confidence: 'close' },
  'issm': { soc_code: '15-1212', bls_title: 'Cybersecurity Engineer', confidence: 'close' },

  // Networking
  'network engineer': { soc_code: '15-1241', bls_title: 'Network Engineer', confidence: 'exact' },
  'senior network engineer': { soc_code: '15-1241', bls_title: 'Network Engineer', confidence: 'close' },
  'network administrator': { soc_code: '15-1241', bls_title: 'Network Engineer', confidence: 'close' },
  'network technician': { soc_code: '15-1241', bls_title: 'Network Engineer', confidence: 'approximate' },

  // Help Desk / Service Desk
  'help desk technician': { soc_code: '15-1232', bls_title: 'Help Desk Technician', confidence: 'exact' },
  'service desk analyst': { soc_code: '15-1232', bls_title: 'Help Desk Technician', confidence: 'exact' },
  'tier 1 analyst': { soc_code: '15-1232', bls_title: 'Help Desk Technician', confidence: 'close' },
  'tier 2 analyst': { soc_code: '15-1232', bls_title: 'Help Desk Technician', confidence: 'approximate' },
  'tier i analyst': { soc_code: '15-1232', bls_title: 'Help Desk Technician', confidence: 'close' },
  'tier ii analyst': { soc_code: '15-1232', bls_title: 'Help Desk Technician', confidence: 'approximate' },
  'desktop support technician': { soc_code: '15-1232', bls_title: 'Help Desk Technician', confidence: 'close' },

  // Data / Database
  'database administrator': { soc_code: '15-1245', bls_title: 'Database Administrator', confidence: 'exact' },
  'dba': { soc_code: '15-1245', bls_title: 'Database Administrator', confidence: 'exact' },
  'data scientist': { soc_code: '15-2051', bls_title: 'Data Scientist', confidence: 'exact' },
  'data analyst': { soc_code: '15-2051', bls_title: 'Data Scientist', confidence: 'approximate' },
  'data engineer': { soc_code: '15-2051', bls_title: 'Data Scientist', confidence: 'approximate' },

  // Cloud
  'cloud architect': { soc_code: '15-1299', bls_title: 'Cloud Architect', confidence: 'exact' },
  'cloud engineer': { soc_code: '15-1299', bls_title: 'Cloud Architect', confidence: 'close' },
  'aws architect': { soc_code: '15-1299', bls_title: 'Cloud Architect', confidence: 'close' },
  'azure architect': { soc_code: '15-1299', bls_title: 'Cloud Architect', confidence: 'close' },

  // Business / Analysis
  'business analyst': { soc_code: '13-1111', bls_title: 'Business Analyst', confidence: 'exact' },
  'senior business analyst': { soc_code: '13-1111', bls_title: 'Business Analyst', confidence: 'close' },
  'quality assurance analyst': { soc_code: '15-1253', bls_title: 'Quality Assurance Analyst', confidence: 'exact' },
  'qa analyst': { soc_code: '15-1253', bls_title: 'Quality Assurance Analyst', confidence: 'exact' },
  'tester': { soc_code: '15-1253', bls_title: 'Quality Assurance Analyst', confidence: 'approximate' },
  'technical writer': { soc_code: '27-3042', bls_title: 'Technical Writer', confidence: 'exact' },
};

/**
 * Look up BLS mapping for a labor category name.
 * Tries exact match, then case-insensitive, then partial token match.
 */
export function lookupLaborCategory(categoryName: string): LaborCategoryMapping | null {
  const normalized = categoryName.toLowerCase().trim();

  // 1. Exact match
  if (LABOR_CATEGORY_MAP[normalized]) {
    return LABOR_CATEGORY_MAP[normalized];
  }

  // 2. Partial token match — check if any key is a substring of the input or vice versa
  for (const [key, mapping] of Object.entries(LABOR_CATEGORY_MAP)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return { ...mapping, confidence: 'approximate' };
    }
  }

  // 3. Word overlap — count matching words
  const inputWords = normalized.split(/\s+/).filter(w => w.length > 3);
  let bestMatch: { mapping: LaborCategoryMapping; overlap: number } | null = null;

  for (const [key, mapping] of Object.entries(LABOR_CATEGORY_MAP)) {
    const keyWords = key.split(/\s+/).filter(w => w.length > 3);
    const overlap = inputWords.filter(w => keyWords.includes(w)).length;
    if (overlap > 0 && (!bestMatch || overlap > bestMatch.overlap)) {
      bestMatch = { mapping, overlap };
    }
  }

  if (bestMatch) {
    return { ...bestMatch.mapping, confidence: 'approximate' };
  }

  return null;
}

/**
 * Get all available labor category names for display.
 */
export function getAvailableLaborCategories(): string[] {
  return [...new Set(Object.values(LABOR_CATEGORY_MAP).map(m => m.bls_title))].sort();
}
