/**
 * Compliance Extraction Engine
 * Phase 7: Compliance Extraction
 *
 * AI-powered extraction library for government solicitation compliance data.
 * Extracts submission instructions, evaluation criteria, administrative data,
 * and rating scales from solicitation document text.
 *
 * IMPORTANT: Extraction is function-based, NOT label-based.
 * Federal solicitations use different naming conventions depending on
 * procurement vehicle (UCF/FAR 15, SeaPort NxG, GSA Schedule, FAR 12/13,
 * Army TORs). The AI must identify content by purpose and signal keywords,
 * never by fixed section headers like "Section L" or "Section M".
 * See federal_extraction_map.md for the full synonym map.
 *
 * Each exported function accepts concatenated document text and returns
 * an array of ExtractionResult objects ready to be upserted to
 * the compliance_extractions table.
 *
 * All functions:
 * - Use the configured MODEL with max_tokens 4096, temperature 0
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
 * Extract submission instructions (Instructions to Offerors) from solicitation documents.
 *
 * This content may be labeled differently depending on procurement vehicle:
 * - UCF/FAR 15: "Section L — Instructions to Offerors"
 * - SeaPort NxG/IDIQ TORs: "Task Order Proposal Content" or "Submission Instructions"
 * - GSA Schedule/FAR 8.4: "Quotation Preparation Instructions"
 * - FAR Part 12: Within 52.212-1 provisions
 * - Simplified (FAR 13): "Submission Requirements" or embedded in body text
 *
 * Extracts: volume structure, page limits, required attachments, forms, formatting rules.
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
        'reading federal solicitations across all procurement vehicles (UCF/FAR 15, SeaPort NxG, ' +
        'GSA Schedule/FAR 8.4, FAR Part 12 commercial, FAR Part 13 simplified). ' +
        'You extract submission instructions by FUNCTION, not by label. ' +
        'This content may appear as "Section L", "Proposal Content", "Submission Instructions", ' +
        '"Quotation Preparation Instructions", "TOP Content", or within 52.212-1 provisions. ' +
        'Army and Navy TORs often use numbered sections (3.0, 4.0) with no L/M designation. ' +
        'Extract only information explicitly stated — do not infer or fabricate.',
      messages: [
        {
          role: 'user',
          content: `Extract SUBMISSION INSTRUCTIONS from this government solicitation.

Do NOT look for a section labeled "Section L" — instead, find the content that tells offerors WHAT to submit, HOW to format it, and WHAT the page limits are.

Signal keywords to locate this content: "instructions to offerors", "proposal content", "submission instructions", "quotation preparation", "TOP content", "shall submit", "page limit", "page limitation", "volume", "shall not exceed", "file naming convention", "format requirements", "font size", "margin", "shall include", "shall provide", "shall address", "proposal shall", "separate volumes", "electronic submission"

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
- Return null for the "value" if "found" is false
- Include ALL volumes/sections the offeror must submit, even if labeled as "Factors" or numbered sections instead of "Volumes"
- Page exclusions: note what does NOT count against page limits (resumes, LOCs, cover pages, etc.) in format_rules under other_rules`,
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
 * Extract evaluation criteria from solicitation documents.
 *
 * This content may be labeled differently depending on procurement vehicle:
 * - UCF/FAR 15: "Section M — Evaluation Factors for Award"
 * - SeaPort NxG/IDIQ TORs: "Evaluation Criteria" (numbered section)
 * - GSA Schedule/FAR 8.4: "Evaluation of Quotations" or "Basis for Award"
 * - FAR Part 12: Within 52.212-2 "Evaluation — Commercial Products"
 * - Simplified (FAR 13): Brief paragraph, e.g., "award based on best value"
 *
 * Extracts: evaluation factors, methodology, experience thresholds, key personnel.
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
        'reading federal solicitations across all procurement vehicles (UCF/FAR 15, SeaPort NxG, ' +
        'GSA Schedule/FAR 8.4, FAR Part 12 commercial, FAR Part 13 simplified). ' +
        'You extract evaluation criteria by FUNCTION, not by label. ' +
        'This content may appear as "Section M", "Evaluation Criteria", "Factors to be Evaluated", ' +
        '"Evaluation of Quotations", "Basis for Award", or within 52.212-2 provisions. ' +
        'Army and Navy TORs often use numbered sections with no M designation. ' +
        'Extract only information explicitly stated — do not infer or fabricate.',
      messages: [
        {
          role: 'user',
          content: `Extract EVALUATION CRITERIA from this government solicitation.

Do NOT look for a section labeled "Section M" — instead, find the content that describes HOW the government will score, rank, or evaluate proposals.

Signal keywords to locate this content: "evaluation criteria", "evaluation factors", "factors to be evaluated", "basis for award", "award will be made", "best value", "tradeoff", "trade-off", "LPTA", "lowest price technically acceptable", "most important factor", "more important than", "significantly more important", "rating", "adjectival rating", "outstanding", "acceptable", "marginal", "unacceptable", "confidence", "will be evaluated", "will assess", "strengths", "weaknesses", "deficiencies"

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
- weight_description: capture the EXACT language used (e.g., "Most Important", "Significantly More Important", "Equal Weight", "25%")
- Key personnel may appear in evaluation criteria, submission instructions, SOW/PWS, or as a separate attachment
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
 * Extract administrative/solicitation metadata from solicitation documents.
 *
 * This data typically appears on the cover page or in standard form blocks:
 * - SF 1449 (commercial), SF 33 (UCF), or cover page fields
 * - "Task Order Request (TOR) Number" (SeaPort)
 * - "Solicitation No." / "RFP No." / "RFQ No."
 *
 * Extracts: NAICS, size standard, set-aside, contract type, PoP, CLINs.
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
        'reviewing federal solicitations across all procurement vehicles (UCF/FAR 15, SeaPort NxG, ' +
        'GSA Schedule/FAR 8.4, FAR Part 12 commercial, FAR Part 13 simplified). ' +
        'Administrative data may appear on SF 33, SF 1449, cover pages, or scattered throughout ' +
        'the document body. Check ALL locations — some solicitations embed NAICS and set-aside ' +
        'in clause sections rather than the cover page. ' +
        'Extract only information explicitly stated — do not infer or fabricate.',
      messages: [
        {
          role: 'user',
          content: `Extract ADMINISTRATIVE AND CONTRACT DATA from this government solicitation.

This data may appear on the cover page, in standard form blocks (SF 33, SF 1449), in clause sections, or in the body text. Check all locations.

Signal keywords: "solicitation number", "TOR number", "RFP number", "RFQ number", "NAICS", "size standard", "set-aside", "women-owned", "8(a)", "HUBZone", "SDVOSB", "service-disabled", "small business", "unrestricted", "full and open", "contract type", "firm-fixed-price", "FFP", "T&M", "time-and-materials", "cost-reimbursement", "IDIQ", "period of performance", "base period", "option period", "CLIN", "contract line item"

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
- set_aside_designation: use the full name (e.g., "Service-Disabled Veteran-Owned Small Business (SDVOSB)", "8(a)", "Full and Open Competition")
- contract_type: include parenthetical abbreviation (e.g., "Firm-Fixed-Price (FFP)", "Time-and-Materials (T&M)", "Cost-Plus-Fixed-Fee (CPFF)")
- For IDIQ task orders, note both the parent contract type and the task order type if different
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
 * Rating scales and weightings may appear:
 * - In the evaluation criteria section (however labeled)
 * - As a standalone table or appendix
 * - Within 52.212-2 provisions (commercial)
 * - Using adjectival (Outstanding/Good), color-coded, or confidence-based scales
 *
 * Extracts: rating scale definitions per factor, relative factor weightings.
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
        'reviewing federal solicitations across all procurement vehicles. ' +
        'You extract rating scales and factor weightings by FUNCTION, not by label. ' +
        'This content may appear in evaluation criteria sections (however labeled), ' +
        'within 52.212-2 provisions, as standalone tables, or in source selection appendices. ' +
        'Rating systems vary: adjectival (Outstanding/Good/Acceptable/Marginal/Unacceptable), ' +
        'color-coded (Blue/Purple/Green/Yellow/Red), confidence-based (Substantial/Satisfactory/' +
        'Limited/No Confidence), or pass/fail. Capture whatever system is used. ' +
        'Extract only information explicitly stated — do not infer or fabricate.',
      messages: [
        {
          role: 'user',
          content: `Extract RATING SCALES and FACTOR WEIGHTINGS from this government solicitation.

Do NOT look for "Section M" specifically — find wherever the document defines how proposals will be rated/scored and how factors are weighted relative to each other.

Signal keywords: "rating", "adjectival rating", "outstanding", "acceptable", "marginal", "unacceptable", "confidence", "substantial confidence", "satisfactory confidence", "color rating", "most important factor", "more important than", "when combined", "significantly more important", "equal weight", "descending order of importance", "evaluated favorably", "evaluated unfavorably"

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
- Capture whatever rating system is used (adjectival, color, confidence, pass/fail, numeric) — do not normalize to a standard scale
- weight_description: capture the EXACT language used (e.g., "Most Important", "Equal Weight", "25%", "descending order of importance")
- relative_importance: capture the full comparative statement if one exists (e.g., "Technical is significantly more important than Past Performance, which is significantly more important than Price")
- Note if award will be made with or without discussions
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
