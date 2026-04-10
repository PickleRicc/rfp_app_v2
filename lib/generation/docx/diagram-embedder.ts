/**
 * Diagram Embedder for Proposal Volumes
 *
 * Two paths:
 *
 * NEW (AI-generated SVG) — use embedAiDiagrams():
 *   Accepts DiagramSpec[] from diagram-spec-generator, renders via SVG templates,
 *   embeds as native SVG ImageRun in DOCX. No Chromium. No CLI. Works on Vercel.
 *
 * LEGACY (Mermaid/PNG) — generateVolumeDiagrams() is kept for rollback purposes only.
 *   Uses Mermaid CLI + Puppeteer → PNG. Silently fails on Vercel serverless.
 *   Will be removed after 2-sprint stability window.
 */

import { Paragraph, ImageRun, AlignmentType, TextRun, HeadingLevel } from 'docx';
import { readFile, unlink } from 'fs/promises';
import { generateOrgChart } from '../exhibits/org-chart';
import { generateGanttChart } from '../exhibits/timeline';
import { generateProcessDiagram, STANDARD_PROCESSES } from '../exhibits/process-diagram';
import type { DiagramSpec } from '../exhibits/diagram-types';
import { renderDiagramToEmbeddedDocx } from '../exhibits/diagram-renderer';
import type { ProposalColorPalette } from './colors';

// ===== TYPES =====

/** An embedded diagram ready to insert into a DOCX section */
export interface EmbeddedDiagram {
  /** Identifier for section matching: 'org-chart' | 'timeline' | 'process-flow' */
  id: string;
  /** Display caption for the diagram */
  caption: string;
  /** DOCX Paragraph elements (image + caption) */
  elements: Paragraph[];
  /** Placement hints from the diagram spec — used for section keyword matching */
  placement?: {
    sectionKeywords: string[];
    position?: 'start' | 'end';
  };
}

// ===== HELPERS =====

/**
 * Read a PNG file into an ImageRun, wrapped in a centered Paragraph with caption.
 * Cleans up the temp file after reading.
 */
async function embedPngAsDocxElements(
  pngPath: string,
  caption: string
): Promise<Paragraph[]> {
  const imageData = await readFile(pngPath);

  // Clean up temp file
  try { await unlink(pngPath); } catch { /* ignore */ }

  const elements: Paragraph[] = [];

  // Image paragraph (centered)
  elements.push(
    new Paragraph({
      children: [
        new ImageRun({
          data: imageData,
          transformation: { width: 600, height: 350 },
          type: 'png',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 240, after: 120 },
    })
  );

  // Caption paragraph
  elements.push(
    new Paragraph({
      children: [
        new TextRun({
          text: caption,
          italics: true,
          size: 20, // 10pt
          font: 'Arial',
          color: '64748b', // slate-500
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 360 },
    })
  );

  return elements;
}

// ===== PUBLIC API =====

/**
 * Generate diagrams appropriate for a given volume type.
 * Returns an array of EmbeddedDiagram objects ready to insert into content sections.
 *
 * @param volumeType - Canonical volume type ('technical', 'management', etc.)
 * @param personnel - Tier 1 personnel records (used for org chart)
 * @param companyName - Company name (used as org chart root)
 * @returns Array of embedded diagrams (empty on failure or unsupported volume type)
 */
export async function generateVolumeDiagrams(
  volumeType: string,
  personnel: any[],
  companyName: string
): Promise<EmbeddedDiagram[]> {
  const diagrams: EmbeddedDiagram[] = [];

  try {
    if (volumeType === 'management') {
      // Generate org chart and timeline in parallel
      const [orgChartPath, timelinePath] = await Promise.all([
        generateOrgChart(personnel, companyName).catch(() => null),
        generateGanttChart([], 'Transition Timeline').catch(() => null),
      ]);

      if (orgChartPath) {
        const elements = await embedPngAsDocxElements(
          orgChartPath,
          'Figure: Organizational Structure'
        );
        diagrams.push({ id: 'org-chart', caption: 'Organizational Structure', elements });
      }

      if (timelinePath) {
        const elements = await embedPngAsDocxElements(
          timelinePath,
          'Figure: Transition Timeline'
        );
        diagrams.push({ id: 'timeline', caption: 'Transition Timeline', elements });
      }
    } else if (volumeType === 'technical') {
      // Generate quality control process flow
      const processPath = await generateProcessDiagram(
        STANDARD_PROCESSES.qualityControl.name,
        STANDARD_PROCESSES.qualityControl.steps
      ).catch(() => null);

      if (processPath) {
        const elements = await embedPngAsDocxElements(
          processPath,
          'Figure: Quality Control Process'
        );
        diagrams.push({ id: 'process-flow', caption: 'Quality Control Process', elements });
      }
    }
  } catch (error) {
    console.warn('[diagram-embedder] Diagram generation failed:', error);
    // Non-fatal — return empty array, volume generates without diagrams
  }

  return diagrams;
}

// ===== CONTENT-AWARE PLACEMENT ENGINE =====

// Static keyword map per diagram type
const DIAGRAM_TYPE_KEYWORDS: Record<string, string[]> = {
  'org-chart': ['organizational', 'org', 'structure', 'management', 'personnel', 'staffing', 'team'],
  'gantt': ['transition', 'timeline', 'schedule', 'phase', 'plan', 'period'],
  'process-flow': ['process', 'workflow', 'approach', 'methodology', 'quality', 'procedure'],
  'bar-chart': ['performance', 'metrics', 'staffing', 'comparison', 'data', 'statistics'],
  'raci-matrix': ['responsibility', 'raci', 'roles', 'assignment', 'accountability', 'personnel'],
  'network-diagram': ['architecture', 'network', 'infrastructure', 'system', 'technology', 'topology'],
  'radar-chart': ['capability', 'strength', 'evaluation', 'criteria', 'assessment'],
  'swimlane': ['process', 'workflow', 'coordination', 'integration', 'collaboration'],
  'data-table': ['staffing', 'labor', 'basis of estimate', 'boe', 'rate', 'pricing', 'table'],
  'comparison-table': ['comparison', 'current state', 'proposed', 'requirement', 'capability'],
  'milestone-timeline': ['milestone', 'key dates', 'deliverable', 'phase', 'schedule', 'timeline'],
  'heat-map': ['risk', 'impact', 'coverage', 'intensity', 'matrix'],
  'quadrant-chart': ['priority', 'effort', 'impact', 'analysis', 'quadrant'],
  'capability-matrix': ['capability', 'skill', 'competency', 'assessment', 'proficiency'],
};

/**
 * Build a complete keyword list from all available sources.
 */
function buildKeywordList(keywords: string[], diagramId: string): string[] {
  const all: string[] = [...(keywords || [])];

  // Add type-based keywords
  for (const [typeKey, typeKeywords] of Object.entries(DIAGRAM_TYPE_KEYWORDS)) {
    const idLower = diagramId.toLowerCase();
    if (idLower.includes(typeKey.replace(/-/g, '_')) || idLower.includes(typeKey)) {
      all.push(...typeKeywords);
      break;
    }
  }

  // Add tokens from diagram ID
  const idTokens = diagramId.toLowerCase().split(/[_\-]/).filter(t => t.length > 3);
  all.push(...idTokens);

  return [...new Set(all.map(k => k.toLowerCase()))].filter(k => k.length > 0);
}

/**
 * Score how well a set of keywords matches a section.
 * Searches H1 title, all H2/H3/H4 subsection headings, and body paragraph text.
 *
 * Returns the best content index for inserting the diagram — AFTER the most
 * relevant subsection heading, not just appended at the end.
 */
function scoreSectionForDiagram(
  section: { title: string; content?: unknown[] },
  kwLower: string[]
): { score: number; bestContentIdx: number } {
  if (kwLower.length === 0) return { score: 0, bestContentIdx: (section.content || []).length };

  const content = (section.content || []) as Paragraph[];
  let score = 0;

  // Score the H1 title (weight 3x — strong signal)
  const titleLower = section.title.toLowerCase();
  score += kwLower.filter(kw => titleLower.includes(kw)).length * 3;

  // Scan content for subsection headings and body text
  let bestSubIdx = content.length; // Default: end of section
  let bestSubScore = -1;
  let currentSubStart = 0;
  let currentSubScore = 0;

  for (let i = 0; i < content.length; i++) {
    const el = content[i];
    if (!(el instanceof Paragraph)) continue;

    // Try to extract text from this paragraph
    let text = '';
    try {
      const json = JSON.stringify((el as unknown as Record<string, unknown>).root || '').toLowerCase();
      text = json.replace(/<[^>]*>/g, ' ').replace(/[{}"\[\]]/g, ' ');
    } catch { continue; }

    if (!text || text.length < 3) continue;

    // Check if this is a heading paragraph (H2/H3/H4)
    const isHeading = text.includes('heading_2') || text.includes('heading_3') || text.includes('heading_4')
      || text.includes('headinglevel');

    if (isHeading) {
      // Finalize previous subsection
      if (currentSubScore > bestSubScore) {
        bestSubScore = currentSubScore;
        bestSubIdx = i; // Insert BEFORE this new heading = AFTER previous subsection
      }
      currentSubStart = i;
      currentSubScore = kwLower.filter(kw => text.includes(kw)).length * 2; // heading weight 2x
      score += Math.min(currentSubScore, 4); // Cap per-heading contribution
    } else {
      // Body text (weight 1x, capped)
      const bodyMatches = kwLower.filter(kw => text.includes(kw)).length;
      currentSubScore += Math.min(bodyMatches, 2);
      score += Math.min(bodyMatches, 1);
    }
  }

  // Finalize last subsection
  if (currentSubScore > bestSubScore) {
    bestSubScore = currentSubScore;
    bestSubIdx = content.length; // After last content
  }

  // If we found a subsection match, find the END of that subsection (next heading or end)
  if (bestSubScore > 0 && bestSubIdx < content.length) {
    // Walk forward to find end of the matching subsection
    for (let i = bestSubIdx + 1; i < content.length; i++) {
      const el = content[i];
      if (!(el instanceof Paragraph)) continue;
      try {
        const json = JSON.stringify((el as unknown as Record<string, unknown>).root || '').toLowerCase();
        if (json.includes('heading_2') || json.includes('heading_3')) {
          bestSubIdx = i; // Insert before the NEXT heading
          break;
        }
      } catch { continue; }
      if (i === content.length - 1) bestSubIdx = content.length;
    }
  }

  return { score, bestContentIdx: bestSubIdx };
}

/**
 * Find the best section AND subsection position for a diagram.
 *
 * Content-aware: scores ALL sections by matching keywords against
 * H1 title + H2/H3/H4 headings + body text. Returns the section
 * with the highest relevance score.
 *
 * @param keywords - Keywords from spec.placement.sectionKeywords
 * @param diagramId - Diagram identifier
 * @param sections - Content sections with titles and content arrays
 * @returns Index of the best matching section
 */
export function findDiagramInsertionPoint(
  keywords: string[],
  diagramId: string,
  sections: Array<{ title: string; content?: unknown[] }>
): number {
  if (sections.length === 0) return 0;

  const kwLower = buildKeywordList(keywords, diagramId);

  // Score every section
  let bestIdx = 0;
  let bestScore = -1;

  for (let i = 0; i < sections.length; i++) {
    const { score } = scoreSectionForDiagram(sections[i], kwLower);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }

  // If no matches at all, use heuristic fallbacks
  if (bestScore <= 0) {
    const idLower = diagramId.toLowerCase();
    if (idLower.includes('org')) return 0;
    if (idLower.includes('timeline') || idLower.includes('gantt')) return Math.max(0, sections.length - 1);
    return Math.floor(sections.length / 2);
  }

  return bestIdx;
}

/**
 * Find the precise content index within a section to insert a diagram.
 * Places the diagram AFTER the most relevant subsection — not at the end.
 *
 * Call this after findDiagramInsertionPoint to get subsection-level precision.
 */
export function findContentInsertionIndex(
  section: { title: string; content?: unknown[] },
  keywords: string[],
  diagramId: string
): number {
  const kwLower = buildKeywordList(keywords, diagramId);
  const { bestContentIdx } = scoreSectionForDiagram(section, kwLower);
  return bestContentIdx;
}

// ===== AI DIAGRAM EMBEDDING (NEW) =====

/**
 * Render and embed a list of AI-generated DiagramSpecs into DOCX elements.
 * Replaces generateVolumeDiagrams() for graphicsProfile='standard'.
 *
 * Uses SVG template functions — no Chromium, no CLI, works on Vercel serverless.
 *
 * @param specs - DiagramSpec[] from generateDiagramSpecs()
 * @param palette - Company color palette for branding
 * @returns Array of EmbeddedDiagram ready to insert (empty array on complete failure)
 */
export async function embedAiDiagrams(
  specs: DiagramSpec[],
  palette: ProposalColorPalette
): Promise<EmbeddedDiagram[]> {
  if (!specs || specs.length === 0) return [];

  const results: EmbeddedDiagram[] = [];

  const failed: string[] = [];

  for (const spec of specs) {
    try {
      const embedded = renderDiagramToEmbeddedDocx(spec, palette);
      if (embedded) {
        results.push(embedded);
      } else {
        failed.push(`"${spec.title}" (${spec.type})`);
      }
    } catch (err) {
      failed.push(`"${spec.title}" (${spec.type})`);
      console.error(`[diagram-embedder] Render failed for "${spec.title}" (${spec.type}, id=${spec.id}):`, err);
    }
  }

  if (failed.length > 0) {
    console.error(`[diagram-embedder] ${failed.length} diagram(s) FAILED to render: ${failed.join(', ')}`);
  }
  console.log(`[diagram-embedder] Rendered ${results.length}/${specs.length} diagrams successfully`);
  return results;
}
