/**
 * Diagram Renderer — SVG template dispatcher
 *
 * Routes a DiagramSpec to the correct TypeScript SVG template function
 * and converts the result into an EmbeddedDiagram (docx ImageRun + caption Paragraph).
 *
 * No external dependencies. No Chromium. No CLI processes.
 * SVG embeds natively via docx ImageRun type: 'svg'.
 */

import { Paragraph, ImageRun, AlignmentType, TextRun } from 'docx';
import type { DiagramSpec, SvgRenderResult } from './diagram-types';
import type { ProposalColorPalette } from '../docx/colors';
import type { EmbeddedDiagram } from '../docx/diagram-embedder';

import { renderOrgChartSvg } from './templates/org-chart-svg';
import { renderGanttSvg } from './templates/gantt-svg';
import { renderProcessFlowSvg } from './templates/process-flow-svg';
import { renderBarChartSvg } from './templates/bar-chart-svg';
import { renderRaciMatrixSvg } from './templates/raci-matrix-svg';
import { renderNetworkDiagramSvg } from './templates/network-diagram-svg';
import { renderRadarChartSvg } from './templates/radar-chart-svg';
import { renderSwimlaneSvg } from './templates/swimlane-svg';
import { renderDataTableSvg } from './templates/data-table-svg';
import { renderComparisonTableSvg } from './templates/comparison-table-svg';
import { renderMilestoneTimelineSvg } from './templates/milestone-timeline-svg';
import { renderHeatMapSvg } from './templates/heat-map-svg';
import { renderQuadrantChartSvg } from './templates/quadrant-chart-svg';
import { renderCapabilityMatrixSvg } from './templates/capability-matrix-svg';

// ===== FALLBACK PNG =====
// 1×1 transparent PNG — satisfies docx SvgMediaOptions `fallback` type requirement.
// Modern Word (2016+) renders SVG directly and ignores this fallback entirely.
const FALLBACK_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);

// ===== DISPATCHER =====

/**
 * Render a DiagramSpec to an EmbeddedDiagram containing docx Paragraph elements.
 * Returns null on any rendering failure — callers skip null entries silently.
 */
export function renderDiagramToEmbeddedDocx(
  spec: DiagramSpec,
  palette: ProposalColorPalette
): EmbeddedDiagram | null {
  try {
    const result = dispatchRender(spec, palette);
    if (!result || !result.svg) return null;

    const elements = svgToDocxParagraphs(result, spec.title);
    return {
      id: spec.id,
      caption: spec.title,
      elements,
      placement: spec.placement,
    };
  } catch (err) {
    console.error(`[diagram-renderer] Failed to render diagram "${spec.id}" (${spec.type}):`, err);
    return null;
  }
}

/** Validate that a field exists and is a non-empty array */
function hasArray(obj: any, field: string): boolean {
  return obj && Array.isArray(obj[field]) && obj[field].length > 0;
}

function dispatchRender(
  spec: DiagramSpec,
  palette: ProposalColorPalette
): SvgRenderResult | null {
  const d = spec.data as any;
  const tag = `[diagram-renderer]`;

  switch (spec.type) {
    case 'org-chart': {
      if (!hasArray(d, 'nodes')) {
        console.error(`${tag} Invalid org-chart data: missing nodes array`, { id: spec.id });
        return null;
      }
      return renderOrgChartSvg(d, palette);
    }
    case 'gantt': {
      if (!hasArray(d, 'phases')) {
        console.error(`${tag} Invalid gantt data: missing phases array`, { id: spec.id });
        return null;
      }
      return renderGanttSvg(d, palette);
    }
    case 'process-flow': {
      if (!hasArray(d, 'nodes')) {
        console.error(`${tag} Invalid process-flow data: missing nodes array`, { id: spec.id });
        return null;
      }
      return renderProcessFlowSvg(d, palette);
    }
    case 'bar-chart': {
      if (!hasArray(d, 'series')) {
        console.error(`${tag} Invalid bar-chart data: missing series array`, { id: spec.id });
        return null;
      }
      return renderBarChartSvg(d, palette);
    }
    case 'raci-matrix': {
      if (!hasArray(d, 'roles') || !hasArray(d, 'rows')) {
        console.error(`${tag} Invalid raci-matrix data: missing roles or rows array`, { id: spec.id });
        return null;
      }
      return renderRaciMatrixSvg(d, palette);
    }
    case 'network-diagram': {
      if (!hasArray(d, 'nodes')) {
        console.error(`${tag} Invalid network-diagram data: missing nodes array`, { id: spec.id });
        return null;
      }
      return renderNetworkDiagramSvg(d, palette);
    }
    case 'radar-chart': {
      if (!hasArray(d, 'series') || !hasArray(d, 'axes')) {
        console.error(`${tag} Invalid radar-chart data: missing series or axes array`, { id: spec.id });
        return null;
      }
      return renderRadarChartSvg(d, palette);
    }
    case 'swimlane': {
      if (!hasArray(d, 'lanes') || !hasArray(d, 'steps')) {
        console.error(`${tag} Invalid swimlane data: missing lanes or steps array`, { id: spec.id });
        return null;
      }
      return renderSwimlaneSvg(d, palette);
    }
    case 'data-table': {
      if (!hasArray(d, 'headers') || !hasArray(d, 'rows')) {
        console.error(`${tag} Invalid data-table data: missing headers or rows array`, { id: spec.id });
        return null;
      }
      return renderDataTableSvg(d, palette);
    }
    case 'comparison-table': {
      if (!hasArray(d, 'rows')) {
        console.error(`${tag} Invalid comparison-table data: missing rows array`, { id: spec.id });
        return null;
      }
      return renderComparisonTableSvg(d, palette);
    }
    case 'milestone-timeline': {
      if (!hasArray(d, 'milestones')) {
        console.error(`${tag} Invalid milestone-timeline data: missing milestones array`, { id: spec.id });
        return null;
      }
      return renderMilestoneTimelineSvg(d, palette);
    }
    case 'heat-map': {
      if (!hasArray(d, 'x_labels') || !hasArray(d, 'y_labels') || !hasArray(d, 'cells')) {
        console.error(`${tag} Invalid heat-map data: missing x_labels, y_labels, or cells array`, { id: spec.id });
        return null;
      }
      return renderHeatMapSvg(d, palette);
    }
    case 'quadrant-chart': {
      if (!hasArray(d, 'items')) {
        console.error(`${tag} Invalid quadrant-chart data: missing items array`, { id: spec.id });
        return null;
      }
      return renderQuadrantChartSvg(d, palette);
    }
    case 'capability-matrix': {
      if (!hasArray(d, 'categories') || !hasArray(d, 'capabilities')) {
        console.error(`${tag} Invalid capability-matrix data: missing categories or capabilities array`, { id: spec.id });
        return null;
      }
      return renderCapabilityMatrixSvg(d, palette);
    }
    default:
      console.warn(`${tag} Unknown diagram type: ${(spec as any).type}`);
      return null;
  }
}

// ===== SVG → DOCX ELEMENTS =====

function svgToDocxParagraphs(
  result: SvgRenderResult,
  caption: string
): Paragraph[] {
  const svgBuffer = Buffer.from(result.svg, 'utf-8');

  // Safe DOCX text width for letter paper with 1-inch margins ≈ 540px
  const MAX_WIDTH = 540;
  const scale = result.width > MAX_WIDTH ? MAX_WIDTH / result.width : 1;
  const displayWidth = Math.round(result.width * scale);
  const displayHeight = Math.round(result.height * scale);

  const elements: Paragraph[] = [];

  // Image paragraph — centered, with spacing
  elements.push(
    new Paragraph({
      children: [
        new ImageRun({
          data: svgBuffer,
          transformation: {
            width: displayWidth,
            height: displayHeight,
          },
          type: 'svg',
          fallback: {
            data: FALLBACK_PNG,
            transformation: { width: 1, height: 1 },
          },
        } as any), // docx SvgMediaOptions type — cast needed for some TS versions
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 200 },
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
          color: '64748b',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 80, after: 240 },
    })
  );

  return elements;
}
