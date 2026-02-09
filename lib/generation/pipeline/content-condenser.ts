/**
 * Content Condenser Service (Framework Part 8.2)
 *
 * Uses Claude AI to reduce content length while preserving
 * all compliance language (statements starting with "[Company] will").
 */

import { anthropic, MODEL } from '@/lib/anthropic/client';
import { PAGE_CONSTANTS } from '../planning/page-estimator';

/**
 * Result of content condensing operation
 */
export interface CondensingResult {
  originalContent: string;
  condensedContent: string;
  originalPages: number;
  condensedPages: number;
  complianceStatementsPreserved: number;
  confidence: 'high' | 'medium' | 'low';
  success: boolean;
}

/**
 * Simplified result for callback usage
 */
export interface CondenseCallbackResult {
  condensedContent: string;
  success: boolean;
}

/**
 * Extract compliance statements from content
 * Compliance statements start with "[Company] will" or "We will" or "The Contractor will"
 */
function extractComplianceStatements(
  content: string,
  companyName: string
): string[] {
  const statements: string[] = [];

  // Patterns for compliance statements
  const patterns = [
    new RegExp(`${companyName}\\s+will\\b[^.!?]*[.!?]`, 'gi'),
    /We will\b[^.!?]*[.!?]/gi,
    /The Contractor will\b[^.!?]*[.!?]/gi,
    /shall\s+provide\b[^.!?]*[.!?]/gi,
    /shall\s+ensure\b[^.!?]*[.!?]/gi,
    /shall\s+maintain\b[^.!?]*[.!?]/gi,
  ];

  for (const pattern of patterns) {
    const matches = content.match(pattern);
    if (matches) {
      statements.push(...matches);
    }
  }

  // Deduplicate
  return [...new Set(statements)];
}

/**
 * Estimate pages for content string
 */
function estimatePages(content: string): number {
  return content.length / PAGE_CONSTANTS.CHARS_PER_PAGE;
}

/**
 * Build the condensing prompt for Claude
 */
function buildCondensingPrompt(
  content: string,
  targetChars: number,
  companyName: string,
  complianceStatements: string[]
): string {
  const complianceList =
    complianceStatements.length > 0
      ? complianceStatements.map((s, i) => `${i + 1}. "${s}"`).join('\n')
      : 'None identified';

  return `You are an expert government proposal writer. Your task is to condense the following proposal content to fit within a page limit while preserving ALL compliance statements verbatim.

## CRITICAL REQUIREMENTS

1. **Preserve ALL compliance statements EXACTLY as written** - These are contractual commitments that cannot be modified:
${complianceList}

2. **Target length:** ${targetChars} characters (currently ${content.length} characters)

3. **Condensing strategy (in order):**
   - First: Remove redundant examples and excessive detail
   - Second: Condense descriptive passages while keeping meaning
   - Third: Tighten language (remove filler words, combine sentences)
   - NEVER: Remove or modify compliance statements

4. **Maintain:**
   - Professional government proposal tone
   - Technical accuracy
   - Section structure and headers
   - Key differentiators and win themes

## ORIGINAL CONTENT

${content}

## OUTPUT FORMAT

Provide ONLY the condensed content. Do not include any preamble, explanation, or metadata. The output should be ready to insert directly into the proposal.

After the condensed content, on a new line, add:
---COMPLIANCE_COUNT: X---
Where X is the number of compliance statements preserved.`;
}

/**
 * Parse the Claude response to extract condensed content and compliance count
 */
function parseCondensingResponse(response: string): {
  condensedContent: string;
  complianceCount: number;
} {
  // Look for the compliance count marker
  const countMatch = response.match(/---COMPLIANCE_COUNT:\s*(\d+)---/);
  const complianceCount = countMatch ? parseInt(countMatch[1], 10) : 0;

  // Remove the marker from content
  const condensedContent = response
    .replace(/---COMPLIANCE_COUNT:\s*\d+---\s*$/, '')
    .trim();

  return { condensedContent, complianceCount };
}

/**
 * Determine confidence level based on condensing results
 */
function determineConfidence(
  originalStatements: number,
  preservedStatements: number,
  targetPages: number,
  actualPages: number
): 'high' | 'medium' | 'low' {
  // Check compliance preservation
  const complianceRatio =
    originalStatements > 0 ? preservedStatements / originalStatements : 1;

  // Check if we hit the target
  const pagesRatio = actualPages / targetPages;

  if (complianceRatio >= 1 && pagesRatio <= 1.05) {
    return 'high'; // All compliance preserved and within 5% of target
  } else if (complianceRatio >= 0.9 && pagesRatio <= 1.15) {
    return 'medium'; // 90%+ compliance and within 15% of target
  } else {
    return 'low'; // Some compliance lost or significantly over target
  }
}

/**
 * Condense content to fit within target page count
 *
 * Uses Claude AI to intelligently reduce content while preserving
 * all compliance language.
 *
 * @param content Original content to condense
 * @param targetPages Target number of pages
 * @param companyName Company name for compliance statement detection
 * @returns CondensingResult with original and condensed content
 *
 * @example
 * ```typescript
 * const result = await condenseContent(
 *   longTechnicalApproach,
 *   10, // Target 10 pages
 *   'Acme Corporation'
 * );
 *
 * if (result.success) {
 *   console.log(`Reduced from ${result.originalPages} to ${result.condensedPages} pages`);
 *   console.log(`Preserved ${result.complianceStatementsPreserved} compliance statements`);
 * }
 * ```
 */
export async function condenseContent(
  content: string,
  targetPages: number,
  companyName: string
): Promise<CondensingResult> {
  const originalPages = estimatePages(content);

  // If already under target, return as-is
  if (originalPages <= targetPages) {
    const complianceStatements = extractComplianceStatements(content, companyName);
    return {
      originalContent: content,
      condensedContent: content,
      originalPages,
      condensedPages: originalPages,
      complianceStatementsPreserved: complianceStatements.length,
      confidence: 'high',
      success: true,
    };
  }

  // Extract compliance statements to preserve
  const complianceStatements = extractComplianceStatements(content, companyName);

  // Calculate target character count (with 5% buffer under target)
  const targetChars = Math.floor(
    targetPages * PAGE_CONSTANTS.CHARS_PER_PAGE * 0.95
  );

  // Build the prompt
  const prompt = buildCondensingPrompt(
    content,
    targetChars,
    companyName,
    complianceStatements
  );

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: Math.ceil(targetChars * 1.2), // Allow some buffer
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    // Extract text from response
    const responseText =
      response.content[0].type === 'text' ? response.content[0].text : '';

    // Parse the response
    const { condensedContent, complianceCount } =
      parseCondensingResponse(responseText);

    const condensedPages = estimatePages(condensedContent);

    // Determine confidence
    const confidence = determineConfidence(
      complianceStatements.length,
      complianceCount,
      targetPages,
      condensedPages
    );

    // Success if we got content and hit reasonably close to target
    const success = condensedContent.length > 0 && condensedPages <= targetPages * 1.1;

    return {
      originalContent: content,
      condensedContent: success ? condensedContent : content,
      originalPages,
      condensedPages: success ? condensedPages : originalPages,
      complianceStatementsPreserved: complianceCount,
      confidence,
      success,
    };
  } catch (error) {
    console.error('Content condensing failed:', error);

    // Return original content on failure
    return {
      originalContent: content,
      condensedContent: content,
      originalPages,
      condensedPages: originalPages,
      complianceStatementsPreserved: complianceStatements.length,
      confidence: 'low',
      success: false,
    };
  }
}

/**
 * Wrapper for use as PageTracker callback
 *
 * Returns simplified result matching CondenseCallback signature.
 */
export async function condenseContentCallback(
  content: string,
  targetPages: number,
  companyName: string
): Promise<CondenseCallbackResult> {
  const result = await condenseContent(content, targetPages, companyName);
  return {
    condensedContent: result.condensedContent,
    success: result.success,
  };
}

/**
 * Multi-pass condensing for aggressive reduction
 *
 * Uses multiple passes with different strategies:
 * 1. Remove examples
 * 2. Condense descriptions
 * 3. Tighten language
 */
export async function condenseContentMultiPass(
  content: string,
  targetPages: number,
  companyName: string
): Promise<CondensingResult> {
  const originalPages = estimatePages(content);

  // If already under target, return as-is
  if (originalPages <= targetPages) {
    const complianceStatements = extractComplianceStatements(content, companyName);
    return {
      originalContent: content,
      condensedContent: content,
      originalPages,
      condensedPages: originalPages,
      complianceStatementsPreserved: complianceStatements.length,
      confidence: 'high',
      success: true,
    };
  }

  // Try single pass first
  const singlePassResult = await condenseContent(content, targetPages, companyName);

  if (singlePassResult.success && singlePassResult.condensedPages <= targetPages) {
    return singlePassResult;
  }

  // If single pass didn't work, try more aggressive condensing
  const complianceStatements = extractComplianceStatements(content, companyName);
  const targetChars = Math.floor(
    targetPages * PAGE_CONSTANTS.CHARS_PER_PAGE * 0.90 // 10% buffer for aggressive
  );

  const aggressivePrompt = `You are an expert government proposal editor. Your task is to AGGRESSIVELY condense this proposal content.

## ABSOLUTE REQUIREMENTS

1. **These compliance statements MUST appear EXACTLY as written:**
${complianceStatements.map((s, i) => `${i + 1}. "${s}"`).join('\n')}

2. **Target: ${targetChars} characters** (currently ${singlePassResult.condensedContent.length} characters)

## AGGRESSIVE CONDENSING RULES

1. Remove ALL examples unless they demonstrate unique capability
2. Remove ALL redundant explanations
3. Combine sentences aggressively
4. Remove transitional phrases and filler
5. Use bullet points instead of paragraphs where possible
6. Keep ONLY essential technical details

## CONTENT TO CONDENSE

${singlePassResult.condensedContent}

## OUTPUT

Provide ONLY the condensed content, ready for direct insertion.

End with: ---COMPLIANCE_COUNT: X---`;

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: Math.ceil(targetChars * 1.2),
      messages: [{ role: 'user', content: aggressivePrompt }],
    });

    const responseText =
      response.content[0].type === 'text' ? response.content[0].text : '';

    const { condensedContent, complianceCount } =
      parseCondensingResponse(responseText);

    const condensedPages = estimatePages(condensedContent);
    const confidence = determineConfidence(
      complianceStatements.length,
      complianceCount,
      targetPages,
      condensedPages
    );

    const success = condensedContent.length > 0 && condensedPages <= targetPages * 1.1;

    return {
      originalContent: content,
      condensedContent: success ? condensedContent : singlePassResult.condensedContent,
      originalPages,
      condensedPages: success ? condensedPages : singlePassResult.condensedPages,
      complianceStatementsPreserved: complianceCount,
      confidence,
      success,
    };
  } catch (error) {
    console.error('Multi-pass condensing failed:', error);
    return singlePassResult;
  }
}
