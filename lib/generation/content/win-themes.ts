import { Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType } from 'docx';

/**
 * Win Theme Integration (Framework Part 6.2)
 * Integrates win themes and value propositions throughout proposal sections
 */

export interface ValueProposition {
  id: string;
  theme: string;
  statement: string;
  proof_points: string[];
  applicable_to: string[];
}

/**
 * Integrate win themes into content paragraphs
 * Inserts callout boxes with themes at strategic points
 */
export function integrateWinThemes(
  sectionName: string,
  content: Paragraph[],
  themes: ValueProposition[]
): (Paragraph | Table)[] {
  // Find themes applicable to this section
  const relevantThemes = themes.filter((t) =>
    t.applicable_to.some((area) =>
      sectionName.toLowerCase().includes(area.toLowerCase()) ||
      area.toLowerCase().includes(sectionName.toLowerCase())
    )
  );

  if (relevantThemes.length === 0) {
    return content;
  }

  const enhanced: (Paragraph | Table)[] = [];
  let themeIndex = 0;

  // Insert themes as callout boxes every 3-4 paragraphs
  for (let i = 0; i < content.length; i++) {
    enhanced.push(content[i]);

    // Insert theme after every 3rd paragraph, if we have themes left
    if ((i + 1) % 3 === 0 && themeIndex < relevantThemes.length) {
      const theme = relevantThemes[themeIndex];
      enhanced.push(...createThemeCalloutBox(theme));
      themeIndex++;
    }
  }

  return enhanced;
}

/**
 * Create a callout box for a win theme (Framework Part 4.2)
 * Uses table-based approach for bordered, shaded boxes
 */
function createThemeCalloutBox(theme: ValueProposition): (Paragraph | Table)[] {
  const elements: (Paragraph | Table)[] = [];

  // Build content for inside the callout box
  const calloutContent: Paragraph[] = [];

  // Theme heading inside box
  calloutContent.push(
    new Paragraph({
      children: [
        new TextRun({
          text: theme.theme,
          bold: true,
          size: 24,
          color: '2563eb',
        }),
      ],
      spacing: { after: 120 },
    })
  );

  // Theme statement
  calloutContent.push(
    new Paragraph({
      children: [
        new TextRun({
          text: theme.statement,
          size: 22,
        }),
      ],
      spacing: { after: 120 },
    })
  );

  // Proof points
  if (theme.proof_points && theme.proof_points.length > 0) {
    for (const point of theme.proof_points.slice(0, 3)) {
      calloutContent.push(
        new Paragraph({
          children: [
            new TextRun({
              text: point,
              size: 22,
            }),
          ],
          bullet: { level: 0 },
          spacing: { after: 60 },
        })
      );
    }
  }

  // Wrap content in a single-cell table with borders and shading
  const calloutTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 15, color: '2563eb' },
      bottom: { style: BorderStyle.SINGLE, size: 15, color: '2563eb' },
      left: { style: BorderStyle.SINGLE, size: 15, color: '2563eb' },
      right: { style: BorderStyle.SINGLE, size: 15, color: '2563eb' },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: calloutContent,
            shading: {
              fill: 'eff6ff', // Light blue background
              type: ShadingType.CLEAR,
            },
            margins: {
              top: 200, // ~0.14 inch
              bottom: 200,
              left: 200,
              right: 200,
            },
          }),
        ],
      }),
    ],
  });

  elements.push(calloutTable);

  // Spacing after callout box
  elements.push(
    new Paragraph({
      text: '',
      spacing: { after: 240 },
    })
  );

  return elements;
}

/**
 * Extract themes for a specific section
 */
export function getThemesForSection(
  sectionName: string,
  allThemes: ValueProposition[]
): ValueProposition[] {
  const sectionKeywords = extractSectionKeywords(sectionName);

  return allThemes.filter((theme) => {
    // Check if theme is explicitly applicable to this section
    if (theme.applicable_to.some((area) =>
      sectionName.toLowerCase().includes(area.toLowerCase())
    )) {
      return true;
    }

    // Check if theme statement contains section keywords
    const statementLower = theme.statement.toLowerCase();
    return sectionKeywords.some((keyword) => statementLower.includes(keyword));
  });
}

/**
 * Extract keywords from section name for matching
 */
function extractSectionKeywords(sectionName: string): string[] {
  const name = sectionName.toLowerCase();

  const keywordMap: Record<string, string[]> = {
    technical: ['technical', 'technology', 'development', 'engineering', 'system'],
    management: ['management', 'organization', 'staffing', 'personnel', 'leadership'],
    'past performance': ['experience', 'track record', 'performance', 'delivery', 'success'],
    transition: ['transition', 'implementation', 'migration', 'onboarding'],
    quality: ['quality', 'qa', 'qc', 'testing', 'assurance'],
  };

  for (const [key, keywords] of Object.entries(keywordMap)) {
    if (name.includes(key)) {
      return keywords;
    }
  }

  return [name];
}

/**
 * Apply ghosting techniques (Framework Part 6.3)
 * Highlight strengths without naming competitors
 */
export function applyGhostingLanguage(
  text: string,
  advantages: any[]
): string {
  if (!advantages || advantages.length === 0) {
    return text;
  }

  // Look for opportunities to insert ghosting phrases
  let enhanced = text;
  let addedCount = 0;
  const maxGhosting = 2; // Limit ghosting to 1-2 per section

  for (const advantage of advantages) {
    if (addedCount >= maxGhosting) break;

    // Check if the section content is relevant to this advantage area
    const areaKeywords = advantage.area.toLowerCase().split(/\s+/);
    const hasRelevance = areaKeywords.some((keyword) =>
      enhanced.toLowerCase().includes(keyword)
    );

    if (hasRelevance) {
      // Find a good insertion point (end of paragraph or after key claim)
      // For now, append to end of relevant section
      enhanced += ` ${advantage.ghosting_phrase}`;
      addedCount++;
    }
  }

  return enhanced;
}

/**
 * Generate ghosting context for AI prompts
 */
export function getGhostingContext(advantages: any[]): string {
  if (!advantages || advantages.length === 0) {
    return '';
  }

  const context = `
GHOSTING OPPORTUNITIES (Framework Part 6.3):
Subtly incorporate these differentiators WITHOUT naming competitors.

${advantages
  .map(
    (a) => `- ${a.area}: "${a.ghosting_phrase}"
  (Use phrases like "Unlike typical approaches...", "Where contractors often face...", "Traditional methods may...")`
  )
  .join('\n')}

CRITICAL RULES:
1. NEVER name competitors explicitly
2. NEVER disparage others directly
3. DO highlight our unique strengths
4. DO use subtle contrast language
5. Focus on positive aspects of our approach
6. Let evaluators draw their own conclusions

Example patterns:
- "Unlike typical approaches, [our unique capability]..."
- "[Our advantage] eliminates risks that [new contractors/typical vendors] often face..."
- "Our [existing relationship/clearances/presence] ensures [benefit] without [common challenge]..."
`;

  return context;
}

/**
 * Create theme-based opening for sections
 */
export function createThemeOpening(
  sectionName: string,
  theme: ValueProposition
): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text: `${theme.theme}: `,
        bold: true,
        size: 22,
      }),
      new TextRun({
        text: theme.statement,
        size: 22,
      }),
    ],
    style: 'BodyText11pt',
    spacing: { after: 240 },
  });
}
