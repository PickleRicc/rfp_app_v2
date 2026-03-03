/**
 * Blocking Field Validation
 *
 * Server-side validation for compliance-blocking fields in the Tier 2 data call.
 * Used by:
 * - PUT /api/solicitations/[id]/data-call (on status='completed' transition)
 * - POST /api/solicitations/[id]/draft (pre-draft compliance gate)
 *
 * Walks the schema, finds all fields with `blocking: true`, validates the
 * corresponding values from the data call response, and returns an array of
 * errors. When the array is non-empty, the operation should be rejected.
 */

import type {
  DataCallFormSchema,
  DataCallFormField,
  PastPerformanceRef,
  KeyPersonnelEntry,
} from '@/lib/supabase/tier2-types';

export interface BlockingValidationError {
  section_id: string;
  field_key: string;
  field_label: string;
  message: string;
  rfp_citation: string | null;
}

/**
 * Validate a single field value against its validation rules (server-side).
 * Returns an error message or null if valid.
 */
function validateFieldValue(
  field: DataCallFormField,
  val: unknown,
  prefix?: string
): string | null {
  if (!field.validation) return null;
  const v = field.validation;
  const label = prefix ? `${prefix}: ${field.label}` : field.label;

  // Numeric validation
  if (field.type === 'number' && val !== '' && val != null) {
    const num = typeof val === 'number' ? val : parseFloat(String(val));
    if (isNaN(num)) {
      return `${label} must be a valid number`;
    }
    if (v.min !== undefined && num < v.min) {
      return v.validation_hint ?? `${label} must be at least ${v.min}`;
    }
    if (v.max !== undefined && num > v.max) {
      return v.validation_hint ?? `${label} must be at most ${v.max}`;
    }
  }

  // Allowed values validation
  if (v.allowed_values && val !== '' && val != null) {
    if (!v.allowed_values.includes(String(val))) {
      return v.validation_hint ?? `${label}: "${val}" is not an accepted value`;
    }
  }

  // Date recency validation
  if (v.recency_cutoff_date && val !== '' && val != null) {
    const dateVal = new Date(String(val));
    const cutoff = new Date(v.recency_cutoff_date);
    if (!isNaN(dateVal.getTime()) && dateVal < cutoff) {
      return v.validation_hint ?? `${label}: date is outside the recency window`;
    }
  }

  // Pattern validation
  if (v.pattern && val !== '' && val != null) {
    const regex = new RegExp(v.pattern);
    if (!regex.test(String(val))) {
      return v.validation_hint ?? `${label} does not match the required format`;
    }
  }

  return null;
}

/**
 * Validate all blocking fields in a data call schema against the saved response data.
 * Returns an array of blocking errors. Empty array = all blocking fields are valid.
 */
export function validateBlockingFields(
  schema: DataCallFormSchema,
  data: Record<string, unknown>
): BlockingValidationError[] {
  const errors: BlockingValidationError[] = [];

  for (const section of schema.sections) {
    const blockingFields = section.fields.filter((f) => f.blocking);
    if (blockingFields.length === 0) continue;

    const sectionData = data[section.id];

    // Dynamic array sections: past_performance
    if (section.id === 'past_performance') {
      const refs = (sectionData as PastPerformanceRef[]) ?? [];
      refs.forEach((ref, i) => {
        blockingFields.forEach((field) => {
          const val = (ref as unknown as Record<string, unknown>)[field.key];
          if (val === '' || val == null) {
            errors.push({
              section_id: section.id,
              field_key: `${field.key}_${i}`,
              field_label: field.label,
              message: `Reference ${i + 1}: ${field.label} is required (compliance-blocking)`,
              rfp_citation: field.rfp_citation,
            });
          } else if (field.validation) {
            const valError = validateFieldValue(field, val, `Reference ${i + 1}`);
            if (valError) {
              errors.push({
                section_id: section.id,
                field_key: `${field.key}_${i}`,
                field_label: field.label,
                message: valError,
                rfp_citation: field.rfp_citation,
              });
            }
          }
        });
      });
      continue;
    }

    // Dynamic array sections: key_personnel
    if (section.id === 'key_personnel') {
      const entries = (sectionData as KeyPersonnelEntry[]) ?? [];
      entries.forEach((entry, i) => {
        blockingFields.forEach((field) => {
          const val = (entry as unknown as Record<string, unknown>)[field.key];
          if (val === '' || val == null || (Array.isArray(val) && val.length === 0)) {
            errors.push({
              section_id: section.id,
              field_key: `${field.key}_${i}`,
              field_label: field.label,
              message: `Personnel ${i + 1}: ${field.label} is required (compliance-blocking)`,
              rfp_citation: field.rfp_citation,
            });
          }
        });
      });
      continue;
    }

    // Static sections (opportunity_details, compliance_verification, etc.)
    if (sectionData && typeof sectionData === 'object' && !Array.isArray(sectionData)) {
      const dataObj = sectionData as Record<string, unknown>;
      blockingFields.forEach((field) => {
        const val = dataObj[field.key];

        // Required check
        if (val === '' || val == null) {
          errors.push({
            section_id: section.id,
            field_key: field.key,
            field_label: field.label,
            message: `${field.label} is required (compliance-blocking)`,
            rfp_citation: field.rfp_citation,
          });
        }
        // Validation rules
        else if (field.validation) {
          const valError = validateFieldValue(field, val);
          if (valError) {
            errors.push({
              section_id: section.id,
              field_key: field.key,
              field_label: field.label,
              message: valError,
              rfp_citation: field.rfp_citation,
            });
          }
        }
      });
    }
  }

  return errors;
}
