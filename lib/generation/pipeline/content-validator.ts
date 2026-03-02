/**
 * Post-Generation Content Validator (Layer 1 — Anti-Hallucination)
 *
 * Scans generated markdown against actual source data to catch fabrications.
 * Runs AFTER generation + auto-fill, BEFORE DOCX creation.
 *
 * Hard checks (no AI involved):
 *   1. Personnel name check — names near role titles must be in key personnel registry
 *   2. Expired cert check  — certs mentioned must not be expired (or must carry a caveat)
 *   3. Metrics check       — percentages and dollar amounts must appear in source data
 *   4. SPRS consistency    — SPRS score must match compliance_verification
 *
 * Returns warnings and optionally auto-corrects inline (cert annotations).
 */

import type { DataCallResponse } from '@/lib/supabase/tier2-types';
import type {
  RfpChecklists,
  RequirementSectionItem,
  TechChecklistItem,
  TechConflict,
  CdrlItem,
  MetricsItem,
} from '@/lib/generation/pipeline/soo-checklist-builder';

export type ValidationCheckType =
  | 'personnel_name'
  | 'expired_cert'
  | 'metrics_mismatch'
  | 'sprs_mismatch'
  | 'tool_not_in_allowlist'
  | 'section_coverage'
  | 'technology_allowlist'
  | 'technology_conflict'
  | 'cdrl_mismatch'
  | 'performance_metric'
  | 'stub_only_section';

export interface ContentValidationWarning {
  check: ValidationCheckType;
  severity: 'error' | 'warning' | 'info';
  message: string;
  location?: string;
}

export interface ContentValidationResult {
  warnings: ContentValidationWarning[];
  correctedMarkdown: string;
  autoCorrections: number;
}

interface PersonnelRecord {
  full_name: string;
  availability?: string;
  certifications?: Array<{ name: string; expiration_date?: string | null }>;
  proposed_roles?: Array<{ role_title: string; is_key_personnel?: boolean }>;
}

interface KeyPersonnelEntry {
  name: string;
  role: string;
}

interface PastPerformanceRecord {
  achievements?: Array<{ statement?: string; metric_value?: string }>;
  contract_value?: number;
  annual_value?: number;
  team_size?: number;
}

interface TechnologySelection {
  technology_name: string;
  certifications_held?: string;
}

interface ServiceAreaApproach {
  proposed_tools?: string;
  key_differentiator?: string;
}

export interface ContentValidationData {
  keyPersonnel: KeyPersonnelEntry[];
  personnel: PersonnelRecord[];
  pastPerformance: PastPerformanceRecord[];
  complianceVerification: Record<string, unknown> | null;
  technologySelections: TechnologySelection[];
  serviceAreaApproaches: ServiceAreaApproach[];
  dataCallResponse: DataCallResponse;
  rfpChecklists?: RfpChecklists;
  volumeType?: string;
}

const ROLE_PATTERNS = [
  /program\s*manager/i,
  /lead\s*systems?\s*engineer/i,
  /cybersecurity\s*lead/i,
  /project\s*manager/i,
  /technical\s*lead/i,
  /chief\s*engineer/i,
  /deputy\s*program\s*manager/i,
  /quality\s*(?:assurance|control)\s*(?:manager|lead)/i,
];

const HUMAN_INPUT_PATTERN = /\[HUMAN INPUT REQUIRED[^\]]*\]/;

/**
 * Check 1: Verify personnel names mentioned near role titles are in the registry.
 */
function checkPersonnelNames(
  markdown: string,
  keyPersonnel: KeyPersonnelEntry[]
): ContentValidationWarning[] {
  const warnings: ContentValidationWarning[] = [];
  if (keyPersonnel.length === 0) return warnings;

  const registryNames = new Set(keyPersonnel.map(kp => kp.name.toLowerCase()));

  const namePattern = /(?:Dr\.\s+)?[A-Z][a-z]+(?:\s+[A-Z]\.?)?\s+[A-Z][a-z]+/g;
  const lines = markdown.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const hasRoleRef = ROLE_PATTERNS.some(p => p.test(line));
    if (!hasRoleRef) continue;

    const names = line.match(namePattern) || [];
    for (const name of names) {
      const normalizedName = name.toLowerCase().trim();
      if (!registryNames.has(normalizedName)) {
        const isCommonNonName = /^(the |our |this |that |each |all |per |for )/i.test(name);
        if (isCommonNonName) continue;

        const isInAnyRegistry = [...registryNames].some(rn =>
          rn.includes(normalizedName.split(' ').pop() || '')
        );
        if (!isInAnyRegistry) {
          warnings.push({
            check: 'personnel_name',
            severity: 'warning',
            message: `Name "${name}" appears near a key role title but is not in the Key Personnel Registry. Registry names: ${keyPersonnel.map(kp => kp.name).join(', ')}`,
            location: `Line ${i + 1}`,
          });
        }
      }
    }
  }

  return warnings;
}

/**
 * Check 2: Find cert names in the text and flag any that are expired.
 * Auto-corrects by adding [HUMAN INPUT REQUIRED] annotation.
 */
function checkExpiredCerts(
  markdown: string,
  personnel: PersonnelRecord[]
): { warnings: ContentValidationWarning[]; corrected: string; corrections: number } {
  const warnings: ContentValidationWarning[] = [];
  let corrected = markdown;
  let corrections = 0;

  const allCerts = new Map<string, { holder: string; expDate: Date; dateStr: string }>();
  for (const person of personnel) {
    for (const cert of (person.certifications || [])) {
      if (cert.expiration_date) {
        const expDate = new Date(cert.expiration_date);
        allCerts.set(cert.name.toLowerCase(), {
          holder: person.full_name,
          expDate,
          dateStr: cert.expiration_date,
        });
      }
    }
  }

  const now = new Date();

  for (const [certNameLower, info] of allCerts) {
    if (info.expDate >= now) continue;

    const certRegex = new RegExp(escapeRegex(certNameLower), 'gi');
    const matches = corrected.match(certRegex);
    if (!matches) continue;

    for (const match of matches) {
      const idx = corrected.indexOf(match);
      if (idx < 0) continue;

      const surroundingStart = Math.max(0, idx - 200);
      const surroundingEnd = Math.min(corrected.length, idx + match.length + 200);
      const surrounding = corrected.substring(surroundingStart, surroundingEnd);

      if (HUMAN_INPUT_PATTERN.test(surrounding)) continue;

      warnings.push({
        check: 'expired_cert',
        severity: 'error',
        message: `"${match}" (held by ${info.holder}) expired ${info.dateStr}. Mentioned without expiration caveat.`,
      });

      const insertPoint = idx + match.length;
      const annotation = ` [HUMAN INPUT REQUIRED: ${match} expired ${info.dateStr} — confirm renewal or remove]`;
      corrected = corrected.substring(0, insertPoint) + annotation + corrected.substring(insertPoint);
      corrections++;
      break;
    }
  }

  return { warnings, corrected, corrections };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Check 3: Extract key metrics from markdown and verify against source data.
 * Focuses on specific high-risk patterns: dollar values, FTE counts, uptime percentages.
 */
function checkMetrics(
  markdown: string,
  data: ContentValidationData
): ContentValidationWarning[] {
  const warnings: ContentValidationWarning[] = [];

  const sourceNumbers = new Set<string>();

  for (const pp of data.pastPerformance) {
    if (pp.contract_value) sourceNumbers.add(String(pp.contract_value));
    if (pp.annual_value) sourceNumbers.add(String(pp.annual_value));
    if (pp.team_size) sourceNumbers.add(String(pp.team_size));
    for (const ach of (pp.achievements || [])) {
      const nums = (ach.metric_value || '').match(/[\d,.]+%?/g) || [];
      nums.forEach(n => sourceNumbers.add(n.replace(/,/g, '')));
      const stmtNums = (ach.statement || '').match(/[\d,.]+%?/g) || [];
      stmtNums.forEach(n => sourceNumbers.add(n.replace(/,/g, '')));
    }
  }

  const cvStr = JSON.stringify(data.complianceVerification || {});
  const cvNums = cvStr.match(/[\d,.]+/g) || [];
  cvNums.forEach(n => sourceNumbers.add(n.replace(/,/g, '')));

  const dcrStr = JSON.stringify(data.dataCallResponse);
  const dcrNums = dcrStr.match(/\d{2,}/g) || [];
  dcrNums.forEach(n => sourceNumbers.add(n));

  const uptimePattern = /(\d{2,3}\.\d{1,3})%\s*(?:uptime|availability|infrastructure)/gi;
  let uptimeMatch;
  while ((uptimeMatch = uptimePattern.exec(markdown)) !== null) {
    const claimedValue = uptimeMatch[1];
    if (!sourceNumbers.has(claimedValue) && !sourceNumbers.has(claimedValue + '%')) {
      warnings.push({
        check: 'metrics_mismatch',
        severity: 'warning',
        message: `Uptime claim "${claimedValue}%" not found in source data. Verify against past performance records.`,
      });
    }
  }

  const dollarPattern = /\$(\d[\d,.]*)\s*(?:M|million|B|billion)?/gi;
  let dollarMatch;
  while ((dollarMatch = dollarPattern.exec(markdown)) !== null) {
    const rawValue = dollarMatch[1].replace(/,/g, '');
    if (rawValue.length >= 3 && !sourceNumbers.has(rawValue)) {
      const nearby = markdown.substring(
        Math.max(0, dollarMatch.index - 50),
        Math.min(markdown.length, dollarMatch.index + dollarMatch[0].length + 50)
      );
      if (!HUMAN_INPUT_PATTERN.test(nearby)) {
        warnings.push({
          check: 'metrics_mismatch',
          severity: 'info',
          message: `Dollar amount "$${dollarMatch[1]}" not directly found in source data. May be legitimate (extracted from narrative) — verify.`,
        });
      }
    }
  }

  return warnings;
}

/**
 * Check 4: SPRS score consistency.
 */
function checkSprsConsistency(
  markdown: string,
  complianceVerification: Record<string, unknown> | null
): ContentValidationWarning[] {
  const warnings: ContentValidationWarning[] = [];
  if (!complianceVerification) return warnings;

  const actualSprs = complianceVerification.sprs_score;
  if (typeof actualSprs !== 'number') return warnings;

  const sprsPattern = /SPRS\s*(?:score\s*(?:of\s*)?)?(\d{1,3})/gi;
  let match;
  while ((match = sprsPattern.exec(markdown)) !== null) {
    const claimed = parseInt(match[1], 10);
    if (claimed !== actualSprs) {
      warnings.push({
        check: 'sprs_mismatch',
        severity: 'error',
        message: `SPRS score ${claimed} in draft does not match source data (${actualSprs}). This must be corrected.`,
      });
    }
  }

  return warnings;
}

// ===== CHECK 5: SOO/SOW SECTION COVERAGE =====

function extractHeadings(markdown: string): Array<{ level: number; text: string; lineIndex: number }> {
  const lines = markdown.split('\n');
  const headings: Array<{ level: number; text: string; lineIndex: number }> = [];
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(#{1,4})\s+(.+)/);
    if (match) {
      headings.push({ level: match[1].length, text: match[2].trim(), lineIndex: i });
    }
  }
  return headings;
}

function fuzzyTitleMatch(heading: string, sectionName: string): boolean {
  const normH = heading.toLowerCase().replace(/[^a-z0-9\s]/g, '');
  const normS = sectionName.toLowerCase().replace(/[^a-z0-9\s]/g, '');
  if (normH.includes(normS) || normS.includes(normH)) return true;

  const sWords = normS.split(/\s+/).filter(w => w.length > 3);
  if (sWords.length === 0) return false;
  const matchCount = sWords.filter(w => normH.includes(w)).length;
  return matchCount / sWords.length >= 0.6;
}

function checkSectionCoverage(
  markdown: string,
  sections: RequirementSectionItem[]
): { warnings: ContentValidationWarning[]; corrected: string; corrections: number } {
  const warnings: ContentValidationWarning[] = [];
  let corrected = markdown;
  let corrections = 0;

  if (sections.length === 0) return { warnings, corrected, corrections };

  const headings = extractHeadings(corrected);

  for (const section of sections) {
    const sectionIdEscaped = section.sectionId.replace(/\./g, '\\.');
    const idRegex = new RegExp(`\\b${sectionIdEscaped}\\b`);

    const foundById = headings.some(h => idRegex.test(h.text));
    const foundByTitle = headings.some(h => fuzzyTitleMatch(h.text, section.sectionName));

    if (!foundById && !foundByTitle) {
      const topicsStr = section.requiredTopics.length > 0
        ? section.requiredTopics.slice(0, 3).join('; ')
        : section.sectionName;

      warnings.push({
        check: 'section_coverage',
        severity: 'error',
        message: `${section.documentStyle.toUpperCase()} ${section.sectionId} (${section.sectionName}) is MISSING from the draft. ` +
                 `This is a compliance failure. Source: ${section.source}`,
        location: section.sectionId,
      });

      const stubHeading = `\n\n## ${section.sectionId} ${section.sectionName}\n\n` +
        `[HUMAN INPUT REQUIRED: ${section.documentStyle.toUpperCase()} ${section.sectionId} requires coverage of: ${topicsStr}]\n`;
      corrected += stubHeading;
      corrections++;
    }
  }

  return { warnings, corrected, corrections };
}

// ===== CHECK 6: TECHNOLOGY ALLOWLIST =====

function checkTechnologyAllowlist(
  markdown: string,
  technologies: TechChecklistItem[],
  conflicts: TechConflict[]
): { warnings: ContentValidationWarning[]; corrected: string; corrections: number } {
  const warnings: ContentValidationWarning[] = [];
  let corrected = markdown;
  let corrections = 0;

  if (technologies.length === 0) return { warnings, corrected, corrections };

  const markdownLower = markdown.toLowerCase();

  for (const tech of technologies) {
    const techNameLower = tech.name.toLowerCase();
    const wordBoundaryPattern = new RegExp(`\\b${escapeRegex(techNameLower)}\\b`, 'i');

    if (!wordBoundaryPattern.test(markdownLower)) {
      warnings.push({
        check: 'technology_allowlist',
        severity: tech.requirementLevel === 'mandatory' ? 'warning' : 'info',
        message: `Required technology "${tech.name}" (${tech.category}, from ${tech.sourceSection}) ` +
                 `is not mentioned in the draft.`,
      });
    }
  }

  for (const conflict of conflicts) {
    for (const wrongTool of conflict.commonWrongTools) {
      const wrongPattern = new RegExp(`\\b${escapeRegex(wrongTool)}\\b`, 'gi');
      const rfpPattern = new RegExp(`\\b${escapeRegex(conflict.rfpTool)}\\b`, 'i');

      if (wrongPattern.test(markdown) && !rfpPattern.test(markdown)) {
        warnings.push({
          check: 'technology_conflict',
          severity: 'error',
          message: `Draft uses "${wrongTool}" but the RFP specifies "${conflict.rfpTool}" for ${conflict.category}. ` +
                   `This is a compliance error.`,
        });

        const annotation = ` [HUMAN INPUT REQUIRED: Draft uses ${wrongTool} but RFP specifies ${conflict.rfpTool}]`;
        corrected = corrected.replace(wrongPattern, (match) => {
          corrections++;
          return `${match}${annotation}`;
        });
        break;
      }
    }
  }

  return { warnings, corrected, corrections };
}

// ===== CHECK 7: CDRL COVERAGE =====

function checkCdrlCoverage(
  markdown: string,
  cdrls: CdrlItem[]
): ContentValidationWarning[] {
  const warnings: ContentValidationWarning[] = [];
  if (cdrls.length === 0) return warnings;

  const cdrlIdPattern = /\b([A-Z]-?\d{3,4})\b/g;
  const draftIds = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = cdrlIdPattern.exec(markdown)) !== null) {
    draftIds.add(match[1]);
  }

  const altPattern = /\bCDRL[-\s]?(\d{3})\b/gi;
  while ((match = altPattern.exec(markdown)) !== null) {
    draftIds.add(`CDRL-${match[1]}`);
  }

  const expectedIds = new Set(cdrls.map(c => c.id));

  if (draftIds.size > 0 && draftIds.size !== expectedIds.size) {
    warnings.push({
      check: 'cdrl_mismatch',
      severity: 'error',
      message: `CDRL count mismatch: draft has ${draftIds.size} CDRL IDs but the RFP defines ${expectedIds.size}. ` +
               `Expected: ${[...expectedIds].join(', ')}. Found: ${[...draftIds].join(', ')}.`,
    });
  }

  for (const cdrl of cdrls) {
    const found = draftIds.has(cdrl.id) ||
      [...draftIds].some(d => d.replace(/-/g, '') === cdrl.id.replace(/-/g, ''));

    if (!found && draftIds.size > 0) {
      warnings.push({
        check: 'cdrl_mismatch',
        severity: 'warning',
        message: `CDRL "${cdrl.id}: ${cdrl.title}" from the RFP is not referenced in the draft.`,
      });
    }
  }

  return warnings;
}

// ===== CHECK 8: PERFORMANCE METRICS =====

function checkPerformanceMetrics(
  markdown: string,
  metrics: MetricsItem[]
): ContentValidationWarning[] {
  const warnings: ContentValidationWarning[] = [];
  if (metrics.length === 0) return warnings;

  const markdownLower = markdown.toLowerCase();

  for (const m of metrics) {
    const targetEscaped = escapeRegex(m.target.toLowerCase());
    const targetPattern = new RegExp(targetEscaped, 'i');

    const metricKeywords = m.metric.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const keywordFound = metricKeywords.some(kw => markdownLower.includes(kw));

    if (!targetPattern.test(markdown) && !keywordFound) {
      warnings.push({
        check: 'performance_metric',
        severity: 'warning',
        message: `Performance metric "${m.metric}: ${m.target}" (from §${m.sourceSection}) ` +
                 `is not referenced in the draft.`,
      });
    }
  }

  return warnings;
}

// ===== CHECK 9: STUB-ONLY SECTIONS =====

const PLACEHOLDER_PATTERN = /\[(HUMAN INPUT REQUIRED|PLACEHOLDER)[^\]]*\]/g;

function checkStubOnlySections(
  markdown: string
): ContentValidationWarning[] {
  const warnings: ContentValidationWarning[] = [];

  const sectionSplitPattern = /^(#{1,4})\s+(.+)/gm;
  const sectionStarts: Array<{ level: number; title: string; startIdx: number }> = [];
  let sMatch: RegExpExecArray | null;

  while ((sMatch = sectionSplitPattern.exec(markdown)) !== null) {
    sectionStarts.push({
      level: sMatch[1].length,
      title: sMatch[2].trim(),
      startIdx: sMatch.index + sMatch[0].length,
    });
  }

  for (let i = 0; i < sectionStarts.length; i++) {
    const start = sectionStarts[i].startIdx;
    const end = i + 1 < sectionStarts.length
      ? markdown.lastIndexOf('\n', sectionStarts[i + 1].startIdx - sectionStarts[i + 1].title.length - sectionStarts[i + 1].level - 2)
      : markdown.length;

    const sectionBody = markdown.substring(start, end);
    const cleanedBody = sectionBody.replace(PLACEHOLDER_PATTERN, '').trim();
    const wordCount = cleanedBody.split(/\s+/).filter(w => w.length > 0).length;

    if (wordCount < 50 && sectionBody.includes('[')) {
      warnings.push({
        check: 'stub_only_section',
        severity: 'warning',
        message: `Section "${sectionStarts[i].title}" has only ${wordCount} words of real content ` +
                 `(< 50 word threshold). Likely a stub that needs substantive content.`,
        location: sectionStarts[i].title,
      });
    }
  }

  return warnings;
}

/**
 * Main entry point. Runs all content validation checks.
 */
export function validateGeneratedContent(
  markdown: string,
  data: ContentValidationData
): ContentValidationResult {
  const allWarnings: ContentValidationWarning[] = [];
  let correctedMarkdown = markdown;
  let autoCorrections = 0;

  // Check 1: Personnel names
  allWarnings.push(...checkPersonnelNames(markdown, data.keyPersonnel));

  // Check 2: Expired certs — also auto-corrects
  const certResult = checkExpiredCerts(correctedMarkdown, data.personnel);
  allWarnings.push(...certResult.warnings);
  correctedMarkdown = certResult.corrected;
  autoCorrections += certResult.corrections;

  // Check 3: Metrics
  allWarnings.push(...checkMetrics(markdown, data));

  // Check 4: SPRS
  allWarnings.push(
    ...checkSprsConsistency(markdown, data.complianceVerification)
  );

  // Check 5: Section coverage (when checklists provided)
  if (data.rfpChecklists && data.rfpChecklists.sections.length > 0) {
    const sectionResult = checkSectionCoverage(correctedMarkdown, data.rfpChecklists.sections);
    allWarnings.push(...sectionResult.warnings);
    correctedMarkdown = sectionResult.corrected;
    autoCorrections += sectionResult.corrections;
  }

  // Check 6: Technology allowlist (when checklists provided)
  if (data.rfpChecklists && data.rfpChecklists.technologies.length > 0) {
    const techResult = checkTechnologyAllowlist(
      correctedMarkdown,
      data.rfpChecklists.technologies,
      data.rfpChecklists.techConflicts
    );
    allWarnings.push(...techResult.warnings);
    correctedMarkdown = techResult.corrected;
    autoCorrections += techResult.corrections;
  }

  // Check 7: CDRL coverage (when checklists provided)
  if (data.rfpChecklists && data.rfpChecklists.cdrls.length > 0) {
    allWarnings.push(...checkCdrlCoverage(correctedMarkdown, data.rfpChecklists.cdrls));
  }

  // Check 8: Performance metrics (when checklists provided)
  if (data.rfpChecklists && data.rfpChecklists.metrics.length > 0) {
    allWarnings.push(...checkPerformanceMetrics(correctedMarkdown, data.rfpChecklists.metrics));
  }

  // Check 9: Stub-only sections
  allWarnings.push(...checkStubOnlySections(correctedMarkdown));

  return { warnings: allWarnings, correctedMarkdown, autoCorrections };
}
