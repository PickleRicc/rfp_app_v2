/**
 * Post-Generation Auto-Fill Pass
 *
 * Scans AI-generated content_markdown for [PLACEHOLDER: ...] and
 * [HUMAN INPUT REQUIRED: ...] patterns, checks whether the data exists
 * in the prompt data bundle, and fills inline.
 *
 * Runs after Claude generates content but before DOCX packaging.
 */

import type { CompanyProfile } from '@/lib/supabase/company-types';
import type { DataCallResponse } from '@/lib/supabase/tier2-types';
import type { ComplianceExtractionsByCategory } from '@/lib/supabase/compliance-types';

export interface AutoFillDataBundle {
  companyProfile: CompanyProfile;
  dataCallResponse: DataCallResponse;
  extractions: ComplianceExtractionsByCategory;
  certifications: unknown[];
  pastPerformance: unknown[];
}

interface FillResult {
  filledMarkdown: string;
  fillCount: number;
  remainingPlaceholders: number;
  fills: { original: string; replacement: string }[];
}

type FillEntry = { pattern: RegExp; getValue: (bundle: AutoFillDataBundle) => string | null };

function buildFillMap(bundle: AutoFillDataBundle): FillEntry[] {
  const cp = bundle.companyProfile;
  const dcr = bundle.dataCallResponse;
  const opDetails = (dcr.opportunity_details || {}) as unknown as Record<string, unknown>;
  const compliance = (dcr.compliance_verification || {}) as unknown as Record<string, unknown>;
  const techApproach = (dcr.technical_approach || {}) as unknown as Record<string, unknown>;
  const keyPersonnel = (dcr.key_personnel || []) as { name: string; role: string }[];

  const adminExtractions = bundle.extractions.admin_data || [];
  const getAdminField = (name: string) => {
    const row = adminExtractions.find(r => r.field_name === name);
    return row?.field_value as string | null;
  };

  const entries: FillEntry[] = [
    { pattern: /company.?name/i, getValue: () => cp.company_name },
    { pattern: /legal.?name/i, getValue: () => cp.legal_name || null },
    { pattern: /cage.?code/i, getValue: () => cp.cage_code || null },
    { pattern: /uei/i, getValue: () => cp.uei_number || null },
    { pattern: /duns/i, getValue: () => cp.uei_number || null },
    { pattern: /sprs.?score/i, getValue: () => compliance.sprs_score != null ? String(compliance.sprs_score) : null },
    { pattern: /cmmi.?level/i, getValue: () => compliance.cmmi_level != null ? `CMMI Level ${compliance.cmmi_level}` : null },
    { pattern: /contract.?type/i, getValue: () => (opDetails.contract_type as string) || null },
    { pattern: /set.?aside/i, getValue: () => (opDetails.set_aside as string) || null },
    { pattern: /naics/i, getValue: () => (opDetails.naics_code as string) || null },
    { pattern: /solicitation.?number/i, getValue: () => getAdminField('solicitation_number') },
    { pattern: /agency.?name/i, getValue: () => getAdminField('agency_name') },
    { pattern: /contracting.?officer/i, getValue: () => getAdminField('contracting_officer') },
    { pattern: /facility.?clearance/i, getValue: () => (compliance.facility_clearance_level as string) || null },
    { pattern: /sdvosb.?cert/i, getValue: () => (compliance.sdvosb_cert_number as string) || null },
    { pattern: /user.?count|total.?users|number.?of.?users/i, getValue: () => {
      const summary = techApproach.approach_summary as string | undefined;
      if (summary) {
        const match = summary.match(/([\d,]+)\s*users/i);
        if (match) return match[1];
      }
      return null;
    }},
    { pattern: /program.?manager/i, getValue: () => keyPersonnel.find(kp => /program.?manager/i.test(kp.role))?.name || null },
    { pattern: /lead.?systems?.?engineer/i, getValue: () => keyPersonnel.find(kp => /systems?.?engineer/i.test(kp.role))?.name || null },
    { pattern: /cybersecurity.?lead/i, getValue: () => keyPersonnel.find(kp => /cyber/i.test(kp.role))?.name || null },
    { pattern: /headquarters|hq.?address/i, getValue: () => {
      const hq = cp.headquarters_address as { street?: string; suite?: string; city?: string; state?: string; zip?: string } | null;
      if (!hq) return null;
      return [hq.street, hq.suite, hq.city, hq.state, hq.zip].filter(Boolean).join(', ');
    }},
  ];

  return entries;
}

const PLACEHOLDER_RE = /\[(PLACEHOLDER|HUMAN INPUT REQUIRED|INSERT|TBD):\s*([^\]]+)\]/gi;

export function autoFillPlaceholders(
  markdown: string,
  bundle: AutoFillDataBundle
): FillResult {
  const fillMap = buildFillMap(bundle);
  const fills: { original: string; replacement: string }[] = [];

  const filledMarkdown = markdown.replace(PLACEHOLDER_RE, (match, _tag, description) => {
    const desc = description.trim().toLowerCase();

    for (const entry of fillMap) {
      if (entry.pattern.test(desc)) {
        const value = entry.getValue(bundle);
        if (value) {
          fills.push({ original: match, replacement: value });
          return value;
        }
      }
    }
    return match;
  });

  const remainingPlaceholders = (filledMarkdown.match(PLACEHOLDER_RE) || []).length;

  return {
    filledMarkdown,
    fillCount: fills.length,
    remainingPlaceholders,
    fills,
  };
}
