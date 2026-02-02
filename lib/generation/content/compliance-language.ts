/**
 * Compliance Language Patterns (Framework Part 6.1)
 * Ensures systematic compliance language in all proposal responses
 */

export interface CompliancePattern {
  pattern: 'shall' | 'must' | 'will' | 'should';
  template: string;
}

export const COMPLIANCE_PATTERNS = {
  shall: (company: string, action: string) => `${company} will ${action}`,

  explicit: (company: string, reqNum: string, approach: string) =>
    `${company} fully complies with ${reqNum} by ${approach}.`,

  exceeds: (company: string, reqNum: string, extra: string) =>
    `Beyond the ${reqNum} requirement, ${company} additionally provides ${extra}.`,

  understanding: (agency: string, requirement: string, approach: string) =>
    `${agency} requires ${requirement}. Our approach ${approach}.`,
};

/**
 * Generate compliance statement based on requirement
 */
export function generateComplianceStatement(
  requirement: string,
  company: string,
  approach: string
): string {
  // Parse requirement for "shall" verbs
  const shallMatch = requirement.match(/shall\s+(\w+)/i);

  if (shallMatch) {
    return COMPLIANCE_PATTERNS.shall(company, approach);
  }

  const mustMatch = requirement.match(/must\s+(\w+)/i);
  if (mustMatch) {
    return `${company} will ensure ${approach}.`;
  }

  return `${company} will ${approach}.`;
}

/**
 * Compliance instructions to include in AI prompts
 */
export function getComplianceInstructions(companyName: string): string {
  return `
CRITICAL - COMPLIANCE LANGUAGE RULES:
You MUST follow these patterns for every requirement response:

1. For "shall" requirements, respond with: "${companyName} will [exact verb from requirement]..."
   Example: REQ says "shall provide weekly reports" → "${companyName} will provide weekly status reports that include..."

2. For "must" requirements, use: "${companyName} will ensure [action]..."
   Example: REQ says "must maintain security" → "${companyName} will ensure security is maintained through..."

3. Start responses by restating the requirement to show understanding:
   Pattern: "[Agency] requires [summary of need]. ${companyName} will [high-level approach]."

4. For critical requirements, use explicit compliance statements:
   "${companyName} fully complies with [REQ X] by [specific approach]."

5. When exceeding requirements, use:
   "Beyond the [REQ X] requirement, ${companyName} additionally provides [extra capability]."

6. Always use active voice and present/future tense for the company's actions.

7. Be specific: Don't say "we will comply" - say HOW you will comply.

Example Response Structure:
"[Agency] requires weekly status reporting on project progress (REQ 3.1.2). ${companyName} will provide comprehensive weekly status reports every Friday by 5 PM EST that include:
• Current sprint progress and completed tasks
• Upcoming milestones and deliverables
• Risk status and mitigation actions
• Resource utilization and team status

Reports will be delivered via the customer's designated SharePoint portal, with automated notifications sent to the COR and designated stakeholders. ${companyName} fully complies with REQ 3.1.2 by implementing a structured reporting framework that ensures transparency and enables proactive decision-making."

DO NOT use vague language like "we will comply" without explaining HOW.
DO use specific verbs that match the requirement verbs exactly.
DO explain the mechanism/process, not just the commitment.
`;
}

/**
 * Extract compliance verbs from requirement text
 */
export function extractComplianceVerbs(requirementText: string): string[] {
  const verbs: string[] = [];

  // Match "shall [verb]" patterns
  const shallMatches = requirementText.matchAll(/shall\s+(\w+)/gi);
  for (const match of shallMatches) {
    verbs.push(match[1]);
  }

  // Match "must [verb]" patterns
  const mustMatches = requirementText.matchAll(/must\s+(\w+)/gi);
  for (const match of mustMatches) {
    verbs.push(match[1]);
  }

  return verbs;
}

/**
 * Validate if text contains proper compliance language
 */
export function validateComplianceLanguage(
  text: string,
  companyName: string,
  requirements: any[]
): {
  valid: boolean;
  issues: string[];
  suggestions: string[];
} {
  const issues: string[] = [];
  const suggestions: string[] = [];

  // Check for company name with "will" pattern
  const hasWillPattern = new RegExp(`${companyName}\\s+will`, 'i').test(text);
  if (!hasWillPattern) {
    issues.push('Missing "[Company] will" compliance pattern');
    suggestions.push(`Add explicit statements like: "${companyName} will [action]..."`);
  }

  // Check for vague compliance statements
  if (/we\s+will\s+comply/i.test(text) && !/how|by|through/i.test(text)) {
    issues.push('Vague compliance statement without explanation');
    suggestions.push('Replace "will comply" with specific HOW the company will comply');
  }

  // Check if requirement verbs are echoed
  for (const req of requirements) {
    const verbs = extractComplianceVerbs(req.requirement_text);
    for (const verb of verbs) {
      const verbPattern = new RegExp(`\\b${verb}\\b`, 'i');
      if (!verbPattern.test(text)) {
        issues.push(`Requirement verb "${verb}" not echoed in response`);
        suggestions.push(`Include the verb "${verb}" from the requirement in your response`);
      }
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    suggestions,
  };
}
