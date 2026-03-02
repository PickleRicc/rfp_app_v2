/**
 * Scorer Output Validator (Layer 2 — Anti-Hallucination)
 *
 * Runs AFTER the scorer returns JSON, BEFORE storing gap_analysis.
 * Cross-checks each scorer finding against actual source data and the
 * draft markdown to catch scorer hallucinations.
 *
 * Checks:
 *   1. Claim existence   — does the claim text actually appear in the draft?
 *   2. Correction lookup  — does the corrected value match real source data?
 *   3. Requirement IDs    — do referenced M.x.x IDs exist in Section M?
 *   4. Self-contradiction — does the scorer contradict itself across findings?
 */

import type { GapAnalysis, DataVerification, RequirementCoverage } from '@/lib/supabase/touchup-types';
import type { CompanyProfile } from '@/lib/supabase/company-types';
import type { DataCallResponse } from '@/lib/supabase/tier2-types';
import type { ComplianceExtractionsByCategory, SectionMFields } from '@/lib/supabase/compliance-types';
import type { RfpChecklists } from '@/lib/generation/pipeline/soo-checklist-builder';

export interface ScorerValidationContext {
  draftMarkdown: string;
  companyProfile: CompanyProfile;
  dataCallResponse: DataCallResponse;
  extractions: ComplianceExtractionsByCategory;
  personnel: unknown[];
  pastPerformance: unknown[];
  certifications: unknown[];
  rfpChecklists?: RfpChecklists;
  volumeType?: string;
}

export interface DroppedFinding {
  type: 'data_verification' | 'requirements_coverage';
  original: DataVerification | RequirementCoverage;
  reason: string;
}

export interface ScorerValidationResult {
  validatedGap: GapAnalysis & { compliance_score: number };
  dropped: DroppedFinding[];
  summary: string;
}

function flattenToSearchableText(obj: unknown, depth = 0): string {
  if (depth > 6) return '';
  if (obj === null || obj === undefined) return '';
  if (typeof obj === 'string') return obj;
  if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);
  if (Array.isArray(obj)) return obj.map(item => flattenToSearchableText(item, depth + 1)).join(' ');
  if (typeof obj === 'object') {
    return Object.values(obj).map(v => flattenToSearchableText(v, depth + 1)).join(' ');
  }
  return '';
}

function normalizeForSearch(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s.%$]/g, ' ').replace(/\s+/g, ' ').trim();
}

function fuzzyContains(haystack: string, needle: string, threshold = 0.6): boolean {
  const normHay = normalizeForSearch(haystack);
  const normNeedle = normalizeForSearch(needle);

  if (normHay.includes(normNeedle)) return true;

  const words = normNeedle.split(' ').filter(w => w.length > 3);
  if (words.length === 0) return true;
  const matchCount = words.filter(w => normHay.includes(w)).length;
  return matchCount / words.length >= threshold;
}

/**
 * Check 1: Verify that each data_verification claim actually appears in the draft.
 * If the scorer references a claim that doesn't exist, it hallucinated the finding.
 */
function validateClaimExistence(
  findings: DataVerification[],
  draftMarkdown: string
): { kept: DataVerification[]; dropped: DroppedFinding[] } {
  const kept: DataVerification[] = [];
  const dropped: DroppedFinding[] = [];

  for (const finding of findings) {
    const claimText = finding.claim;
    if (!claimText || claimText.length < 10) {
      kept.push(finding);
      continue;
    }

    const keyPhrases = extractKeyPhrases(claimText);
    const foundInDraft = keyPhrases.some(phrase => fuzzyContains(draftMarkdown, phrase, 0.5));

    if (foundInDraft) {
      kept.push(finding);
    } else {
      dropped.push({
        type: 'data_verification',
        original: finding,
        reason: `Claim not found in draft text: "${claimText.slice(0, 80)}..."`,
      });
    }
  }

  return { kept, dropped };
}

function extractKeyPhrases(claim: string): string[] {
  const phrases: string[] = [];

  const numberPattern = /\d[\d,.]+%?/g;
  const numbers = claim.match(numberPattern) || [];
  const namePattern = /(?:Dr\.\s+)?[A-Z][a-z]+\s+[A-Z][a-z]+/g;
  const names = claim.match(namePattern) || [];
  const certPattern = /\b(?:CCNP|VCP-DCV|CISSP|CEH|PMP|ITIL|AWS|CISM|ISO\s*\d+|CMMI)[^,.)]*\b/gi;
  const certs = claim.match(certPattern) || [];

  phrases.push(...numbers, ...names, ...certs);

  if (phrases.length === 0) {
    const words = claim.split(/\s+/).filter(w => w.length > 4);
    if (words.length >= 3) {
      phrases.push(words.slice(0, 5).join(' '));
    }
  }

  return phrases;
}

/**
 * Check 2: Verify scorer corrections against actual source data.
 * If the scorer says "source X says Y" but the actual data says Z, drop the finding.
 */
function validateCorrections(
  findings: DataVerification[],
  ctx: ScorerValidationContext
): { kept: DataVerification[]; dropped: DroppedFinding[] } {
  const kept: DataVerification[] = [];
  const dropped: DroppedFinding[] = [];

  const sourceText = buildSourceSearchCorpus(ctx);

  for (const finding of findings) {
    if (!finding.correction) {
      kept.push(finding);
      continue;
    }

    const correctionClaim = finding.correction;

    const boolMismatch = detectBooleanMismatch(correctionClaim, ctx);
    if (boolMismatch) {
      dropped.push({
        type: 'data_verification',
        original: finding,
        reason: boolMismatch,
      });
      continue;
    }

    const valueClaims = extractValueClaims(correctionClaim);
    if (valueClaims.length > 0) {
      const allVerified = valueClaims.every(vc => fuzzyContains(sourceText, vc, 0.4));
      if (!allVerified) {
        const unverified = valueClaims.filter(vc => !fuzzyContains(sourceText, vc, 0.4));
        dropped.push({
          type: 'data_verification',
          original: finding,
          reason: `Correction references values not found in source data: ${unverified.join(', ')}`,
        });
        continue;
      }
    }

    kept.push(finding);
  }

  return { kept, dropped };
}

function buildSourceSearchCorpus(ctx: ScorerValidationContext): string {
  const parts: string[] = [];

  parts.push(flattenToSearchableText(ctx.companyProfile));
  parts.push(flattenToSearchableText(ctx.dataCallResponse));
  parts.push(flattenToSearchableText(ctx.personnel));
  parts.push(flattenToSearchableText(ctx.pastPerformance));
  parts.push(flattenToSearchableText(ctx.certifications));

  for (const cat of Object.values(ctx.extractions)) {
    parts.push(flattenToSearchableText(cat));
  }

  return parts.join(' ');
}

/**
 * Detect when the scorer claims a boolean field has one value but it actually has another.
 * E.g., "compliance_verification lists ISO 9001 as true" when the field is actually false.
 */
function detectBooleanMismatch(correction: string, ctx: ScorerValidationContext): string | null {
  const cv = ctx.dataCallResponse.compliance_verification;
  if (!cv) return null;

  const cvRecord = cv as unknown as Record<string, unknown>;
  const boolChecks: Array<{ pattern: RegExp; field: string; actualValue: unknown }> = [
    { pattern: /iso.?9001.*(?:as |is |lists? )(true|certified|held|yes)/i, field: 'iso_9001_certified', actualValue: cvRecord.iso_9001_certified },
    { pattern: /iso.?27001.*(?:as |is |lists? )(true|certified|held|yes)/i, field: 'iso_27001_certified', actualValue: cvRecord.iso_27001_certified },
    { pattern: /iso.?20000.*(?:as |is |lists? )(true|certified|held|yes)/i, field: 'iso_20000_certified', actualValue: cvRecord.iso_20000_certified },
    { pattern: /sdvosb.*(?:as |is |lists? )(true|certified|held|yes)/i, field: 'sdvosb_certified', actualValue: cvRecord.sdvosb_certified },
    { pattern: /dcaa.*(?:as |is |lists? )(true|approved|yes)/i, field: 'dcaa_approved', actualValue: cvRecord.dcaa_approved },
  ];

  for (const check of boolChecks) {
    if (check.pattern.test(correction)) {
      if (check.actualValue === false || check.actualValue === 'false') {
        return `Scorer claims ${check.field} is true/certified, but actual value is ${JSON.stringify(check.actualValue)}. Scorer hallucinated this finding.`;
      }
    }
  }

  const sprsMatch = correction.match(/sprs.*?(\d{1,3})/i);
  if (sprsMatch) {
    const claimedSprs = parseInt(sprsMatch[1], 10);
    const actualSprs = cvRecord.sprs_score;
    if (typeof actualSprs === 'number' && claimedSprs !== actualSprs) {
      return `Scorer claims SPRS score is ${claimedSprs}, but actual compliance_verification.sprs_score is ${actualSprs}.`;
    }
  }

  return null;
}

function extractValueClaims(correction: string): string[] {
  const claims: string[] = [];

  const numericPattern = /\b\d[\d,.]*%?\b/g;
  const nums = correction.match(numericPattern) || [];
  claims.push(...nums.filter(n => n.length >= 2));

  return claims;
}

/**
 * Check 3: Verify that requirement IDs reference real Section M factors.
 */
function validateRequirementIds(
  requirements: RequirementCoverage[],
  extractions: ComplianceExtractionsByCategory
): { kept: RequirementCoverage[]; dropped: DroppedFinding[] } {
  const kept: RequirementCoverage[] = [];
  const dropped: DroppedFinding[] = [];

  const validIds = buildValidRequirementIds(extractions);

  for (const req of requirements) {
    const id = req.requirement_id;

    if (!id.startsWith('M.') || validIds.size === 0) {
      kept.push(req);
      continue;
    }

    const baseId = id.split('.').slice(0, 2).join('.');
    if (validIds.has(id) || validIds.has(baseId)) {
      kept.push(req);
    } else {
      dropped.push({
        type: 'requirements_coverage',
        original: req,
        reason: `Requirement ID "${id}" does not match any extracted Section M factor. Valid IDs: ${[...validIds].join(', ')}`,
      });
    }
  }

  return { kept, dropped };
}

function buildValidRequirementIds(extractions: ComplianceExtractionsByCategory): Set<string> {
  const ids = new Set<string>();

  const sectionMRows = extractions.section_m || [];
  for (const row of sectionMRows) {
    const fields = row.field_value as SectionMFields | SectionMFields['evaluation_factors'];
    const factors = Array.isArray(fields)
      ? fields
      : (fields as SectionMFields)?.evaluation_factors || [];

    factors.forEach((f, fi) => {
      ids.add(`M.${fi + 1}`);
      (f.subfactors || []).forEach((_sf, si) => {
        ids.add(`M.${fi + 1}.${si + 1}`);
      });
    });
  }

  const sowIds = new Set<string>();
  const sowRows = extractions.sow_pws || [];
  for (const row of sowRows) {
    if (row.field_name === 'task_areas') {
      const tasks = row.field_value as Array<{ name?: string }> | undefined;
      if (Array.isArray(tasks)) {
        tasks.forEach((_, i) => sowIds.add(`SOW.TaskArea.${i + 1}`));
      }
    }
  }

  return new Set([...ids, ...sowIds]);
}

/**
 * Check 4: Detect self-contradictions — same claim with conflicting corrections.
 */
function detectSelfContradictions(
  findings: DataVerification[]
): { kept: DataVerification[]; dropped: DroppedFinding[] } {
  const kept: DataVerification[] = [];
  const dropped: DroppedFinding[] = [];
  const claimMap = new Map<string, DataVerification>();

  for (const finding of findings) {
    const normClaim = normalizeForSearch(finding.claim);
    const existing = claimMap.get(normClaim);

    if (existing) {
      if (existing.correction && finding.correction &&
          normalizeForSearch(existing.correction) !== normalizeForSearch(finding.correction)) {
        dropped.push({
          type: 'data_verification',
          original: finding,
          reason: `Self-contradiction: same claim "${finding.claim.slice(0, 60)}..." has conflicting corrections: "${existing.correction?.slice(0, 60)}" vs "${finding.correction?.slice(0, 60)}"`,
        });
        continue;
      }
    }

    claimMap.set(normClaim, finding);
    kept.push(finding);
  }

  return { kept, dropped };
}

/**
 * Check 5: Auto-inject missing RFP section/technology findings the scorer missed.
 *
 * Runs the same heading analysis as content-validator's checkSectionCoverage
 * against the draft, then compares with the scorer's requirements_coverage.
 * Any section the code detects as missing but the scorer did NOT flag gets
 * auto-injected into the gap analysis.
 */
function validateRfpCompleteness(
  gap: GapAnalysis & { compliance_score: number },
  ctx: ScorerValidationContext
): { injectedReq: RequirementCoverage[]; injectedDv: DataVerification[] } {
  const injectedReq: RequirementCoverage[] = [];
  const injectedDv: DataVerification[] = [];

  if (!ctx.rfpChecklists || ctx.rfpChecklists.sections.length === 0) {
    return { injectedReq, injectedDv };
  }

  const existingReqIds = new Set(
    (gap.requirements_coverage || []).map(r => r.requirement_id.toLowerCase())
  );

  const headingLines = ctx.draftMarkdown.split('\n').filter(l => /^#{1,4}\s+/.test(l));
  const headingTexts = headingLines.map(l => l.replace(/^#{1,4}\s+/, '').trim());

  for (const section of ctx.rfpChecklists.sections) {
    const sectionIdEscaped = section.sectionId.replace(/\./g, '\\.');
    const idRegex = new RegExp(`\\b${sectionIdEscaped}\\b`);

    const foundById = headingTexts.some(h => idRegex.test(h));
    const foundByTitle = headingTexts.some(h => {
      const normH = h.toLowerCase().replace(/[^a-z0-9\s]/g, '');
      const normS = section.sectionName.toLowerCase().replace(/[^a-z0-9\s]/g, '');
      if (normH.includes(normS) || normS.includes(normH)) return true;
      const sWords = normS.split(/\s+/).filter(w => w.length > 3);
      if (sWords.length === 0) return false;
      return sWords.filter(w => normH.includes(w)).length / sWords.length >= 0.6;
    });

    if (!foundById && !foundByTitle) {
      const reqId = `${section.documentStyle.toUpperCase()}.${section.sectionId}`;
      if (!existingReqIds.has(reqId.toLowerCase())) {
        injectedReq.push({
          requirement_id: reqId,
          requirement_text: section.sectionName,
          status: 'missing',
          gap_description: `${section.documentStyle.toUpperCase()} section ${section.sectionId} (${section.sectionName}) ` +
            `has no coverage in draft — code validator detected`,
          severity_tier: 'fatal',
        });
      }
    }
  }

  // Technology conflict injection
  const existingDvClaims = new Set(
    (gap.data_verification || []).map(d => d.claim.toLowerCase())
  );
  const markdownLower = ctx.draftMarkdown.toLowerCase();

  for (const conflict of ctx.rfpChecklists.techConflicts) {
    for (const wrongTool of conflict.commonWrongTools) {
      const wrongPattern = new RegExp(`\\b${wrongTool.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      const rfpPattern = new RegExp(`\\b${conflict.rfpTool.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');

      if (wrongPattern.test(ctx.draftMarkdown) && !rfpPattern.test(ctx.draftMarkdown)) {
        const claimText = `Draft uses ${wrongTool} instead of RFP-required ${conflict.rfpTool}`;
        if (!existingDvClaims.has(claimText.toLowerCase())) {
          injectedDv.push({
            claim: claimText,
            source: 'fabricated',
            verified: false,
            correction: `Replace ${wrongTool} with ${conflict.rfpTool} as specified in the RFP`,
            fabrication_type: 'incorrect',
            severity_tier: 'fatal',
          });
        }
      }
    }
  }

  // Missing required technologies
  for (const tech of ctx.rfpChecklists.technologies) {
    if (tech.requirementLevel !== 'mandatory') continue;
    const techPattern = new RegExp(`\\b${tech.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (!techPattern.test(ctx.draftMarkdown)) {
      const claimText = `Required technology "${tech.name}" is not mentioned in the draft`;
      if (!existingDvClaims.has(claimText.toLowerCase())) {
        injectedDv.push({
          claim: claimText,
          source: 'fabricated',
          verified: false,
          correction: `Add coverage of ${tech.name} in the appropriate section`,
          severity_tier: 'deficiency',
        });
      }
    }
  }

  return { injectedReq, injectedDv };
}

/**
 * Main validation entry point.
 * Runs all checks in sequence and returns the cleaned gap analysis.
 */
export function validateScorerOutput(
  rawGap: GapAnalysis & { compliance_score: number },
  ctx: ScorerValidationContext
): ScorerValidationResult {
  const allDropped: DroppedFinding[] = [];
  let dvFindings = rawGap.data_verification || [];
  let reqFindings = rawGap.requirements_coverage || [];

  // Check 1: Claim existence in draft
  const claimCheck = validateClaimExistence(dvFindings, ctx.draftMarkdown);
  dvFindings = claimCheck.kept;
  allDropped.push(...claimCheck.dropped);

  // Check 2: Correction plausibility against source data
  const corrCheck = validateCorrections(dvFindings, ctx);
  dvFindings = corrCheck.kept;
  allDropped.push(...corrCheck.dropped);

  // Check 3: Requirement ID validity
  const reqCheck = validateRequirementIds(reqFindings, ctx.extractions);
  reqFindings = reqCheck.kept;
  allDropped.push(...reqCheck.dropped);

  // Check 4: Self-contradictions
  const contradCheck = detectSelfContradictions(dvFindings);
  dvFindings = contradCheck.kept;
  allDropped.push(...contradCheck.dropped);

  // Check 5: RFP completeness — auto-inject findings the scorer missed
  const completenessResult = validateRfpCompleteness(
    { ...rawGap, data_verification: dvFindings, requirements_coverage: reqFindings },
    ctx
  );
  reqFindings = [...reqFindings, ...completenessResult.injectedReq];
  dvFindings = [...dvFindings, ...completenessResult.injectedDv];

  const validatedGap: GapAnalysis & { compliance_score: number } = {
    ...rawGap,
    data_verification: dvFindings,
    requirements_coverage: reqFindings,
  };

  const injectedCount = completenessResult.injectedReq.length + completenessResult.injectedDv.length;
  const summaryParts: string[] = [];
  if (allDropped.length > 0) {
    summaryParts.push(`Dropped ${allDropped.length} hallucinated finding(s)`);
  }
  if (injectedCount > 0) {
    summaryParts.push(`Injected ${injectedCount} code-detected finding(s) the scorer missed`);
  }
  const summary = summaryParts.length > 0
    ? `Scorer validator: ${summaryParts.join('; ')}`
    : 'All scorer findings validated — no hallucinations detected.';

  return { validatedGap, dropped: allDropped, summary };
}
