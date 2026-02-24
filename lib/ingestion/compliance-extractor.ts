/**
 * Compliance Extraction Engine
 * Phase 7: Compliance Extraction
 *
 * AI-powered extraction library for government solicitation compliance data.
 * Makes structured Anthropic API calls to extract Section L, Section M,
 * administrative data, and rating scales from solicitation document text.
 *
 * Each exported function accepts concatenated document text and returns
 * an array of ExtractionResult objects ready to be upserted to
 * the compliance_extractions table.
 *
 * All functions:
 * - Use claude-sonnet-4-5 with max_tokens 4096, temperature 0
 * - Include a government proposal analyst system prompt
 * - Use extractJSON to safely parse Claude's JSON response
 * - Return empty array on parse failure (never throw to caller)
 * - Set confidence based on Claude's explicit data-found indicators
 */

import { anthropic, MODEL } from '@/lib/anthropic/client';

// ===== TYPES =====

/**
 * A single extracted compliance data point ready for upsert to compliance_extractions.
 * field_value is unknown to accept JSONB-compatible values (string, number, array, object).
 */
export interface ExtractionResult {
  field_name: string;
  field_label: string;
  field_value: unknown; // JSONB-compatible
  confidence: 'high' | 'medium' | 'low';
}

// ===== HELPER =====

/**
 * Extract JSON from markdown code blocks returned by Anthropic.
 * Strips ```json ... ``` wrapper if present, otherwise returns trimmed text.
 * Matches the extractJSON pattern used in solicitation-classifier.ts and reconciliation-engine.ts.
 */
function extractJSON(text: string): string {
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    return jsonMatch[1].trim();
  }
  return text.trim();
}

/**
 * Concatenate and truncate document texts to a safe context window size.
 * Prioritizes base RFP text — later documents are appended up to the limit.
 */
function truncateTexts(documentTexts: string[], maxChars = 30000): string {
  const combined = documentTexts.join('\n\n---\n\n');
  return combined.substring(0, maxChars);
}

// ===== EXTRACTION FUNCTIONS =====

/**
 * Extract Section L compliance data from solicitation documents.
 *
 * Extracts:
 * - Volume structure (names, page limits, format rules per volume)
 * - Required attachments
 * - Required forms and certifications
 * - Formatting rules (font, size, margins, spacing)
 *
 * Returns one ExtractionResult per distinct field.
 */
export async function extractSectionL(documentTexts: string[]): Promise<ExtractionResult[]> {
  const textSample = truncateTexts(documentTexts);

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      temperature: 0,
      system:
        'You are an expert government proposal compliance analyst with 15+ years of experience ' +
        'reading and interpreting federal solicitations (RFPs, RFQs). You specialize in ' +
        'extracting precise, actionable compliance data from Section L (Instructions to Offerors). ' +
        'Extract only information explicitly stated in the document — do not infer or fabricate.',
      messages: [
        {
          role: 'user',
          content: `Extract Section L compliance data from this government solicitation document.

Solicitation text:
${textSample}

Extract the following fields and return ONLY valid JSON:

{
  "volume_structure": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": {
      "volumes": [
        {
          "name": "Volume I - Technical",
          "page_limit": 25,
          "format_rules": "Single-spaced, Times New Roman 12pt"
        }
      ]
    }
  },
  "required_attachments": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": ["Past Performance Questionnaire", "Subcontracting Plan"]
  },
  "required_forms": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": ["SF 1449", "FAR 52.209-5 Certification", "SF 330"]
  },
  "formatting_rules": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": {
      "font": "Times New Roman",
      "font_size": "12pt",
      "margins": "1 inch all sides",
      "spacing": "single-spaced",
      "other_rules": ["Headers must use 14pt bold", "No headers/footers in page count"]
    }
  }
}

Rules:
- "found": true only if the data is explicitly stated in the document
- "confidence": "high" if clearly and unambiguously stated, "medium" if likely present but partially stated, "low" if inferred or unclear
- Use null for numeric page_limit if no specific limit stated
- Return empty arrays [] if no items found for list fields
- Return null for the "value" if "found" is false`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') return [];

    const jsonText = extractJSON(content.text);
    const parsed = JSON.parse(jsonText) as Record<
      string,
      { found: boolean; confidence: 'high' | 'medium' | 'low'; value: unknown }
    >;

    const results: ExtractionResult[] = [];

    const fieldLabels: Record<string, string> = {
      volume_structure:     'Volume Structure',
      required_attachments: 'Required Attachments',
      required_forms:       'Required Forms & Certifications',
      formatting_rules:     'Formatting Rules',
    };

    for (const [fieldName, label] of Object.entries(fieldLabels)) {
      const extracted = parsed[fieldName];
      if (!extracted) continue;

      results.push({
        field_name:  fieldName,
        field_label: label,
        field_value: extracted.found ? extracted.value : null,
        confidence:  extracted.confidence || 'low',
      });
    }

    return results;
  } catch (err) {
    console.error('extractSectionL failed:', err instanceof Error ? err.message : String(err));
    return [];
  }
}

/**
 * Extract Section M compliance data from solicitation documents.
 *
 * Extracts:
 * - Evaluation factors with subfactors and weight descriptions
 * - Evaluation methodology (LPTA, best value, tradeoff, other)
 * - Experience thresholds required for qualification
 * - Key personnel requirements (roles and qualifications)
 *
 * Returns one ExtractionResult per distinct field.
 */
export async function extractSectionM(documentTexts: string[]): Promise<ExtractionResult[]> {
  const textSample = truncateTexts(documentTexts);

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      temperature: 0,
      system:
        'You are an expert government proposal compliance analyst with 15+ years of experience ' +
        'reading and interpreting federal solicitations (RFPs, RFQs). You specialize in ' +
        'extracting precise evaluation criteria from Section M (Evaluation Criteria). ' +
        'Extract only information explicitly stated — do not infer or fabricate.',
      messages: [
        {
          role: 'user',
          content: `Extract Section M evaluation criteria from this government solicitation document.

Solicitation text:
${textSample}

Extract the following fields and return ONLY valid JSON:

{
  "evaluation_factors": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": [
      {
        "name": "Technical Approach",
        "weight_description": "Most Important",
        "subfactors": [
          { "name": "Understanding of Requirements", "description": "Demonstrates thorough understanding" }
        ]
      }
    ]
  },
  "evaluation_methodology": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": "LPTA" | "best_value" | "tradeoff" | "other"
  },
  "experience_thresholds": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": ["5 years of experience in cybersecurity", "3 or more relevant past performance contracts"]
  },
  "key_personnel_requirements": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": [
      {
        "role": "Program Manager",
        "qualifications": "10 years experience, PMP certified, TS/SCI clearance"
      }
    ]
  }
}

Rules:
- "found": true only if the data is explicitly stated in the document
- "confidence": "high" if clearly and unambiguously stated, "medium" if partially stated, "low" if inferred
- evaluation_methodology must be exactly one of: "LPTA", "best_value", "tradeoff", "other"
- Use "other" for evaluation_methodology if the document describes a non-standard approach
- Return empty arrays [] if no items found for list fields
- subfactors may be an empty array [] if no subfactors are listed for a factor`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') return [];

    const jsonText = extractJSON(content.text);
    const parsed = JSON.parse(jsonText) as Record<
      string,
      { found: boolean; confidence: 'high' | 'medium' | 'low'; value: unknown }
    >;

    const results: ExtractionResult[] = [];

    const fieldLabels: Record<string, string> = {
      evaluation_factors:       'Evaluation Factors',
      evaluation_methodology:   'Evaluation Methodology',
      experience_thresholds:    'Experience Thresholds',
      key_personnel_requirements: 'Key Personnel Requirements',
    };

    for (const [fieldName, label] of Object.entries(fieldLabels)) {
      const extracted = parsed[fieldName];
      if (!extracted) continue;

      results.push({
        field_name:  fieldName,
        field_label: label,
        field_value: extracted.found ? extracted.value : null,
        confidence:  extracted.confidence || 'low',
      });
    }

    return results;
  } catch (err) {
    console.error('extractSectionM failed:', err instanceof Error ? err.message : String(err));
    return [];
  }
}

/**
 * Extract administrative data from solicitation documents.
 *
 * Extracts:
 * - NAICS code
 * - Size standard
 * - Set-aside designation
 * - Contract type
 * - Period of performance
 * - CLIN structure
 *
 * Returns one ExtractionResult per distinct field.
 */
export async function extractAdminData(documentTexts: string[]): Promise<ExtractionResult[]> {
  const textSample = truncateTexts(documentTexts);

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      temperature: 0,
      system:
        'You are an expert government contracts administrator with 15+ years of experience ' +
        'reviewing federal solicitations (RFPs, RFQs, RFIs). You specialize in extracting ' +
        'precise administrative and contractual data from solicitation documents. ' +
        'Extract only information explicitly stated — do not infer or fabricate.',
      messages: [
        {
          role: 'user',
          content: `Extract administrative contract data from this government solicitation document.

Solicitation text:
${textSample}

Extract the following fields and return ONLY valid JSON:

{
  "naics_code": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": "541330"
  },
  "size_standard": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": "$47.0 million"
  },
  "set_aside_designation": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": "Total Small Business Set-Aside"
  },
  "contract_type": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": "Firm-Fixed-Price (FFP)"
  },
  "period_of_performance": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": "12-month base period with two 12-month option periods"
  },
  "clin_structure": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": [
      {
        "clin_number": "0001",
        "description": "Systems Engineering and Technical Assistance (SETA)",
        "type": "FFP"
      }
    ]
  }
}

Rules:
- "found": true only if the data is explicitly stated in the document
- "confidence": "high" if clearly stated (e.g., labeled "NAICS Code: 541330"), "medium" if partially stated, "low" if inferred
- NAICS code should be the numeric code only (e.g., "541330")
- set_aside_designation: use the full name (e.g., "Service-Disabled Veteran-Owned Small Business (SDVOSB)", "8(a)", "Full and Open")
- Use "Full and Open Competition" for unrestricted procurements
- Return empty arrays [] for clin_structure if no CLINs found`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') return [];

    const jsonText = extractJSON(content.text);
    const parsed = JSON.parse(jsonText) as Record<
      string,
      { found: boolean; confidence: 'high' | 'medium' | 'low'; value: unknown }
    >;

    const results: ExtractionResult[] = [];

    const fieldLabels: Record<string, string> = {
      naics_code:            'NAICS Code',
      size_standard:         'Size Standard',
      set_aside_designation: 'Set-Aside Designation',
      contract_type:         'Contract Type',
      period_of_performance: 'Period of Performance',
      clin_structure:        'CLIN Structure',
    };

    for (const [fieldName, label] of Object.entries(fieldLabels)) {
      const extracted = parsed[fieldName];
      if (!extracted) continue;

      results.push({
        field_name:  fieldName,
        field_label: label,
        field_value: extracted.found ? extracted.value : null,
        confidence:  extracted.confidence || 'low',
      });
    }

    return results;
  } catch (err) {
    console.error('extractAdminData failed:', err instanceof Error ? err.message : String(err));
    return [];
  }
}

/**
 * Extract rating scales and factor weightings from solicitation documents.
 *
 * Extracts:
 * - Rating scale definitions per evaluation factor (Outstanding/Good/Acceptable/etc.)
 * - Relative factor weightings and importance descriptions
 *
 * Returns one ExtractionResult per distinct field.
 */
export async function extractRatingScales(documentTexts: string[]): Promise<ExtractionResult[]> {
  const textSample = truncateTexts(documentTexts);

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      temperature: 0,
      system:
        'You are an expert government proposal evaluator with 15+ years of experience ' +
        'reviewing federal solicitations (RFPs, RFQs) and source selection plans. ' +
        'You specialize in extracting rating scales and factor weighting information ' +
        'from Section M and source selection criteria. ' +
        'Extract only information explicitly stated — do not infer or fabricate.',
      messages: [
        {
          role: 'user',
          content: `Extract rating scale and factor weighting data from this government solicitation document.

Solicitation text:
${textSample}

Extract the following fields and return ONLY valid JSON:

{
  "rating_scales": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": [
      {
        "factor_name": "Technical Approach",
        "scale": [
          { "rating": "Outstanding", "description": "Proposal exceeds requirements with highly beneficial strengths; no deficiencies" },
          { "rating": "Good", "description": "Proposal exceeds some requirements with beneficial strengths; no deficiencies" },
          { "rating": "Acceptable", "description": "Proposal meets requirements; no significant weaknesses or deficiencies" },
          { "rating": "Marginal", "description": "Proposal has at least one significant weakness; correctable" },
          { "rating": "Unacceptable", "description": "Proposal fails to meet requirements; deficiencies uncorrectable" }
        ]
      }
    ]
  },
  "factor_weightings": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": [
      {
        "factor_name": "Technical Approach",
        "weight_description": "Most Important",
        "relative_importance": "Technical factors combined are more important than Past Performance, which is more important than Price"
      }
    ]
  }
}

Rules:
- "found": true only if rating scales or weightings are explicitly stated in the document
- "confidence": "high" if scales/weightings are clearly defined, "medium" if partially defined, "low" if only implied
- Many solicitations use a single rating scale for all factors — in that case, use "All Evaluation Factors" as the factor_name
- weight_description: capture the actual language used (e.g., "Most Important", "Equal Weight", "25%")
- relative_importance: capture the comparative language if stated (e.g., "Technical is more important than Price")
- Return empty arrays [] if no rating scales or weightings are found`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') return [];

    const jsonText = extractJSON(content.text);
    const parsed = JSON.parse(jsonText) as Record<
      string,
      { found: boolean; confidence: 'high' | 'medium' | 'low'; value: unknown }
    >;

    const results: ExtractionResult[] = [];

    const fieldLabels: Record<string, string> = {
      rating_scales:    'Rating Scales',
      factor_weightings: 'Factor Weightings',
    };

    for (const [fieldName, label] of Object.entries(fieldLabels)) {
      const extracted = parsed[fieldName];
      if (!extracted) continue;

      results.push({
        field_name:  fieldName,
        field_label: label,
        field_value: extracted.found ? extracted.value : null,
        confidence:  extracted.confidence || 'low',
      });
    }

    return results;
  } catch (err) {
    console.error('extractRatingScales failed:', err instanceof Error ? err.message : String(err));
    return [];
  }
}
