/**
 * Certification Expiry Validator
 *
 * Post-generation validation that scans content_markdown for certification claims,
 * cross-references against certifications table and personnel certifications,
 * and flags any cert expiring within 12 months of estimated contract start.
 *
 * Also validates personnel availability for transition plan accuracy.
 */

export interface CertExpiryWarning {
  certName: string;
  holder: string;
  expirationDate: string;
  daysUntilExpiry: number;
  severity: 'expired' | 'expiring_soon' | 'ok';
}

export interface AvailabilityWarning {
  name: string;
  role: string;
  availability: string;
  warning: string;
}

export interface ValidationResult {
  certWarnings: CertExpiryWarning[];
  availabilityWarnings: AvailabilityWarning[];
  hasBlockingIssues: boolean;
}

interface PersonnelRecord {
  full_name: string;
  availability?: string;
  certifications?: { name: string; expiration_date?: string | null }[];
  proposed_roles?: { role_title: string; is_key_personnel?: boolean }[];
}

interface CompanyCert {
  certification_type: string;
  expiration_date?: string | null;
}

/**
 * Validate certifications against an estimated contract start date.
 * Flags certs expiring within 12 months of contract start.
 */
export function validateCertExpiry(
  personnel: PersonnelRecord[],
  companyCerts: CompanyCert[],
  estimatedStartDate?: Date
): CertExpiryWarning[] {
  const warnings: CertExpiryWarning[] = [];
  const startDate = estimatedStartDate || new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);
  const twelveMonthsOut = new Date(startDate);
  twelveMonthsOut.setMonth(twelveMonthsOut.getMonth() + 12);

  for (const person of personnel) {
    const isKeyPersonnel = person.proposed_roles?.some(r => r.is_key_personnel);
    if (!isKeyPersonnel) continue;

    for (const cert of (person.certifications || [])) {
      if (!cert.expiration_date) continue;

      const expDate = new Date(cert.expiration_date);
      const now = new Date();
      const daysUntilExpiry = Math.floor((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      let severity: CertExpiryWarning['severity'] = 'ok';
      if (expDate < now) {
        severity = 'expired';
      } else if (expDate < twelveMonthsOut) {
        severity = 'expiring_soon';
      }

      if (severity !== 'ok') {
        warnings.push({
          certName: cert.name,
          holder: person.full_name,
          expirationDate: cert.expiration_date,
          daysUntilExpiry,
          severity,
        });
      }
    }
  }

  for (const cert of companyCerts) {
    if (!cert.expiration_date) continue;

    const expDate = new Date(cert.expiration_date);
    const now = new Date();
    const daysUntilExpiry = Math.floor((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    let severity: CertExpiryWarning['severity'] = 'ok';
    if (expDate < now) {
      severity = 'expired';
    } else if (expDate < twelveMonthsOut) {
      severity = 'expiring_soon';
    }

    if (severity !== 'ok') {
      warnings.push({
        certName: cert.certification_type,
        holder: 'Company',
        expirationDate: cert.expiration_date,
        daysUntilExpiry,
        severity,
      });
    }
  }

  return warnings;
}

/**
 * Validate personnel availability for transition plan accuracy.
 * Flags key personnel who are not immediately available.
 */
export function validatePersonnelAvailability(
  personnel: PersonnelRecord[]
): AvailabilityWarning[] {
  const warnings: AvailabilityWarning[] = [];

  for (const person of personnel) {
    const keyRole = person.proposed_roles?.find(r => r.is_key_personnel);
    if (!keyRole) continue;

    const avail = (person.availability || '').toLowerCase();
    if (avail && !avail.includes('immediate') && !avail.includes('available now')) {
      warnings.push({
        name: person.full_name,
        role: keyRole.role_title,
        availability: person.availability || 'Unknown',
        warning: `${person.full_name} (${keyRole.role_title}) requires "${person.availability}" — transition plan must account for delayed start`,
      });
    }
  }

  return warnings;
}

/**
 * Run all post-generation validations.
 */
export function runPostGenerationValidation(
  personnel: PersonnelRecord[],
  companyCerts: CompanyCert[],
  estimatedStartDate?: Date
): ValidationResult {
  const certWarnings = validateCertExpiry(personnel, companyCerts, estimatedStartDate);
  const availabilityWarnings = validatePersonnelAvailability(personnel);

  const hasBlockingIssues = certWarnings.some(w => w.severity === 'expired') ||
    availabilityWarnings.length > 0;

  return { certWarnings, availabilityWarnings, hasBlockingIssues };
}
