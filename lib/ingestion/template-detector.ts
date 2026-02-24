/**
 * Template Detector
 * Phase 6: Multi-Document Ingestion
 *
 * Identifies fillable templates within solicitation documents.
 * Maps required fields, suggests auto-fill sources from company_profiles data,
 * and tags each field as 'action_required' or 'reference_only'.
 *
 * Per user decision: 'action_required' keeps the action list focused on what
 * actually needs doing; 'reference_only' is for informational documents like
 * wage determinations.
 */

import { anthropic, MODEL } from '@/lib/anthropic/client';
import type {
  TemplateFieldType,
  TemplateFieldTag,
} from '@/lib/supabase/solicitation-types';

// ===== TYPES =====

/**
 * A single detected field from a fillable template.
 * Matches the template_field_mappings table schema (minus id, created_at).
 */
export interface TemplateFieldResult {
  /** The solicitation_document_id this field belongs to */
  solicitation_document_id: string;
  /** Field label or name as it appears in the document */
  field_name: string;
  /** Data type of the field */
  field_type: TemplateFieldType;
  /** Whether the field must be completed for proposal submission */
  is_required: boolean;
  /** Section reference in the document, e.g., "Block 9", "Line Item 3" */
  section_reference: string;
  /**
   * Dot-notation path to auto-populate from company data.
   * e.g., "company_profiles.legal_name", "company_profiles.cage_code",
   * "solicitations.solicitation_number"
   */
  auto_fill_source: string | null;
  /**
   * Whether this field needs user action or is reference-only.
   * 'action_required' = user must fill; 'reference_only' = display/context only.
   */
  tag: TemplateFieldTag;
}

// ===== HELPER =====

/**
 * Extract JSON from markdown code blocks returned by Anthropic.
 */
function extractJSON(text: string): string {
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    return jsonMatch[1].trim();
  }
  return text.trim();
}

/**
 * Document types that are likely to contain fillable templates.
 * Used as a pre-filter before calling Anthropic.
 */
const TEMPLATE_ELIGIBLE_TYPES = new Set([
  'pricing_template',
  'cdrls',
  'other_unclassified',
  // dd254 and provisions can also have fillable fields
  'dd254',
  'provisions',
]);

/**
 * Auto-fill mapping from common government form field names to company_profiles data.
 * Claude uses this as reference context when suggesting auto_fill_source values.
 */
const AUTO_FILL_REFERENCE = `
Known auto-fill mappings (company_profiles table):
- Legal Entity Name / Company Name / Offeror Name → company_profiles.legal_name
- UEI / Unique Entity Identifier → company_profiles.uei
- CAGE Code → company_profiles.cage_code
- DUNS Number → company_profiles.duns_number
- Business Address / Street Address → company_profiles.address_street
- City → company_profiles.address_city
- State → company_profiles.address_state
- ZIP / Postal Code → company_profiles.address_zip
- Country → company_profiles.address_country
- Primary POC Name / Technical POC → company_profiles.primary_poc_name
- Primary POC Email → company_profiles.primary_poc_email
- Primary POC Phone → company_profiles.primary_poc_phone
- Business Type / Organization Type → company_profiles.business_type
- NAICS Code → company_profiles.naics_codes (array, use first)
- Small Business Status → derived from company_profiles.socioeconomic_certs
- Socioeconomic Status (SDVOSB/WOSB/8(a)) → company_profiles.socioeconomic_certs

Known auto-fill mappings (solicitations table):
- Solicitation Number / RFP Number → solicitations.solicitation_number
- Agency / Contracting Agency → solicitations.agency

If a field does not map to any known source, set auto_fill_source to null.
`.trim();

// ===== DETECT TEMPLATE FIELDS =====

/**
 * Analyzes a document to determine if it is a fillable template.
 *
 * Only runs on document types likely to be templates:
 * pricing_template, cdrls, other_unclassified, dd254, provisions.
 * Also runs if "template" or "form" appears in the filename.
 *
 * If the document is a fillable template, returns an array of TemplateFieldResult
 * records to insert into template_field_mappings. Returns null if not a template.
 *
 * @param document - The solicitation document to analyze
 * @returns Array of detected field mappings, or null if document is not a template
 */
export async function detectTemplateFields(
  document: {
    id: string;
    extracted_text: string;
    document_type: string;
    filename: string;
  }
): Promise<TemplateFieldResult[] | null> {
  // Pre-filter: only run on likely template document types or filename hints
  const filenameHint =
    document.filename.toLowerCase().includes('template') ||
    document.filename.toLowerCase().includes('form');

  const isEligibleType = TEMPLATE_ELIGIBLE_TYPES.has(document.document_type);

  if (!isEligibleType && !filenameHint) {
    return null;
  }

  const documentTextTruncated = document.extracted_text.substring(0, 15000);

  let aiResponse;
  try {
    aiResponse = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `You are analyzing a government solicitation document to determine if it is a fillable template or form that the offeror must complete.

Document filename: ${document.filename}
Document type: ${document.document_type}

DOCUMENT CONTENT:
${documentTextTruncated}

${AUTO_FILL_REFERENCE}

STEP 1: Determine if this is a fillable template.
A fillable template contains:
- Blank fields, boxes, or lines for the offeror to complete (e.g., "Name: ___", "[Insert Company Name]", "CAGE Code: _______")
- Tables with empty cells requiring data entry
- Fields marked as "TBD", "N/A to be filled", or similar placeholders
- Standard government forms (SF-xxx, DD-xxx) with fillable blocks

A reference-only document (NOT a fillable template) contains:
- Wage determinations, prevailing wage tables
- Clauses that merely describe requirements without blank fields
- Informational attachments with no fields to fill

STEP 2: If it IS a fillable template, extract each field:
1. field_name — the label or name of the field (e.g., "Legal Entity Name", "CAGE Code", "Period of Performance Start Date")
2. field_type — one of: "text", "number", "date", "boolean", "selection"
3. is_required — true if the field is marked required or is clearly essential for proposal submission
4. section_reference — where in the document this field appears (e.g., "Block 4", "Section A Line 3", "Tab 2 Column B")
5. auto_fill_source — dot-notation path from the auto-fill reference above, or null if no mapping exists
6. tag — "action_required" if the offeror must fill this field; "reference_only" if it is informational only

STEP 3: Return your response.

If this is NOT a fillable template, respond with:
\`\`\`json
null
\`\`\`

If this IS a fillable template, respond with an array of field objects (empty array [] if you cannot identify specific fields):
\`\`\`json
[
  {
    "field_name": "Legal Entity Name",
    "field_type": "text",
    "is_required": true,
    "section_reference": "Block 1",
    "auto_fill_source": "company_profiles.legal_name",
    "tag": "action_required"
  },
  {
    "field_name": "Period of Performance End Date",
    "field_type": "date",
    "is_required": true,
    "section_reference": "Block 8b",
    "auto_fill_source": null,
    "tag": "action_required"
  }
]
\`\`\`

Respond ONLY with the JSON. No explanation or prose.`,
        },
      ],
    });
  } catch (err) {
    console.error(`Anthropic error detecting template fields for document ${document.id}:`, err);
    return null;
  }

  const content = aiResponse.content[0];
  if (content.type !== 'text') {
    console.error(`Unexpected Anthropic response type for template detection (doc ${document.id})`);
    return null;
  }

  // Parse the AI response
  let parsed: null | Array<{
    field_name: string;
    field_type: string;
    is_required: boolean;
    section_reference: string;
    auto_fill_source: string | null;
    tag: string;
  }>;

  try {
    const jsonText = extractJSON(content.text);
    parsed = JSON.parse(jsonText);
  } catch (err) {
    console.error(`Failed to parse template detection JSON for doc ${document.id}:`, err);
    return null;
  }

  // AI returned null — not a template
  if (parsed === null) {
    return null;
  }

  if (!Array.isArray(parsed)) {
    console.error(`Template detection returned non-array for doc ${document.id}`);
    return null;
  }

  // Empty array is valid — template with no identifiable fields
  if (parsed.length === 0) {
    return [];
  }

  const validFieldTypes = new Set<TemplateFieldType>(['text', 'number', 'date', 'boolean', 'selection']);
  const validTags = new Set<TemplateFieldTag>(['action_required', 'reference_only']);

  // Map and validate each field
  return parsed.map((field) => {
    const fieldType = validFieldTypes.has(field.field_type as TemplateFieldType)
      ? (field.field_type as TemplateFieldType)
      : 'text';

    const tag = validTags.has(field.tag as TemplateFieldTag)
      ? (field.tag as TemplateFieldTag)
      : 'action_required';

    return {
      solicitation_document_id: document.id,
      field_name: field.field_name || 'Unknown Field',
      field_type: fieldType,
      is_required: Boolean(field.is_required),
      section_reference: field.section_reference || '',
      auto_fill_source: field.auto_fill_source || null,
      tag,
    };
  });
}
