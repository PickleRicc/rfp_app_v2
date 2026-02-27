/**
 * Diagram Embedder for Proposal Volumes
 *
 * Generates and embeds PNG diagrams into DOCX content sections based on volume type.
 * Uses the existing Mermaid diagram infrastructure (org-chart, timeline, process-diagram).
 *
 * For 'standard' graphics profile:
 *   - Management volumes: org chart + transition timeline
 *   - Technical volumes: quality control process flow
 *   - Other volume types: no diagrams
 *
 * Each diagram is rendered to PNG, read into an ImageRun, and wrapped in a Paragraph.
 * Temp files are cleaned up after embedding.
 */

import { Paragraph, ImageRun, AlignmentType, TextRun } from 'docx';
import { readFile, unlink } from 'fs/promises';
import { generateOrgChart } from '../exhibits/org-chart';
import { generateGanttChart } from '../exhibits/timeline';
import { generateProcessDiagram, STANDARD_PROCESSES } from '../exhibits/process-diagram';

// ===== TYPES =====

/** An embedded diagram ready to insert into a DOCX section */
export interface EmbeddedDiagram {
  /** Identifier for section matching: 'org-chart' | 'timeline' | 'process-flow' */
  id: string;
  /** Display caption for the diagram */
  caption: string;
  /** DOCX Paragraph elements (image + caption) */
  elements: Paragraph[];
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

/**
 * Find the best content section index to insert a diagram based on keyword matching.
 *
 * @param diagramId - 'org-chart' | 'timeline' | 'process-flow'
 * @param sections - Content sections with titles
 * @returns Index of the best matching section, or fallback position
 */
export function findDiagramInsertionPoint(
  diagramId: string,
  sections: Array<{ title: string }>
): number {
  const keywordMap: Record<string, string[]> = {
    'org-chart': ['organizational', 'org', 'structure', 'management'],
    'timeline': ['transition', 'phase-in', 'phase in', 'timeline', 'schedule'],
    'process-flow': ['quality', 'process', 'qcp', 'control'],
  };

  const keywords = keywordMap[diagramId] || [];

  for (let i = 0; i < sections.length; i++) {
    const titleLower = sections[i].title.toLowerCase();
    if (keywords.some(kw => titleLower.includes(kw))) {
      return i;
    }
  }

  // Fallback: org-chart → first section, timeline → last, process-flow → middle
  if (diagramId === 'org-chart') return 0;
  if (diagramId === 'timeline') return Math.max(0, sections.length - 1);
  return Math.floor(sections.length / 2);
}
