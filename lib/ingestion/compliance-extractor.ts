/**
 * Compliance Extraction Engine
 * Phase 7: Compliance Extraction
 *
 * AI-powered extraction library for government solicitation compliance data.
 * Extracts submission instructions, evaluation criteria, administrative data,
 * rating scales, SOW/PWS, cost/price, past performance, key personnel,
 * and security requirements from solicitation document text.
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
 * Concatenate document texts with proportional budgeting to avoid silent truncation.
 *
 * Old behavior: naively concatenated and hard-cut at 100K chars — later documents
 * (amendments, Q&A, clauses) were silently lost when the first document was large.
 *
 * New behavior: each document gets a proportional share of the total budget, with
 * a minimum guaranteed allocation so no document is completely skipped. Documents
 * shorter than their allocation donate remaining budget to longer documents.
 *
 * 180K chars (~45K tokens) comfortably fits within Claude's 200K context window
 * while leaving room for the system prompt and extraction instructions.
 */
function truncateTexts(documentTexts: string[], maxChars = 180_000): string {
  if (documentTexts.length === 0) return '';
  if (documentTexts.length === 1) return documentTexts[0].substring(0, maxChars);

  const separator = '\n\n--- DOCUMENT BOUNDARY ---\n\n';
  const separatorOverhead = separator.length * (documentTexts.length - 1);
  const usableBudget = maxChars - separatorOverhead;

  // Minimum 15K chars per document — ensures Q&A, amendments, and clauses are represented
  const minPerDoc = Math.min(15_000, Math.floor(usableBudget / documentTexts.length));

  // First pass: allocate proportionally, respecting minimums
  const totalOriginal = documentTexts.reduce((sum, t) => sum + t.length, 0);
  const allocations = documentTexts.map((text) => {
    const proportional = Math.floor((text.length / totalOriginal) * usableBudget);
    return Math.max(minPerDoc, proportional);
  });

  // Second pass: documents shorter than their allocation donate surplus
  let surplus = 0;
  let overBudgetCount = 0;
  for (let i = 0; i < documentTexts.length; i++) {
    if (documentTexts[i].length < allocations[i]) {
      surplus += allocations[i] - documentTexts[i].length;
      allocations[i] = documentTexts[i].length; // no need to allocate more than actual length
    } else if (documentTexts[i].length > allocations[i]) {
      overBudgetCount++;
    }
  }

  // Distribute surplus evenly to documents that need more space
  if (surplus > 0 && overBudgetCount > 0) {
    const bonus = Math.floor(surplus / overBudgetCount);
    for (let i = 0; i < documentTexts.length; i++) {
      if (documentTexts[i].length > allocations[i]) {
        allocations[i] = Math.min(documentTexts[i].length, allocations[i] + bonus);
      }
    }
  }

  // Build final text with truncated segments
  const segments = documentTexts.map((text, i) => text.substring(0, allocations[i]));
  return segments.join(separator);
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

/**
 * Extract SOW / PWS / SOO overview from solicitation documents (Pass 1 of 2).
 *
 * This content may be labeled differently depending on procurement vehicle:
 * - UCF/FAR 15: "Section C — Description/Specifications/Statement of Work"
 * - SeaPort/IDIQ TORs: Statement of Objectives (SOO) — contractor generates PWS from SOO
 * - GSA Schedule: Performance Work Statement (PWS) — usually an attachment
 * - General: SOW, PWS, SOO, Technical Exhibit, Technical Requirements Document
 *
 * Critical: SOW = government tells contractor what to do; PWS = performance outcomes;
 * SOO = government defines objectives, contractor proposes both PWS and approach.
 *
 * Extracts: document type, scope summary, service area index, task areas, deliverables,
 * PoP, place of performance, modernization goals, operational context.
 *
 * The service_area_index output drives Pass 2 (extractServiceAreaDetails) for deep extraction.
 */
export async function extractSowPwsOverview(documentTexts: string[]): Promise<ExtractionResult[]> {
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
        'You extract requirements definitions by FUNCTION, not by label. ' +
        'This content may appear as "Section C", "Statement of Work", "Performance Work Statement", ' +
        '"Statement of Objectives", "Technical Exhibit", or as a numbered attachment. ' +
        'Critically distinguish between SOW (government prescribes tasks), PWS (government defines ' +
        'performance outcomes), and SOO (government defines objectives, contractor generates PWS). ' +
        'Extract only information explicitly stated — do not infer or fabricate.',
      messages: [
        {
          role: 'user',
          content: `Extract STATEMENT OF WORK / PERFORMANCE WORK STATEMENT / STATEMENT OF OBJECTIVES overview from this government solicitation.

Find the content that describes WHAT the contractor must do — identify the document type, all discrete service/task areas, deliverables, period and place of performance, and any modernization or transformation goals.

Signal keywords: "statement of work", "SOW", "performance work statement", "PWS", "statement of objectives", "SOO", "technical exhibit", "scope of work", "requirements", "the contractor shall", "task area", "service area", "CLIN", "contract line item", "period of performance", "place of performance", "deliverables", "modernization", "transformation", "transition"

Solicitation text:
${textSample}

Extract the following fields and return ONLY valid JSON:

{
  "document_type": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": "SOW" | "PWS" | "SOO"
  },
  "requires_contractor_pws": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": true | false
  },
  "scope_summary": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": "1-2 sentence plain-English summary of the full contract scope"
  },
  "total_service_areas": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": 13
  },
  "service_area_index": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": [
      {
        "code": "3.2.1",
        "name": "Planning Support",
        "summary": "IT strategic planning, budgeting, and roadmap development"
      }
    ]
  },
  "task_areas": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": [
      {
        "name": "Task Area 1 - Systems Engineering",
        "description": "Provide systems engineering support..."
      }
    ]
  },
  "deliverables": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": [
      {
        "name": "Monthly Status Report",
        "frequency": "Monthly",
        "format": "MS Word"
      }
    ]
  },
  "period_of_performance": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": "12-month base period with two 12-month option periods"
  },
  "place_of_performance": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": "Fort Belvoir, VA with up to 25% telework"
  },
  "modernization_goals": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": ["Cloud migration", "Zero Trust implementation"]
  },
  "operational_context": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": "Maintain continuous operations while modernizing infrastructure"
  }
}

Rules:
- "found": true only if the data is explicitly stated in the document
- "confidence": "high" if clearly stated, "medium" if partially stated, "low" if inferred
- document_type: identify whether SOW, PWS, or SOO
- requires_contractor_pws: true if this is an SOO where the contractor must generate a PWS
- service_area_index: capture EVERY discrete service area, functional area, or numbered task section. Use the exact section numbering from the document (e.g., "3.2.1", "3.2.2"). This is critical — do not skip any service areas.
- task_areas: capture all numbered task areas (backward compatible with existing format)
- total_service_areas: count of items in service_area_index
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
      document_type:           'Document Type (SOW/PWS/SOO)',
      requires_contractor_pws: 'Requires Contractor PWS',
      scope_summary:           'Scope Summary',
      total_service_areas:     'Total Service Areas',
      service_area_index:      'Service Area Index',
      task_areas:              'Task Areas',
      deliverables:            'Deliverables',
      period_of_performance:   'Period of Performance',
      place_of_performance:    'Place of Performance',
      modernization_goals:     'Modernization Goals',
      operational_context:     'Operational Context',
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
    console.error('extractSowPwsOverview failed:', err instanceof Error ? err.message : String(err));
    return [];
  }
}

/**
 * Extract deep detail for a single service area (Pass 2 of 2).
 *
 * Called once per service area from extractSowPwsOverview's service_area_index.
 * Focuses Claude on ONE service area at a time for thorough extraction of
 * sub-requirements, technologies, frameworks, staffing, SLAs, and site needs.
 *
 * Results are stored as separate compliance_extraction rows with
 * field_name: `service_area_detail_{code}` (e.g., `service_area_detail_3.2.1`).
 */
export async function extractServiceAreaDetails(
  documentTexts: string[],
  areaCode: string,
  areaName: string
): Promise<ExtractionResult[]> {
  const textSample = truncateTexts(documentTexts);

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      temperature: 0,
      system:
        'You are an expert government proposal compliance analyst with 15+ years of experience ' +
        'reading federal solicitations. You are performing a DEEP EXTRACTION of a single service area ' +
        'from a SOW/PWS/SOO document. Extract every requirement, technology, framework, staffing indicator, ' +
        'performance metric, and site requirement for this specific service area. ' +
        'Extract only information explicitly stated — do not infer or fabricate.',
      messages: [
        {
          role: 'user',
          content: `Extract DETAILED REQUIREMENTS for service area "${areaCode} — ${areaName}" from this solicitation document.

Focus ONLY on section ${areaCode} (${areaName}). Extract every detail about this specific service area.

Solicitation text:
${textSample}

Return ONLY valid JSON with this structure:

{
  "area_code": "${areaCode}",
  "area_name": "${areaName}",
  "description": "Full description of this service area",
  "sub_requirements": [
    {
      "id": "3.2.1.a",
      "text": "The contractor shall provide 24/7 help desk support",
      "type": "shall"
    }
  ],
  "required_technologies": [
    {
      "name": "ServiceNow",
      "context": "ITSM platform for ticket management",
      "requirement_level": "required"
    }
  ],
  "required_frameworks": ["ITIL", "Zero Trust"],
  "staffing_indicators": [
    {
      "metric": "75:1 users to technicians",
      "context": "Service desk staffing ratio"
    }
  ],
  "performance_metrics": [
    {
      "metric": "Response Time",
      "target": "15 minutes for Priority 1 incidents"
    }
  ],
  "site_requirements": ["Adelphi Lab Center", "Aberdeen Proving Ground"],
  "clin_mapping": "CLIN 0001 — IT Operations",
  "security_environment": ["NIPR", "SIPR", "JWICS"]
}

Rules:
- sub_requirements: capture EVERY "shall", "must", "will" statement in this section. type = "shall" | "must" | "will" | "objective"
- required_technologies: any named tool, platform, software, or system mentioned. requirement_level = "required" (explicitly mandated), "preferred" (recommended), or "current" (currently in use)
- required_frameworks: standards like ITIL, CMMI, ISO, Zero Trust, NIST, etc.
- staffing_indicators: any staffing ratios, FTE counts, or workforce requirements mentioned
- performance_metrics: SLAs, KPIs, response times, resolution times, uptime targets
- site_requirements: which sites/locations this service area applies to
- clin_mapping: which CLIN or contract line item this area falls under
- security_environment: which networks (NIPR, SIPR, JWICS, DREN, etc.) apply
- Return empty arrays [] for any fields where no data is found
- Return empty string "" for string fields where no data is found`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') return [];

    const jsonText = extractJSON(content.text);
    const parsed = JSON.parse(jsonText);

    // Store the entire parsed object as a single extraction result
    return [{
      field_name:  `service_area_detail_${areaCode}`,
      field_label: `Service Area Detail: ${areaCode} — ${areaName}`,
      field_value: parsed,
      confidence:  'high',
    }];
  } catch (err) {
    console.error(`extractServiceAreaDetails(${areaCode}) failed:`, err instanceof Error ? err.message : String(err));
    return [];
  }
}

/**
 * Extract operational context from solicitation documents.
 *
 * Captures agency identity, contract scale, sites, networks, and incumbent info
 * that is critical for calibrating the proposal response but often falls through
 * the cracks of standard Section L/M/C extraction.
 *
 * New category: 'operational_context'
 */
export async function extractOperationalContext(documentTexts: string[]): Promise<ExtractionResult[]> {
  const textSample = truncateTexts(documentTexts);

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      temperature: 0,
      system:
        'You are an expert government proposal analyst with 15+ years of experience ' +
        'reading federal solicitations. You extract operational context — the agency identity, ' +
        'contract scale, sites, networks, user population, and incumbent contractor information ' +
        'that shapes how a proposal should be written. This data may appear anywhere in the ' +
        'solicitation package — RFP body, SOW/PWS/SOO, amendments, or attachments. ' +
        'Extract only information explicitly stated — do not infer or fabricate.',
      messages: [
        {
          role: 'user',
          content: `Extract OPERATIONAL CONTEXT from this government solicitation.

Find agency-level and contract-scale information that describes WHO the customer is, HOW BIG the contract is, WHERE the work happens, and WHAT the current environment looks like.

Signal keywords: "agency", "laboratory", "command", "center", "directorate", "research", "users", "staff", "employees", "personnel", "incumbent", "current contractor", "workforce", "sites", "locations", "facilities", "annual", "total value", "ceiling", "estimated value", "modernization", "enterprise", "network", "NIPR", "SIPR", "JWICS", "DREN", "CLIN"

Solicitation text:
${textSample}

Extract the following fields and return ONLY valid JSON:

{
  "agency_name": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": "Army Research Laboratory"
  },
  "agency_abbreviation": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": "ARL"
  },
  "agency_mission": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": "1-sentence mission description"
  },
  "user_count": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": "approximately 3,500"
  },
  "staff_composition": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": "researchers and support staff"
  },
  "incumbent_contractor": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": "Agile Defense"
  },
  "estimated_contract_value": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": "$88M over 5.5 years"
  },
  "contract_scope_summary": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": "Enterprise IT operations and modernization across 4 research facilities"
  },
  "sites": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": [
      {
        "name": "Adelphi Lab Center",
        "abbreviation": "ALC",
        "location": "Adelphi, Maryland",
        "description": "Primary research facility",
        "is_primary": true
      }
    ]
  },
  "networks": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": [
      {
        "name": "DREN",
        "classification": "unclassified research",
        "description": "Defense Research and Engineering Network"
      }
    ]
  },
  "security_environment_summary": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": "Operations across Secret, TS/SCI, and JWICS environments"
  },
  "clin_categories": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": [
      {
        "category": "IT Operations",
        "description": "Steady-state operations and maintenance",
        "scope": "All sites"
      }
    ]
  }
}

Rules:
- "found": true only if the data is explicitly stated in the document
- "confidence": "high" if clearly stated, "medium" if partially stated, "low" if inferred
- agency_name: full official name of the customer agency/organization
- sites: capture ALL sites/facilities mentioned, including satellite locations
- networks: capture all network types (NIPR, SIPR, JWICS, DREN, etc.)
- clin_categories: high-level CLIN groupings (not individual CLINs)
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
      agency_name:                  'Agency Name',
      agency_abbreviation:          'Agency Abbreviation',
      agency_mission:               'Agency Mission',
      user_count:                   'User Count',
      staff_composition:            'Staff Composition',
      incumbent_contractor:         'Incumbent Contractor',
      estimated_contract_value:     'Estimated Contract Value',
      contract_scope_summary:       'Contract Scope Summary',
      sites:                        'Sites & Facilities',
      networks:                     'Networks',
      security_environment_summary: 'Security Environment Summary',
      clin_categories:              'CLIN Categories',
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
    console.error('extractOperationalContext failed:', err instanceof Error ? err.message : String(err));
    return [];
  }
}

/**
 * Extract technology requirements from solicitation documents.
 *
 * Captures every named tool, platform, protocol, standard, and framework
 * mentioned in the solicitation. This data drives both the Tier 2 data call
 * (asking the company about their experience with each technology) and
 * prompt assembly (ensuring proposals reference the right tech stack).
 *
 * New category: 'technology_reqs'
 */
export async function extractTechnologyRequirements(documentTexts: string[]): Promise<ExtractionResult[]> {
  const textSample = truncateTexts(documentTexts);

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      temperature: 0,
      system:
        'You are an expert government IT proposal analyst with 15+ years of experience ' +
        'reading federal solicitations for IT services contracts. You extract every named technology, ' +
        'platform, tool, protocol, standard, and framework from solicitation documents. ' +
        'You understand the difference between mandatory requirements (the contractor must use), ' +
        'current environment (what is in place today), and preferred (government recommends). ' +
        'Extract only information explicitly stated — do not infer or fabricate.',
      messages: [
        {
          role: 'user',
          content: `Extract ALL TECHNOLOGY REQUIREMENTS from this government solicitation.

Find every named tool, platform, protocol, standard, framework, operating system, and security tool mentioned anywhere in the document.

Signal keywords: "ServiceNow", "Cisco", "Nutanix", "JAMF", "Puppet", "Ansible", "SCCM", "MECM", "SolarWinds", "Active Directory", "VMware", "Red Hat", "Citrix", "VDI", "DaaS", "SaaS", "PaaS", "IaaS", "OSPF", "BGP", "802.1x", "IPv6", "VPN", "IPSEC", "DNS", "DHCP", "ITIL", "CMMI", "ISO", "NIST", "FedRAMP", "Zero Trust", "Windows", "Linux", "Mac", "platform", "tool", "system", "application", "software", "endpoint", "device"

Solicitation text:
${textSample}

Extract the following fields and return ONLY valid JSON:

{
  "required_platforms": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": [
      {
        "name": "ServiceNow",
        "category": "ITSM",
        "context": "Service desk ticketing and CMDB",
        "requirement_level": "mandatory"
      }
    ]
  },
  "required_protocols": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": [
      {
        "name": "OSPF",
        "context": "Network routing protocol for campus LAN"
      }
    ]
  },
  "required_standards": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": [
      {
        "name": "ITIL",
        "context": "IT service management framework"
      }
    ]
  },
  "operating_systems": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": [
      {
        "name": "Windows",
        "percentage": "90%",
        "context": "Primary desktop operating system"
      }
    ]
  },
  "security_tools": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": [
      {
        "name": "Trellix",
        "context": "Endpoint detection and response"
      }
    ]
  },
  "infrastructure_platforms": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": [
      {
        "name": "Nutanix",
        "category": "Hyperconverged Infrastructure",
        "context": "On-premises compute and storage"
      }
    ]
  },
  "application_count": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": "1,200 unique applications"
  },
  "endpoint_count": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": "~4,000 endpoints"
  }
}

Rules:
- "found": true only if the data is explicitly stated in the document
- "confidence": "high" if clearly stated, "medium" if partially stated, "low" if inferred
- required_platforms: named software/SaaS platforms. requirement_level: "mandatory" (must use), "current_environment" (in place today), "preferred" (recommended)
- required_protocols: network protocols, communication standards
- required_standards: management/compliance frameworks (ITIL, ISO, CMMI, NIST, etc.)
- operating_systems: include percentage breakdown if stated
- security_tools: endpoint, network, and identity security tools
- infrastructure_platforms: compute, storage, virtualization, networking hardware/software
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
      required_platforms:       'Required Platforms',
      required_protocols:       'Required Protocols',
      required_standards:       'Required Standards',
      operating_systems:        'Operating Systems',
      security_tools:           'Security Tools',
      infrastructure_platforms: 'Infrastructure Platforms',
      application_count:        'Application Count',
      endpoint_count:           'Endpoint Count',
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
    console.error('extractTechnologyRequirements failed:', err instanceof Error ? err.message : String(err));
    return [];
  }
}

/**
 * Extract cost/price proposal requirements from solicitation documents.
 *
 * This content may appear as:
 * - UCF/FAR 15: Part of Section L, or a separate "Cost/Price Volume" instruction
 * - SeaPort TORs: Volume IV instructions within "Task Order Proposal Content"
 * - GSA Schedule: "Price Quotation" volume or pricing attachment
 * - Always references a government-furnished pricing template as an attachment
 *
 * Extracts: contract type, pricing template, cost breakout, realism/reasonableness,
 * travel instructions, CLIN pricing structure.
 */
export async function extractCostPrice(documentTexts: string[]): Promise<ExtractionResult[]> {
  const textSample = truncateTexts(documentTexts);

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      temperature: 0,
      system:
        'You are an expert government cost/price analyst with 15+ years of experience ' +
        'reading federal solicitations across all procurement vehicles (UCF/FAR 15, SeaPort NxG, ' +
        'GSA Schedule/FAR 8.4, FAR Part 12 commercial, FAR Part 13 simplified). ' +
        'You extract cost/price proposal requirements by FUNCTION, not by label. ' +
        'This content may appear within Section L, as a separate Cost/Price Volume instruction, ' +
        'as a pricing attachment reference, or within FAR 15.408 Table 15-2 requirements. ' +
        'Extract only information explicitly stated — do not infer or fabricate.',
      messages: [
        {
          role: 'user',
          content: `Extract COST/PRICE PROPOSAL REQUIREMENTS from this government solicitation.

Find the content that tells offerors HOW to structure their cost or price proposal — contract type, pricing templates, cost breakout categories, and cost realism/reasonableness analysis.

Signal keywords: "cost proposal", "price proposal", "cost/price", "cost narrative", "pricing template", "shall break out", "labor categories", "labor rates", "travel", "ODC", "other direct costs", "materials", "subcontractor costs", "indirect rates", "fee", "profit", "cost realism", "price reasonableness", "FAR 15.408", "Table 15-2", "Excel format", "formulas visible"

Solicitation text:
${textSample}

Extract the following fields and return ONLY valid JSON:

{
  "contract_type": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": "Firm-Fixed-Price (FFP)"
  },
  "pricing_template": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": "Attachment 3 — Pricing Template (Excel)"
  },
  "cost_breakout_categories": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": ["Direct Labor", "Fringe Benefits", "Overhead", "G&A", "Fee", "Travel", "ODCs", "Subcontractor Costs"]
  },
  "cost_realism_or_reasonableness": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": "Cost realism analysis will be performed per FAR 15.404-1(d)"
  },
  "travel_instructions": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": "Use government-furnished travel estimate; 10 trips to Washington DC per year"
  },
  "clin_pricing": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": "Price each CLIN separately with fully burdened labor rates"
  }
}

Rules:
- "found": true only if the data is explicitly stated in the document
- "confidence": "high" if clearly stated, "medium" if partially stated, "low" if inferred
- contract_type: include abbreviation (FFP, T&M, CPFF, etc.)
- pricing_template: note attachment name/number if referenced
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
      contract_type:                 'Contract Type',
      pricing_template:              'Pricing Template',
      cost_breakout_categories:      'Cost Breakout Categories',
      cost_realism_or_reasonableness: 'Cost Realism / Price Reasonableness',
      travel_instructions:           'Travel Instructions',
      clin_pricing:                  'CLIN Pricing Structure',
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
    console.error('extractCostPrice failed:', err instanceof Error ? err.message : String(err));
    return [];
  }
}

/**
 * Extract past performance requirements from solicitation documents.
 *
 * This content may appear as:
 * - UCF/FAR 15: Part of Section L (instructions) + Section M (how it's evaluated)
 * - SeaPort TORs: "Volume III, Past Performance"
 * - GSA Schedule: "Volume II: Past Performance"
 * - May include a government-furnished PPQ form as an attachment
 *
 * Extracts: # refs required, recency, relevance criteria, subcontractor PP,
 * PPQ form, page limits.
 */
export async function extractPastPerformance(documentTexts: string[]): Promise<ExtractionResult[]> {
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
        'You extract past performance requirements by FUNCTION, not by label. ' +
        'Past performance instructions may appear in Section L, within evaluation criteria, ' +
        'as a separate volume instruction, or referenced via a PPQ attachment. ' +
        'Extract only information explicitly stated — do not infer or fabricate.',
      messages: [
        {
          role: 'user',
          content: `Extract PAST PERFORMANCE REQUIREMENTS from this government solicitation.

Find the content that tells offerors how many references to submit, recency/relevance requirements, and how past performance will be evaluated.

Signal keywords: "past performance", "relevant experience", "similar in scope", "similar in magnitude", "similar in complexity", "within three years", "within five years", "recent and relevant", "contract references", "CPARS", "PPQ", "past performance questionnaire", "major subcontractor", "confidence rating", "unknown confidence"

Solicitation text:
${textSample}

Extract the following fields and return ONLY valid JSON:

{
  "references_required": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": "3 prime contract references and 2 subcontractor references"
  },
  "recency_requirement": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": "Within 3 years of the TOR issue date"
  },
  "relevance_criteria": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": ["Similar in scope to the SOO task areas", "Similar in magnitude ($5M+ annually)", "Similar in complexity (multi-site operations)"]
  },
  "subcontractor_pp_evaluated": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": "Yes — major subcontractors performing 20%+ of work must submit separate references"
  },
  "ppq_form": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": "Attachment 5 — Past Performance Questionnaire"
  },
  "page_limit": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": "10 pages for Past Performance volume"
  },
  "recency_years": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": 3
  },
  "retention_rate_required": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": 85
  }
}

Rules:
- "found": true only if the data is explicitly stated in the document
- "confidence": "high" if clearly stated, "medium" if partially stated, "low" if inferred
- references_required: capture total number and breakdown (prime vs sub)
- relevance_criteria: capture each criterion as a separate list item
- recency_years: extract only the NUMERIC number of years (e.g., 3 for "within 3 years", 5 for "within 5 years"). Return null if not specified or cannot be parsed as a number.
- retention_rate_required: extract the NUMERIC minimum staff retention percentage if the RFP specifies a measurable retention threshold (e.g., 85 for "85% retention rate"). Return null if not specified.
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
      references_required:        'References Required',
      recency_requirement:        'Recency Requirement',
      relevance_criteria:         'Relevance Criteria',
      subcontractor_pp_evaluated: 'Subcontractor PP Evaluated',
      ppq_form:                   'PPQ Form',
      page_limit:                 'Page Limit',
      recency_years:              'Recency Window (Years)',
      retention_rate_required:    'Retention Rate Required',
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
    console.error('extractPastPerformance failed:', err instanceof Error ? err.message : String(err));
    return [];
  }
}

/**
 * Extract key personnel requirements from solicitation documents.
 *
 * Key personnel requirements may appear:
 * - Embedded within technical volume instructions across all formats
 * - In SOW/PWS, Section L, or as a standalone attachment
 * - In SeaPort TORs, typically within the Technical Factor instructions
 *
 * Extracts: positions, qualifications, clearance, resume format, LOC requirements,
 * whether resumes/LOCs count against page limits.
 */
export async function extractKeyPersonnel(documentTexts: string[]): Promise<ExtractionResult[]> {
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
        'You extract key personnel requirements by FUNCTION, not by label. ' +
        'Key personnel information may appear in technical volume instructions, SOW/PWS, ' +
        'evaluation criteria, or as a separate attachment listing required positions. ' +
        'Extract only information explicitly stated — do not infer or fabricate.',
      messages: [
        {
          role: 'user',
          content: `Extract KEY PERSONNEL REQUIREMENTS from this government solicitation.

Find the content that defines which positions are key personnel, their required qualifications, clearance levels, resume format, and Letter of Commitment (LOC) requirements.

Signal keywords: "key personnel", "resume", "resumes", "letter of commitment", "LOC", "qualifications", "certifications", "DoD 8570", "DoD 8140", "DoDM 8140", "IAT", "IAM", "IASAE", "clearance", "secret", "top secret", "TS/SCI", "years of experience", "education requirement", "degree", "program manager", "project manager", "shall not count against page limit", "backup", "alternate", "substitute", "replacement"

Solicitation text:
${textSample}

Extract the following fields and return ONLY valid JSON:

{
  "positions": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": [
      {
        "title": "Program Manager",
        "qualifications": "PMP certified, 10+ years IT program management",
        "clearance": "Top Secret/SCI",
        "education": "Bachelor's degree in relevant field",
        "experience": "10 years minimum"
      }
    ]
  },
  "resume_format": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": "2-page maximum per resume, include education, certifications, relevant experience"
  },
  "loc_requirements": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": "Signed letter from each key person confirming availability and commitment to the contract"
  },
  "counts_against_page_limit": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": "Resumes and LOCs do NOT count against the Technical volume page limit"
  },
  "backup_personnel_required": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": "Yes — backup/alternate personnel required for all key positions"
  },
  "certification_requirements": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": [
      {
        "position_title": "ISSO",
        "certifications": ["CISSP", "Security+"],
        "iat_level": "IAT Level II"
      }
    ]
  }
}

Rules:
- "found": true only if the data is explicitly stated in the document
- "confidence": "high" if clearly stated, "medium" if partially stated, "low" if inferred
- positions: capture ALL positions designated as key personnel with their requirements
- clearance: capture the specific level required (e.g., "Secret", "Top Secret", "TS/SCI")
- backup_personnel_required: true if the RFP explicitly requires backup, alternate, or substitute personnel for key positions. Include the RFP language if found.
- certification_requirements: extract SPECIFIC mandatory certifications per position (e.g., DoD 8570/8140, PMP, CISSP). Only include certifications that are explicitly REQUIRED, not preferred. Include IAT/IAM level if specified.
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
      positions:                  'Key Personnel Positions',
      resume_format:              'Resume Format Requirements',
      loc_requirements:           'LOC Requirements',
      counts_against_page_limit:  'Counts Against Page Limit',
      backup_personnel_required:  'Backup Personnel Required',
      certification_requirements: 'Certification Requirements',
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
    console.error('extractKeyPersonnel failed:', err instanceof Error ? err.message : String(err));
    return [];
  }
}

/**
 * Extract security requirements from solicitation documents.
 *
 * Security requirements may appear:
 * - DD Form 254 (always an attachment when classified work is involved)
 * - NIST SP 800-171 / CMMC requirements in clauses or technical instructions
 * - System Security Plan (SSP) and Plan of Action as separate submission volumes
 * - Facility Clearance Level (FCL) requirements
 *
 * Extracts: DD254, clearance levels, CMMC/NIST, CUI handling, SSP requirements,
 * SPRS assessment score.
 */
export async function extractSecurityRequirements(documentTexts: string[]): Promise<ExtractionResult[]> {
  const textSample = truncateTexts(documentTexts);

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      temperature: 0,
      system:
        'You are an expert government security compliance analyst with 15+ years of experience ' +
        'reading federal solicitations across all procurement vehicles (UCF/FAR 15, SeaPort NxG, ' +
        'GSA Schedule/FAR 8.4, FAR Part 12 commercial, FAR Part 13 simplified). ' +
        'You extract security requirements by FUNCTION, not by label. ' +
        'Security requirements may appear in DD Form 254 attachments, contract clauses (DFARS 252.204), ' +
        'technical instructions, or as separate SSP/POA&M submission requirements. ' +
        'Extract only information explicitly stated — do not infer or fabricate.',
      messages: [
        {
          role: 'user',
          content: `Extract SECURITY REQUIREMENTS from this government solicitation.

Find the content that defines clearance levels, CMMC/NIST 800-171 compliance, CUI handling, DD254, SSP submission, and SPRS requirements.

Signal keywords: "DD 254", "DD254", "security classification", "facility clearance", "FCL", "personnel clearance", "NIST 800-171", "CMMC", "CUI", "controlled unclassified", "system security plan", "SSP", "plan of action", "POA&M", "SPRS", "PIEE", "assessment score", "110"

Solicitation text:
${textSample}

Extract the following fields and return ONLY valid JSON:

{
  "dd254_required": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": "Yes — DD254 included as Attachment 3"
  },
  "clearance_levels": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": ["Secret (facility)", "Top Secret/SCI (key personnel)"]
  },
  "cmmc_level": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": "CMMC Level 2 — Advanced"
  },
  "nist_800_171_required": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": "Yes — full compliance with NIST SP 800-171 Rev 2 required"
  },
  "cui_requirements": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": "All CUI must be handled per NIST SP 800-171; marking per DoDI 5200.48"
  },
  "ssp_required": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": "Yes — System Security Plan must be submitted as a separate volume"
  },
  "sprs_score": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": "Minimum SPRS score of 110 required at time of proposal submission"
  },
  "sprs_minimum_score": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": 110
  },
  "required_facility_clearance_level": {
    "found": true | false,
    "confidence": "high" | "medium" | "low",
    "value": "Secret"
  }
}

Rules:
- "found": true only if the data is explicitly stated in the document
- "confidence": "high" if clearly stated, "medium" if partially stated, "low" if inferred
- clearance_levels: list ALL clearance levels mentioned (facility, personnel, specific positions)
- dd254_required: note attachment reference if applicable
- sprs_minimum_score: extract the NUMERIC threshold only (e.g., 110), not the description. Return null if no numeric threshold found.
- required_facility_clearance_level: the MINIMUM facility clearance level required. Use one of: "Confidential", "Secret", "Top Secret", "Top Secret/SCI". Return null if not specified.
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
      dd254_required:                   'DD254 Required',
      clearance_levels:                 'Clearance Levels',
      cmmc_level:                       'CMMC Level',
      nist_800_171_required:            'NIST 800-171 Required',
      cui_requirements:                 'CUI Requirements',
      ssp_required:                     'SSP Required',
      sprs_score:                       'SPRS Score Requirement',
      sprs_minimum_score:               'SPRS Minimum Score Threshold',
      required_facility_clearance_level: 'Required Facility Clearance Level',
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
    console.error('extractSecurityRequirements failed:', err instanceof Error ? err.message : String(err));
    return [];
  }
}
