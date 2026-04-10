'use client';

/**
 * DiagramPreview — renders AI-generated DiagramSpec[] as live SVG in the Draft tab.
 *
 * Uses the same SVG template functions as the server-side DOCX pipeline.
 * Templates are pure TypeScript with no Node-only APIs, so they run in the browser.
 */

import type { DiagramSpec } from '@/lib/generation/exhibits/diagram-types';
import { DEFAULT_PALETTE } from '@/lib/generation/docx/colors';
import type { ProposalColorPalette } from '@/lib/generation/docx/colors';
import { renderOrgChartSvg } from '@/lib/generation/exhibits/templates/org-chart-svg';
import { renderGanttSvg } from '@/lib/generation/exhibits/templates/gantt-svg';
import { renderProcessFlowSvg } from '@/lib/generation/exhibits/templates/process-flow-svg';
import { renderBarChartSvg } from '@/lib/generation/exhibits/templates/bar-chart-svg';
import { renderRaciMatrixSvg } from '@/lib/generation/exhibits/templates/raci-matrix-svg';
import { renderNetworkDiagramSvg } from '@/lib/generation/exhibits/templates/network-diagram-svg';
import { renderRadarChartSvg } from '@/lib/generation/exhibits/templates/radar-chart-svg';
import { renderSwimlaneSvg } from '@/lib/generation/exhibits/templates/swimlane-svg';

interface DiagramPreviewProps {
  specs: DiagramSpec[];
  /** Optional company primary hex color (without #) for branding */
  primaryColor?: string;
}

function renderSpec(spec: DiagramSpec, palette: ProposalColorPalette): string | null {
  try {
    switch (spec.type) {
      case 'org-chart':      return renderOrgChartSvg(spec.data as any, palette).svg;
      case 'gantt':          return renderGanttSvg(spec.data as any, palette).svg;
      case 'process-flow':   return renderProcessFlowSvg(spec.data as any, palette).svg;
      case 'bar-chart':      return renderBarChartSvg(spec.data as any, palette).svg;
      case 'raci-matrix':    return renderRaciMatrixSvg(spec.data as any, palette).svg;
      case 'network-diagram':return renderNetworkDiagramSvg(spec.data as any, palette).svg;
      case 'radar-chart':    return renderRadarChartSvg(spec.data as any, palette).svg;
      case 'swimlane':       return renderSwimlaneSvg(spec.data as any, palette).svg;
      default:               return null;
    }
  } catch {
    return null;
  }
}

export function DiagramPreview({ specs, primaryColor }: DiagramPreviewProps) {
  if (!specs || specs.length === 0) return null;

  const palette: ProposalColorPalette = primaryColor
    ? {
        ...DEFAULT_PALETTE,
        primary: primaryColor,
        tableHeaderBg: primaryColor,
      }
    : DEFAULT_PALETTE;

  const rendered = specs
    .map(spec => ({ spec, svg: renderSpec(spec, palette) }))
    .filter(r => r.svg !== null);

  if (rendered.length === 0) return null;

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center gap-2">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Generated Diagrams ({rendered.length})
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {rendered.map(({ spec, svg }) => (
        <div key={spec.id} className="space-y-1.5">
          <div
            className="overflow-x-auto rounded border border-border bg-white p-3"
            dangerouslySetInnerHTML={{ __html: svg! }}
          />
          <p className="text-center text-xs italic text-muted-foreground">
            {spec.title}
          </p>
        </div>
      ))}
    </div>
  );
}
