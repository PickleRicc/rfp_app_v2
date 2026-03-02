/**
 * Regression Guard Prompt & Logic
 * Phase 10: Section-by-Section Comparison (Phase C)
 *
 * Splits both draft versions into sections, has Claude score each pair,
 * and assembles the best version of each section into the final output.
 */

import type { SectionScore, RegressionReversion } from '@/lib/supabase/touchup-types';

// ===== SECTION SPLITTING =====

export interface MarkdownSection {
  title: string;
  level: number;
  content: string;
}

/**
 * Split markdown into sections by H1/H2 headings.
 * Returns an array of sections with their heading text and content.
 */
export function splitMarkdownIntoSections(markdown: string): MarkdownSection[] {
  const lines = markdown.split('\n');
  const sections: MarkdownSection[] = [];
  let currentTitle = '';
  let currentLevel = 0;
  let currentContent: string[] = [];

  for (const line of lines) {
    const h1Match = line.match(/^# (.+)$/);
    const h2Match = line.match(/^## (.+)$/);

    if (h1Match || h2Match) {
      if (currentTitle || currentContent.length > 0) {
        sections.push({
          title: currentTitle || '(Preamble)',
          level: currentLevel,
          content: currentContent.join('\n').trim(),
        });
      }
      currentTitle = h1Match ? h1Match[1].trim() : h2Match![1].trim();
      currentLevel = h1Match ? 1 : 2;
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }

  if (currentTitle || currentContent.length > 0) {
    sections.push({
      title: currentTitle || '(Preamble)',
      level: currentLevel,
      content: currentContent.join('\n').trim(),
    });
  }

  return sections;
}

/**
 * Align sections from two versions by matching heading titles.
 * Returns pairs of (draft1, touchup) sections. Unmatched sections
 * from the touchup are included as new additions.
 */
export function alignSections(
  draft1Sections: MarkdownSection[],
  touchupSections: MarkdownSection[]
): Array<{ draft1: MarkdownSection | null; touchup: MarkdownSection | null }> {
  const pairs: Array<{ draft1: MarkdownSection | null; touchup: MarkdownSection | null }> = [];
  const usedTouchupIndices = new Set<number>();

  for (const d1 of draft1Sections) {
    const matchIdx = touchupSections.findIndex((ts, idx) =>
      !usedTouchupIndices.has(idx) && normalizeTitle(ts.title) === normalizeTitle(d1.title)
    );

    if (matchIdx >= 0) {
      usedTouchupIndices.add(matchIdx);
      pairs.push({ draft1: d1, touchup: touchupSections[matchIdx] });
    } else {
      pairs.push({ draft1: d1, touchup: null });
    }
  }

  // New sections in touchup that don't exist in draft 1 — always keep
  touchupSections.forEach((ts, idx) => {
    if (!usedTouchupIndices.has(idx)) {
      pairs.push({ draft1: null, touchup: ts });
    }
  });

  return pairs;
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

// ===== PROMPT ASSEMBLY =====

export interface RegressionGuardPromptResult {
  systemPrompt: string;
  userPrompt: string;
}

export function assembleRegressionGuardPrompt(
  volumeName: string,
  sectionPairs: Array<{ draft1: MarkdownSection | null; touchup: MarkdownSection | null }>
): RegressionGuardPromptResult {
  const comparablePairs = sectionPairs.filter(p => p.draft1 && p.touchup);

  const systemPrompt = `You are a government proposal quality assurance reviewer comparing two versions of proposal sections. For each section pair, you must score both Version A (original draft) and Version B (touchup rewrite) on a 1-10 scale across four dimensions.

Be objective and precise. A higher score means better quality for that dimension. Score based only on the content you see.

SCORING DIMENSIONS:
1. compliance_coverage (1-10): Does the section address the relevant evaluation factors and requirements?
2. data_accuracy (1-10): Are claims backed by specific, verifiable data (names, numbers, dates, contract references)?
3. detail_specificity (1-10): Are claims quantified? Are personnel named? Are contract values cited?
4. compliance_language (1-10): Does it use shall/will phrasing, active voice, and evaluator-friendly structure?

Output ONLY valid JSON matching the schema below. No explanation outside the JSON.`;

  const sectionComparisons = comparablePairs.map((pair, idx) => {
    return `--- SECTION ${idx + 1}: "${pair.draft1!.title}" ---

VERSION A (Original Draft):
${pair.draft1!.content.slice(0, 3000)}${pair.draft1!.content.length > 3000 ? '\n[...truncated]' : ''}

VERSION B (Touchup Rewrite):
${pair.touchup!.content.slice(0, 3000)}${pair.touchup!.content.length > 3000 ? '\n[...truncated]' : ''}`;
  }).join('\n\n');

  const userPrompt = `Score each section pair for volume "${volumeName}".

${sectionComparisons}

=== REQUIRED OUTPUT FORMAT (JSON only) ===
{
  "section_scores": [
    {
      "section_title": "<heading text>",
      "version_a": {
        "compliance_coverage": <1-10>,
        "data_accuracy": <1-10>,
        "detail_specificity": <1-10>,
        "compliance_language": <1-10>
      },
      "version_b": {
        "compliance_coverage": <1-10>,
        "data_accuracy": <1-10>,
        "detail_specificity": <1-10>,
        "compliance_language": <1-10>
      }
    }
  ]
}`;

  return { systemPrompt, userPrompt };
}

// ===== DECISION LOGIC =====

export interface RegressionGuardScores {
  section_scores: Array<{
    section_title: string;
    version_a: {
      compliance_coverage: number;
      data_accuracy: number;
      detail_specificity: number;
      compliance_language: number;
    };
    version_b: {
      compliance_coverage: number;
      data_accuracy: number;
      detail_specificity: number;
      compliance_language: number;
    };
  }>;
}

function sumScores(scores: { compliance_coverage: number; data_accuracy: number; detail_specificity: number; compliance_language: number }): number {
  return scores.compliance_coverage + scores.data_accuracy + scores.detail_specificity + scores.compliance_language;
}

function toSectionScore(title: string, scores: { compliance_coverage: number; data_accuracy: number; detail_specificity: number; compliance_language: number }): SectionScore {
  return {
    section_title: title,
    compliance_coverage: scores.compliance_coverage,
    data_accuracy: scores.data_accuracy,
    detail_specificity: scores.detail_specificity,
    compliance_language: scores.compliance_language,
    total: sumScores(scores),
  };
}

/**
 * Apply the regression guard decision rule to each section pair.
 * Returns the final assembled markdown and any reversions that occurred.
 */
export function applyRegressionGuard(
  sectionPairs: Array<{ draft1: MarkdownSection | null; touchup: MarkdownSection | null }>,
  guardScores: RegressionGuardScores
): { finalMarkdown: string; reversions: RegressionReversion[] } {
  const reversions: RegressionReversion[] = [];
  const finalSections: string[] = [];

  const scoreMap = new Map<string, (typeof guardScores.section_scores)[0]>();
  for (const s of guardScores.section_scores) {
    scoreMap.set(normalizeTitle(s.section_title), s);
  }

  for (const pair of sectionPairs) {
    // New section in touchup only — always keep
    if (!pair.draft1 && pair.touchup) {
      const heading = '#'.repeat(pair.touchup.level || 1) + ' ' + pair.touchup.title;
      finalSections.push(heading + '\n\n' + pair.touchup.content);
      continue;
    }

    // Section removed in touchup — keep draft 1 version
    if (pair.draft1 && !pair.touchup) {
      const heading = '#'.repeat(pair.draft1.level || 1) + ' ' + pair.draft1.title;
      finalSections.push(heading + '\n\n' + pair.draft1.content);
      continue;
    }

    // Both exist — compare scores
    const scores = scoreMap.get(normalizeTitle(pair.draft1!.title));

    if (scores) {
      const d1Total = sumScores(scores.version_a);
      const tuTotal = sumScores(scores.version_b);

      if (tuTotal >= d1Total) {
        const heading = '#'.repeat(pair.touchup!.level || 1) + ' ' + pair.touchup!.title;
        finalSections.push(heading + '\n\n' + pair.touchup!.content);
      } else {
        const heading = '#'.repeat(pair.draft1!.level || 1) + ' ' + pair.draft1!.title;
        finalSections.push(heading + '\n\n' + pair.draft1!.content);
        reversions.push({
          section_title: pair.draft1!.title,
          draft1_score: toSectionScore(pair.draft1!.title, scores.version_a),
          touchup_score: toSectionScore(pair.touchup!.title, scores.version_b),
          reason: `Draft 1 scored ${d1Total}/40 vs Touchup ${tuTotal}/40`,
        });
      }
    } else {
      // No scores available — default to touchup (it filled gaps)
      const heading = '#'.repeat(pair.touchup!.level || 1) + ' ' + pair.touchup!.title;
      finalSections.push(heading + '\n\n' + pair.touchup!.content);
    }
  }

  return {
    finalMarkdown: finalSections.join('\n\n'),
    reversions,
  };
}
