/**
 * Tier 1 Enterprise Intake — Validation Library
 * Phase 5, Plan 01
 *
 * Pure validation functions for government contractor registration fields.
 * Used server-side (API route validation) and client-side (UX feedback).
 * All functions are pure with no side effects except checkSAMStatus (async mock).
 */

// ===== RESULT TYPES =====

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface WordCountResult {
  valid: boolean;
  wordCount: number;
  error?: string;
}

export interface SAMStatusResult {
  registered: boolean;
  status: string;
  expiration?: string;
  error?: string;
}

// ===== UEI VALIDATION =====

/**
 * Validate a SAM.gov Unique Entity Identifier (UEI).
 *
 * Rules (per SAM.gov UEI format specification):
 * - Must be exactly 12 characters
 * - Must be alphanumeric (letters A-Z and digits 0-9 only)
 * - First character must be a letter (A-Z)
 * - Must NOT contain the letters O or I (use digits 0 and 1 instead to avoid confusion)
 *
 * @param uei - The UEI string to validate
 * @returns ValidationResult with valid flag and descriptive error if invalid
 */
export function validateUEI(uei: string): ValidationResult {
  if (!uei || uei.length !== 12) {
    return { valid: false, error: 'UEI must be exactly 12 characters' };
  }

  // Check alphanumeric only (letters and digits)
  if (!/^[A-Z0-9a-z]+$/.test(uei)) {
    return { valid: false, error: 'UEI must contain only letters and digits' };
  }

  // First character must be a letter
  if (!/^[A-Za-z]/.test(uei)) {
    return { valid: false, error: 'UEI must start with a letter' };
  }

  // Must not contain O or I (SAM.gov uses 0 and 1 instead to avoid visual confusion)
  const upperUEI = uei.toUpperCase();
  if (upperUEI.includes('O') || upperUEI.includes('I')) {
    return {
      valid: false,
      error: 'UEI cannot contain letters O or I (use 0 and 1 instead)',
    };
  }

  return { valid: true };
}

// ===== NAICS CODE VALIDATION =====

/**
 * Validate a NAICS (North American Industry Classification System) code.
 *
 * Rules:
 * - Must be exactly 6 digits (a string of digits, not a number — leading zeros matter)
 * - Must start with a valid NAICS sector (11 through 92)
 *   Sectors: 11 Agriculture, 21 Mining, 22 Utilities, 23 Construction,
 *   31-33 Manufacturing, 42 Wholesale, 44-45 Retail, 48-49 Transport,
 *   51 Information, 52 Finance, 53 Real Estate, 54 Professional Services,
 *   55 Management, 56 Admin Support, 61 Education, 62 Health Care,
 *   71 Arts, 72 Accommodation, 81 Other Services, 92 Public Admin.
 *
 * @param code - The 6-digit NAICS code string to validate
 * @returns ValidationResult with valid flag and descriptive error if invalid
 */
export function validateNAICS(code: string): ValidationResult {
  if (!code || !/^\d{6}$/.test(code)) {
    return { valid: false, error: 'NAICS code must be exactly 6 digits' };
  }

  // Extract the 2-digit sector prefix and validate it falls within known NAICS ranges
  const sector = parseInt(code.substring(0, 2), 10);
  const validSectors = [11, 21, 22, 23, 31, 32, 33, 42, 44, 45, 48, 49, 51, 52, 53, 54, 55, 56, 61, 62, 71, 72, 81, 92];

  if (!validSectors.includes(sector)) {
    return { valid: false, error: 'Invalid NAICS sector code' };
  }

  return { valid: true };
}

// ===== CAGE CODE VALIDATION =====

/**
 * Validate a CAGE (Commercial and Government Entity) code.
 *
 * Rules:
 * - Must be exactly 5 alphanumeric characters
 *
 * @param cage - The CAGE code string to validate
 * @returns ValidationResult with valid flag and descriptive error if invalid
 */
export function validateCAGE(cage: string): ValidationResult {
  if (!cage || cage.length !== 5) {
    return { valid: false, error: 'CAGE code must be exactly 5 characters' };
  }

  if (!/^[A-Z0-9a-z]{5}$/.test(cage)) {
    return { valid: false, error: 'CAGE code must contain only letters and digits' };
  }

  return { valid: true };
}

// ===== WORD COUNT VALIDATION =====

/**
 * Validate that a text field's word count falls within specified bounds.
 *
 * Words are counted by splitting on whitespace (consistent with how government
 * proposal evaluators typically count words in narrative sections).
 *
 * @param text - The text to validate
 * @param min - Minimum number of words required (inclusive)
 * @param max - Maximum number of words allowed (inclusive)
 * @returns WordCountResult with valid flag, current word count, and error if out of range
 */
export function validateWordCount(
  text: string,
  min: number,
  max: number
): WordCountResult {
  // Split on one or more whitespace characters, filtering out empty strings
  const words = text ? text.trim().split(/\s+/).filter((w) => w.length > 0) : [];
  const wordCount = words.length;

  if (wordCount < min) {
    return {
      valid: false,
      wordCount,
      error: `Minimum ${min} words required (currently ${wordCount})`,
    };
  }

  if (wordCount > max) {
    return {
      valid: false,
      wordCount,
      error: `Maximum ${max} words exceeded (currently ${wordCount})`,
    };
  }

  return { valid: true, wordCount };
}

// ===== SAM.GOV STATUS CHECK =====

/**
 * Check SAM.gov registration status for a given UEI.
 *
 * TODO: Replace with real SAM.gov Entity API (api.sam.gov) integration when API key is available.
 * The real endpoint is: GET https://api.sam.gov/entity-information/v3/entities?ueiSAM={uei}
 * Requires an API key obtained from api.sam.gov (free for government data access).
 *
 * Current implementation is a MOCK that returns a plausible response based on UEI format validity:
 * - Valid UEI format → { registered: true, status: 'Active', expiration: one year from today }
 * - Invalid UEI format → { registered: false, status: 'Not Found' }
 *
 * @param uei - The UEI to check against SAM.gov
 * @returns Promise resolving to SAMStatusResult with registration status
 */
export async function checkSAMStatus(uei: string): Promise<SAMStatusResult> {
  const ueiValidation = validateUEI(uei);

  if (!ueiValidation.valid) {
    return {
      registered: false,
      status: 'Not Found',
    };
  }

  // Mock: valid-format UEI is assumed active with expiration one year from today
  const oneYearFromNow = new Date();
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
  const expirationDate = oneYearFromNow.toISOString().split('T')[0]; // YYYY-MM-DD

  return {
    registered: true,
    status: 'Active',
    expiration: expirationDate,
  };
}
