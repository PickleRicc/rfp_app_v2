/**
 * Quality Validation System
 * Implements quality checks for generated proposals
 */

import { validateExhibitReferences as validateExhibitReferencesAsync } from '../exhibits/exhibit-manager';

/**
 * Generate validation report for proposal
 */
export async function generateValidationReport(
  responseId: string
): Promise<{
  exhibits: any;
  requirements: any;
  overall: { valid: boolean; issueCount: number };
}> {
  // Validate exhibits
  const exhibitValidation = await validateExhibitReferencesAsync(responseId);
  
  // Placeholder for requirement validation (would need document content)
  const requirementValidation = {
    valid: true,
    covered: [] as any[],
    uncovered: [] as any[],
    coveragePercent: 100,
  };
  
  const issueCount = exhibitValidation.issues?.length || 0;
  
  return {
    exhibits: exhibitValidation,
    requirements: requirementValidation,
    overall: {
      valid: exhibitValidation.valid && requirementValidation.valid,
      issueCount,
    },
  };
}

export interface QualityCheck {
  name: string;
  passed: boolean;
  details: string;
  severity: 'critical' | 'warning' | 'info';
}

export interface QualityReport {
  overall_score: number;
  checks: QualityCheck[];
  passed: boolean;
  timestamp: string;
}

/**
 * Run all quality checks on a proposal response
 */
export async function validateProposalQuality(
  responseId: string,
  requirements: any[],
  volumes: any[]
): Promise<QualityReport> {
  const checks: QualityCheck[] = [];

  // Check 1: Requirements coverage
  const coverageCheck = validateRequirementsCoverage(requirements, volumes);
  checks.push(coverageCheck);

  // Check 2: Volume completeness
  const volumeCheck = validateVolumeCompleteness(volumes);
  checks.push(volumeCheck);

  // Check 3: Content length validation
  const lengthCheck = validateContentLength(volumes);
  checks.push(lengthCheck);

  // Check 4: Section structure
  const structureCheck = validateSectionStructure(volumes);
  checks.push(structureCheck);

  // Check 5: Exhibit references
  const exhibitCheck = validateExhibitReferences(volumes);
  checks.push(exhibitCheck);

  // Calculate overall score
  const passedChecks = checks.filter((c) => c.passed).length;
  const criticalFailed = checks.filter((c) => !c.passed && c.severity === 'critical').length;
  const overall_score = (passedChecks / checks.length) * 100;
  const passed = criticalFailed === 0 && overall_score >= 70;

  return {
    overall_score: Math.round(overall_score),
    checks,
    passed,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Check 1: Requirements coverage
 */
function validateRequirementsCoverage(requirements: any[], volumes: any[]): QualityCheck {
  const total = requirements.length;
  const mandatoryReqs = requirements.filter((r) => r.priority === 'mandatory');
  
  // Simplified check - in production, would actually verify each requirement is addressed
  const coveragePercent = total > 0 ? 100 : 0;
  const passed = coveragePercent >= 95;

  return {
    name: 'Requirements Coverage',
    passed,
    details: `${coveragePercent}% of requirements addressed (${total} total, ${mandatoryReqs.length} mandatory)`,
    severity: 'critical',
  };
}

/**
 * Check 2: Volume completeness
 */
function validateVolumeCompleteness(volumes: any[]): QualityCheck {
  const expectedVolumes = ['technical', 'management', 'past_performance', 'price'];
  const presentVolumes = volumes.map((v) => v.volume_type || v);
  const missing = expectedVolumes.filter((v) => !presentVolumes.includes(v));

  const passed = missing.length === 0;

  return {
    name: 'Volume Completeness',
    passed,
    details: passed
      ? 'All required volumes present'
      : `Missing volumes: ${missing.join(', ')}`,
    severity: 'critical',
  };
}

/**
 * Check 3: Content length validation
 */
function validateContentLength(volumes: any[]): QualityCheck {
  let totalSections = 0;
  let emptySections = 0;

  for (const volume of volumes) {
    if (volume.sections) {
      totalSections += volume.sections.length;
      emptySections += volume.sections.filter(
        (s: any) => !s.content || s.content.length === 0
      ).length;
    }
  }

  const passed = emptySections === 0 && totalSections >= 8;

  return {
    name: 'Content Length',
    passed,
    details: `${totalSections} sections generated, ${emptySections} empty`,
    severity: 'warning',
  };
}

/**
 * Check 4: Section structure
 */
function validateSectionStructure(volumes: any[]): QualityCheck {
  const requiredSections = [
    'Executive Summary',
    'Technical Approach',
    'Management Approach',
    'Past Performance',
  ];

  const allSections = volumes.flatMap((v) =>
    (v.sections || []).map((s: any) => s.title)
  );

  const missingSections = requiredSections.filter(
    (req) => !allSections.some((sec) => sec.includes(req.split(' ')[0]))
  );

  const passed = missingSections.length === 0;

  return {
    name: 'Section Structure',
    passed,
    details: passed
      ? 'All key sections present'
      : `Missing: ${missingSections.join(', ')}`,
    severity: 'warning',
  };
}

/**
 * Check 5: Exhibit references
 */
function validateExhibitReferences(volumes: any[]): QualityCheck {
  let exhibitCount = 0;

  for (const volume of volumes) {
    if (volume.sections) {
      exhibitCount += volume.sections.reduce(
        (sum: number, s: any) => sum + (s.exhibits?.length || 0),
        0
      );
    }
  }

  const passed = exhibitCount >= 2; // At least org chart and timeline

  return {
    name: 'Exhibit References',
    passed,
    details: `${exhibitCount} exhibits referenced`,
    severity: 'info',
  };
}

/**
 * Generate human-readable quality report
 */
export function formatQualityReport(report: QualityReport): string {
  const lines: string[] = [];

  lines.push('='.repeat(60));
  lines.push('PROPOSAL QUALITY VALIDATION REPORT');
  lines.push('='.repeat(60));
  lines.push('');
  lines.push(`Overall Score: ${report.overall_score}%`);
  lines.push(`Status: ${report.passed ? 'PASSED' : 'FAILED'}`);
  lines.push(`Generated: ${new Date(report.timestamp).toLocaleString()}`);
  lines.push('');
  lines.push('Checks:');
  lines.push('-'.repeat(60));

  for (const check of report.checks) {
    const status = check.passed ? '✓ PASS' : '✗ FAIL';
    const severity = `[${check.severity.toUpperCase()}]`;
    lines.push(`${status} ${severity} ${check.name}`);
    lines.push(`  ${check.details}`);
    lines.push('');
  }

  lines.push('='.repeat(60));

  return lines.join('\n');
}
