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
 * Parse JSON from Claude's response with automatic cleanup
 */
export function parseClaudeJSON<T = any>(text: string): T {
  const cleaned = extractJSON(text);
  return JSON.parse(cleaned);
}
