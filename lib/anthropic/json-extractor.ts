/**
 * Extract JSON from Claude's response, handling markdown code blocks
 * and other formatting that might interfere with parsing
 */
export function extractJSON(text: string): string {
  let cleaned = text.trim();

  // Remove markdown code blocks with language specifier (```json ... ```)
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/i, '');
  } else if (cleaned.startsWith('```')) {
    // Remove plain markdown code blocks (``` ... ```)
    cleaned = cleaned.replace(/^```\s*/, '');
  }

  // Remove trailing code block markers
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.replace(/\s*```$/, '');
  }

  return cleaned.trim();
}

/**
 * Attempt to repair truncated JSON by closing open strings, arrays, and objects.
 * This handles the common case where Claude's response hits max_tokens and the
 * JSON is cut off mid-value.
 */
export function repairTruncatedJSON(text: string): string {
  let repaired = text.trimEnd();

  // Remove a trailing incomplete key-value (e.g., `"key": "some untermina`)
  // by stripping back to the last complete value
  const lastCompleteComma = repaired.lastIndexOf(',');
  const lastCompleteBrace = Math.max(repaired.lastIndexOf('}'), repaired.lastIndexOf(']'));

  // If the last comma is after the last closing brace/bracket, the tail is incomplete
  if (lastCompleteComma > lastCompleteBrace && lastCompleteBrace > 0) {
    repaired = repaired.slice(0, lastCompleteComma);
  }

  // If we end mid-string (odd number of unescaped quotes suggests open string),
  // close the string and truncate the value
  const unescapedQuotes = repaired.match(/(?<!\\)"/g);
  if (unescapedQuotes && unescapedQuotes.length % 2 !== 0) {
    repaired += '"';
  }

  // Count open brackets/braces and close them
  let openBraces = 0;
  let openBrackets = 0;
  let inString = false;

  for (let i = 0; i < repaired.length; i++) {
    const ch = repaired[i];
    if (ch === '\\' && inString) { i++; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') openBraces++;
    else if (ch === '}') openBraces--;
    else if (ch === '[') openBrackets++;
    else if (ch === ']') openBrackets--;
  }

  for (let i = 0; i < openBrackets; i++) repaired += ']';
  for (let i = 0; i < openBraces; i++) repaired += '}';

  return repaired;
}

/**
 * Parse JSON from Claude's response with automatic cleanup.
 * Falls back to truncation repair if the initial parse fails.
 */
export function parseClaudeJSON<T = any>(text: string): T {
  const cleaned = extractJSON(text);

  try {
    return JSON.parse(cleaned);
  } catch {
    // Attempt truncation repair — common when response hits max_tokens
    console.warn('[json-extractor] Initial parse failed, attempting truncation repair...');
    const repaired = repairTruncatedJSON(cleaned);
    try {
      return JSON.parse(repaired);
    } catch (repairErr) {
      console.error('[json-extractor] Repair failed. Original length:', cleaned.length, 'Repaired length:', repaired.length);
      // Throw with context about the truncation
      throw new Error(
        `JSON parse failed (likely truncated response). ` +
        `Original length: ${cleaned.length} chars. ` +
        `Last 100 chars: ...${cleaned.slice(-100)}`
      );
    }
  }
}
