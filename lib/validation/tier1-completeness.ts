/**
 * Tier 1 Enterprise Intake — Completeness Calculator
 * Phase 5, Plan 03
 *
 * Calculates how complete a company's Tier 1 Enterprise Intake profile is.
 * Scoring is weighted across three sections (total 100 points):
 *   - Corporate Identity:         35 points
 *   - Vehicles & Certifications:  25 points
 *   - Capabilities & Positioning: 40 points
 *
 * isTier1Complete() returns true when score >= 80 AND all required
 * Corporate Identity fields (UEI, CAGE, SAM Active, business_size) are valid.
 */

import type { CompanyProfile, Tier1Completeness, Tier1CompletenessSection } from '@/lib/supabase/company-types';
import { validateUEI, validateCAGE, validateWordCount } from '@/lib/validation/tier1-validators';

// Optional extra counts from related tables that the API fetches separately.
export interface Tier1ExtraCounts {
  contractVehicleCount?: number;
  naicsCodeCount?: number;
}

// ===== SECTION CALCULATORS =====

function scoreCorporateIdentity(
  profile: Partial<CompanyProfile>
): Tier1CompletenessSection {
  let score = 0;
  const missingFields: string[] = [];

  // legal_name (5 pts)
  if (profile.legal_name && profile.legal_name.trim().length > 0) {
    score += 5;
  } else {
    missingFields.push('Legal Name is required (Corporate Identity tab)');
  }

  // company_name (5 pts)
  if (profile.company_name && profile.company_name.trim().length > 0) {
    score += 5;
  } else {
    missingFields.push('Company Name is required (Corporate Identity tab)');
  }

  // uei_number valid (5 pts)
  if (profile.uei_number && validateUEI(profile.uei_number).valid) {
    score += 5;
  } else {
    missingFields.push(
      profile.uei_number
        ? `UEI Number is invalid: ${validateUEI(profile.uei_number).error} (Corporate Identity tab)`
        : 'UEI Number is required (Corporate Identity tab)'
    );
  }

  // cage_code valid (5 pts)
  if (profile.cage_code && validateCAGE(profile.cage_code).valid) {
    score += 5;
  } else {
    missingFields.push(
      profile.cage_code
        ? `CAGE Code is invalid: ${validateCAGE(profile.cage_code).error} (Corporate Identity tab)`
        : 'CAGE Code is required (Corporate Identity tab)'
    );
  }

  // sam_status Active (5 pts)
  if (profile.sam_status === 'Active') {
    score += 5;
  } else {
    missingFields.push(
      profile.sam_status
        ? `SAM.gov status must be Active (currently ${profile.sam_status}) (Corporate Identity tab)`
        : 'SAM.gov status is not set (Corporate Identity tab)'
    );
  }

  // sam_expiration set (3 pts)
  if (profile.sam_expiration && profile.sam_expiration.trim().length > 0) {
    score += 3;
  } else {
    missingFields.push('SAM.gov expiration date is not set (Corporate Identity tab)');
  }

  // business_size set (4 pts)
  if (profile.business_size) {
    score += 4;
  } else {
    missingFields.push('Business size is not set (Corporate Identity tab)');
  }

  // socioeconomic_certs: 1+ entry OR business_size is 'Large' (3 pts)
  // Large businesses typically don't carry SB certifications — award points regardless.
  const isLarge = profile.business_size === 'Large';
  const hasCerts = profile.socioeconomic_certs && profile.socioeconomic_certs.length > 0;
  if (hasCerts || isLarge) {
    score += 3;
  } else {
    missingFields.push(
      'Select at least one socioeconomic certification, or set Business Size to Large (Corporate Identity tab)'
    );
  }

  return { name: 'Corporate Identity', score, maxScore: 35, missingFields };
}

function scoreVehiclesCertifications(
  profile: Partial<CompanyProfile>,
  extra: Tier1ExtraCounts
): Tier1CompletenessSection {
  let score = 0;
  const missingFields: string[] = [];

  // iso_cmmi_status: informational — always award (5 pts)
  score += 5;

  // dcaa_approved_systems: informational — always award (5 pts)
  score += 5;

  // Facility clearance explicitly set (true or false) (5 pts)
  // We detect this through the certifications table or infer from the JSONB.
  // Since the profile doesn't have has_facility_clearance directly, we treat the
  // dcaa_approved_systems presence as a proxy that the section was visited.
  // Award if dcaa_approved_systems is non-null (meaning the tab was saved at least once).
  if (profile.dcaa_approved_systems !== undefined && profile.dcaa_approved_systems !== null) {
    score += 5;
  } else {
    missingFields.push('Complete Vehicles & Certifications tab (facility clearance section)');
  }

  // At least 1 contract vehicle (5 pts)
  const vehicleCount = extra.contractVehicleCount ?? 0;
  if (vehicleCount >= 1) {
    score += 5;
  } else {
    missingFields.push('Add at least one contract vehicle (Vehicles & Certifications tab)');
  }

  // At least 1 NAICS code (5 pts)
  const naicsCount = extra.naicsCodeCount ?? 0;
  if (naicsCount >= 1) {
    score += 5;
  } else {
    missingFields.push('Add at least one NAICS code (Corporate Identity tab)');
  }

  return { name: 'Vehicles & Certifications', score, maxScore: 25, missingFields };
}

function scoreCapabilities(
  profile: Partial<CompanyProfile>
): Tier1CompletenessSection {
  let score = 0;
  const missingFields: string[] = [];

  // corporate_overview: min 50, max 500 words (8 pts)
  if (profile.corporate_overview) {
    const result = validateWordCount(profile.corporate_overview, 50, 500);
    if (result.valid) {
      score += 8;
    } else {
      missingFields.push(`Corporate Overview: ${result.error} (Capabilities tab)`);
    }
  } else {
    missingFields.push('Corporate Overview is required — min 50 words (Capabilities tab)');
  }

  // core_services_summary: min 30, max 300 words (8 pts)
  if (profile.core_services_summary) {
    const result = validateWordCount(profile.core_services_summary, 30, 300);
    if (result.valid) {
      score += 8;
    } else {
      missingFields.push(`Core Services Summary: ${result.error} (Capabilities tab)`);
    }
  } else {
    missingFields.push('Core Services Summary is required — min 30 words (Capabilities tab)');
  }

  // enterprise_win_themes: >= 3 entries (8 pts)
  if (profile.enterprise_win_themes && profile.enterprise_win_themes.length >= 3) {
    score += 8;
  } else {
    const count = profile.enterprise_win_themes?.length ?? 0;
    missingFields.push(
      `Enterprise Win Themes: need at least 3 (currently ${count}) (Capabilities tab)`
    );
  }

  // key_differentiators_summary: min 30, max 300 words (8 pts)
  if (profile.key_differentiators_summary) {
    const result = validateWordCount(profile.key_differentiators_summary, 30, 300);
    if (result.valid) {
      score += 8;
    } else {
      missingFields.push(`Key Differentiators Summary: ${result.error} (Capabilities tab)`);
    }
  } else {
    missingFields.push('Key Differentiators Summary is required — min 30 words (Capabilities tab)');
  }

  // standard_management_approach: min 50, max 500 words (8 pts)
  if (profile.standard_management_approach) {
    const result = validateWordCount(profile.standard_management_approach, 50, 500);
    if (result.valid) {
      score += 8;
    } else {
      missingFields.push(`Standard Management Approach: ${result.error} (Capabilities tab)`);
    }
  } else {
    missingFields.push(
      'Standard Management Approach is required — min 50 words (Capabilities tab)'
    );
  }

  return { name: 'Capabilities & Positioning', score, maxScore: 40, missingFields };
}

// ===== PUBLIC API =====

/**
 * Calculate the overall Tier 1 completeness for a company profile.
 *
 * @param profile - The company profile (may be partially filled)
 * @param extra - Optional counts from related tables (contract vehicles, NAICS codes)
 * @returns Tier1Completeness with weighted score (0-100), section breakdown, and isComplete flag
 */
export function calculateTier1Completeness(
  profile: Partial<CompanyProfile>,
  extra: Tier1ExtraCounts = {}
): Tier1Completeness {
  const corporateSection = scoreCorporateIdentity(profile);
  const vehiclesSection = scoreVehiclesCertifications(profile, extra);
  const capabilitiesSection = scoreCapabilities(profile);

  const totalScore =
    corporateSection.score + vehiclesSection.score + capabilitiesSection.score;

  const sections = [corporateSection, vehiclesSection, capabilitiesSection];

  const complete = isTier1Complete(profile, extra);

  return {
    score: totalScore,
    sections,
    isComplete: complete,
  };
}

/**
 * Return a flat list of human-readable missing/invalid field messages.
 *
 * @param profile - The company profile (may be partially filled)
 * @param extra - Optional counts from related tables
 * @returns Array of descriptive strings indicating what needs to be completed
 */
export function getTier1MissingFields(
  profile: Partial<CompanyProfile>,
  extra: Tier1ExtraCounts = {}
): string[] {
  const completeness = calculateTier1Completeness(profile, extra);
  return completeness.sections.flatMap((s) => s.missingFields);
}

/**
 * Determine whether a company's Tier 1 intake is fully complete.
 *
 * Returns true ONLY when:
 *   1. Overall score >= 80 (allows some optional fields to be missing)
 *   2. All Corporate Identity required fields are valid:
 *      UEI (valid format), CAGE (valid format), SAM status Active, business_size set
 *
 * @param profile - The company profile (may be partially filled)
 * @param extra - Optional counts from related tables
 * @returns true if Tier 1 is complete; false otherwise
 */
export function isTier1Complete(
  profile: Partial<CompanyProfile>,
  extra: Tier1ExtraCounts = {}
): boolean {
  const corporateSection = scoreCorporateIdentity(profile);
  const vehiclesSection = scoreVehiclesCertifications(profile, extra);
  const capabilitiesSection = scoreCapabilities(profile);

  const totalScore =
    corporateSection.score + vehiclesSection.score + capabilitiesSection.score;

  if (totalScore < 80) return false;

  // All four required Corporate Identity fields must be valid
  const ueiValid = !!(profile.uei_number && validateUEI(profile.uei_number).valid);
  const cageValid = !!(profile.cage_code && validateCAGE(profile.cage_code).valid);
  const samActive = profile.sam_status === 'Active';
  const sizeSet = !!profile.business_size;

  return ueiValid && cageValid && samActive && sizeSet;
}
