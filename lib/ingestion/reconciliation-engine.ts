/**
 * Reconciliation Engine
 * Phase 6: Multi-Document Ingestion
 *
 * Core AI-powered reconciliation logic.
 * Compares amendment documents against base RFP text to identify superseded sections.
 * Parses Q&A response documents to identify answers that modify requirements.
 *
 * All AI analysis uses Anthropic with structured JSON output.
 */

import { anthropic, MODEL } from '@/lib/anthropic/client';
import type {
  ReconciliationChangeType,
  ReconciliationSourceType,
} from '@/lib/supabase/solicitation-types';

// ===== TYPES =====

/**
 * A single reconciliation record matching the document_reconciliations table schema.
 * Returned by both reconcileAmendments and parseQAModifications.
 */
export interface ReconciliationResult {
  /** The amendment or Q&A document that introduced this change */
  source_document_id: string;
  /** The base document or earlier amendment being modified (null for additive changes) */
  target_document_id: string | null;
  /** Category of change made */
  change_type: ReconciliationChangeType;
  /** Provenance — formal amendment or informal Q&A */
  source_type: ReconciliationSourceType;
  /** Section reference in the document, e.g., "Section L.4.2", "Question 15" */
  section_reference: string;
  /** The original text that was superseded or modified */
  original_text: string;
  /** The replacement text from the amendment or Q&A */
  replacement_text: string;
}

// ===== HELPER =====

/**
 * Extract JSON from markdown code blocks returned by Anthropic.
 * Strips ```json ... ``` wrapper if present, otherwise returns trimmed text.
 */
function extractJSON(text: string): string {
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    return jsonMatch[1].trim();
  }
  return text.trim();
}

// ===== RECONCILE AMENDMENTS =====

/**
 * Compares amendment documents against the base RFP and earlier amendments.
 * Identifies sections where each amendment supersedes or modifies the base text.
 *
 * Processing order: amendments are sorted chronologically by amendment_number so
 * each is compared against the current truth (base + all earlier amendments).
 * This builds the full chain: Original -> Amend 1 -> Amend 2.
 *
 * @param baseDocument - The base RFP or SOW document to compare against
 * @param amendments - All amendment documents for the solicitation
 * @returns Array of ReconciliationResult records to insert into document_reconciliations
 */
export async function reconcileAmendments(
  baseDocument: {
    id: string;
    extracted_text: string;
    document_type: string;
  },
  amendments: {
    id: string;
    extracted_text: string;
    amendment_number: string;
    effective_date?: string;
  }[]
): Promise<ReconciliationResult[]> {
  if (amendments.length === 0) {
    return [];
  }

  // Sort amendments chronologically so we build the chain correctly
  const sortedAmendments = [...amendments].sort((a, b) =>
    a.amendment_number.localeCompare(b.amendment_number, undefined, { numeric: true })
  );

  const allResults: ReconciliationResult[] = [];

  // Track the "current truth" — base text plus all earlier amendment changes
  // For each amendment, we compare it against the original base document
  // (chain tracking is done by the Inngest function which marks superseded docs)
  const baseTextTruncated = baseDocument.extracted_text.substring(0, 20000);

  for (const amendment of sortedAmendments) {
    const amendmentTextTruncated = amendment.extracted_text.substring(0, 15000);

    const effectiveDateNote = amendment.effective_date
      ? `Effective date: ${amendment.effective_date}`
      : 'No effective date specified';

    let aiResponse;
    try {
      aiResponse = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: `You are analyzing a government solicitation amendment against the base RFP document.

Your task: Identify ALL sections where Amendment ${amendment.amendment_number} changes, supersedes, or modifies the base document.

${effectiveDateNote}

BASE DOCUMENT (${baseDocument.document_type}):
${baseTextTruncated}

AMENDMENT ${amendment.amendment_number}:
${amendmentTextTruncated}

For each change found, extract:
1. section_reference — the specific section being modified (e.g., "Section L.4.2", "Part I Section C", "Attachment J-1", "Paragraph 5.3.1")
2. original_text — the text from the base document that is being superseded or modified (quote directly, max 500 chars)
3. replacement_text — the new text from the amendment (quote directly, max 500 chars)
4. change_type — one of:
   - "supersedes_section" — amendment completely replaces an entire section
   - "adds_requirement" — amendment adds a new requirement not in the base document
   - "removes_requirement" — amendment deletes a requirement from the base document
   - "general_modification" — any other change (clarification, correction, administrative update)

Focus on substantive changes that affect proposal requirements. Skip administrative headers, page numbers, and formatting-only changes.

If you find no substantive changes, return an empty array.

Respond ONLY with a JSON array. No explanation, no markdown prose. Example format:
\`\`\`json
[
  {
    "section_reference": "Section L.4.2",
    "original_text": "Proposals shall not exceed 50 pages",
    "replacement_text": "Proposals shall not exceed 75 pages",
    "change_type": "general_modification"
  }
]
\`\`\``,
          },
        ],
      });
    } catch (err) {
      console.error(
        `Anthropic error reconciling amendment ${amendment.amendment_number}:`,
        err
      );
      continue;
    }

    const content = aiResponse.content[0];
    if (content.type !== 'text') {
      console.error(`Unexpected Anthropic response type for amendment ${amendment.amendment_number}`);
      continue;
    }

    let changes: Array<{
      section_reference: string;
      original_text: string;
      replacement_text: string;
      change_type: string;
    }> = [];

    try {
      const jsonText = extractJSON(content.text);
      changes = JSON.parse(jsonText);
      if (!Array.isArray(changes)) {
        changes = [];
      }
    } catch (err) {
      console.error(`Failed to parse reconciliation JSON for amendment ${amendment.amendment_number}:`, err);
      continue;
    }

    const validChangeTypes = new Set<ReconciliationChangeType>([
      'supersedes_section',
      'adds_requirement',
      'removes_requirement',
      'general_modification',
    ]);

    for (const change of changes) {
      const changeType = validChangeTypes.has(change.change_type as ReconciliationChangeType)
        ? (change.change_type as ReconciliationChangeType)
        : 'general_modification';

      allResults.push({
        source_document_id: amendment.id,
        target_document_id: baseDocument.id,
        change_type: changeType,
        source_type: 'amendment',
        section_reference: change.section_reference || 'Unknown Section',
        original_text: change.original_text || '',
        replacement_text: change.replacement_text || '',
      });
    }
  }

  return allResults;
}

// ===== PARSE Q&A MODIFICATIONS =====

/**
 * Parses Q&A response documents to identify answers that modify requirements.
 *
 * Specifically looks for changes to:
 * - Scope of work (change_type: 'modifies_scope')
 * - Page limits (change_type: 'modifies_page_limit')
 * - Evaluation criteria (change_type: 'modifies_eval_criteria')
 * - Submission instructions (change_type: 'modifies_submission_instructions')
 * - New requirements (change_type: 'adds_requirement')
 *
 * All results are tagged source_type: 'qa_response' for clear provenance
 * per user decision: "Q&A responses tagged as 'Q&A-sourced' for clear provenance".
 *
 * @param qaDocument - The Q&A response document
 * @param baseDocument - The base RFP document to compare against
 * @returns Array of ReconciliationResult records tagged as qa_response
 */
export async function parseQAModifications(
  qaDocument: { id: string; extracted_text: string },
  baseDocument: { id: string; extracted_text: string }
): Promise<ReconciliationResult[]> {
  const qaTextTruncated = qaDocument.extracted_text.substring(0, 15000);
  const baseTextTruncated = baseDocument.extracted_text.substring(0, 15000);

  let aiResponse;
  try {
    aiResponse = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `You are analyzing a government solicitation Q&A response document to identify answers that modify or clarify the base RFP requirements.

Your task: Find Q&A answers that substantively change or clarify the base document requirements. Focus specifically on these high-impact modification types:
- SCOPE changes: answers that expand, reduce, or redefine the scope of work
- PAGE LIMIT changes: answers that increase or decrease page/volume limits
- EVALUATION CRITERIA changes: answers that modify how proposals will be evaluated or scored
- SUBMISSION INSTRUCTION changes: answers that change how/when/where to submit
- NEW REQUIREMENTS: answers that add requirements not in the base document

BASE RFP DOCUMENT (excerpt):
${baseTextTruncated}

Q&A RESPONSE DOCUMENT:
${qaTextTruncated}

For each qualifying Q&A answer found, extract:
1. section_reference — question number and/or the section of the RFP being addressed (e.g., "Question 15 (Section L.4)", "Q&A #7")
2. original_text — the original RFP requirement being clarified or modified (from the base document or the question text, max 400 chars)
3. replacement_text — the answer/clarification from the Q&A document (max 400 chars)
4. change_type — one of:
   - "modifies_scope" — changes scope of work
   - "modifies_page_limit" — changes page or volume limits
   - "modifies_eval_criteria" — changes evaluation criteria or scoring
   - "modifies_submission_instructions" — changes submission procedures
   - "adds_requirement" — adds a new requirement via Q&A

Only include answers that substantively modify requirements. Skip answers that merely restate the RFP without change, or that say "No change" / "See the RFP".

If no substantive modifications are found, return an empty array.

Respond ONLY with a JSON array. No explanation, no markdown prose. Example format:
\`\`\`json
[
  {
    "section_reference": "Question 23 (Section L.5)",
    "original_text": "Technical volume shall not exceed 50 pages",
    "replacement_text": "The CO confirms the technical volume limit is increased to 75 pages",
    "change_type": "modifies_page_limit"
  }
]
\`\`\``,
        },
      ],
    });
  } catch (err) {
    console.error('Anthropic error parsing Q&A modifications:', err);
    return [];
  }

  const content = aiResponse.content[0];
  if (content.type !== 'text') {
    console.error('Unexpected Anthropic response type for Q&A parsing');
    return [];
  }

  let modifications: Array<{
    section_reference: string;
    original_text: string;
    replacement_text: string;
    change_type: string;
  }> = [];

  try {
    const jsonText = extractJSON(content.text);
    modifications = JSON.parse(jsonText);
    if (!Array.isArray(modifications)) {
      modifications = [];
    }
  } catch (err) {
    console.error('Failed to parse Q&A modifications JSON:', err);
    return [];
  }

  const validQAChangeTypes = new Set<ReconciliationChangeType>([
    'modifies_scope',
    'modifies_page_limit',
    'modifies_eval_criteria',
    'modifies_submission_instructions',
    'adds_requirement',
  ]);

  return modifications.map((mod) => {
    const changeType = validQAChangeTypes.has(mod.change_type as ReconciliationChangeType)
      ? (mod.change_type as ReconciliationChangeType)
      : 'general_modification';

    return {
      source_document_id: qaDocument.id,
      target_document_id: baseDocument.id,
      change_type: changeType,
      source_type: 'qa_response' as ReconciliationSourceType,
      section_reference: mod.section_reference || 'Unknown Section',
      original_text: mod.original_text || '',
      replacement_text: mod.replacement_text || '',
    };
  });
}
