import type { SvgRenderResult } from '../diagram-types';
import type { ProposalColorPalette } from '../../docx/colors';

const FONT = 'Arial, sans-serif';

export interface QuadrantChartData {
  type: 'quadrant-chart';
  x_axis_label: string;
  y_axis_label: string;
  quadrant_labels: [string, string, string, string]; // [top-left, top-right, bottom-left, bottom-right]
  items: Array<{
    label: string;
    x: number;  // 0-100
    y: number;  // 0-100
    size?: number;
  }>;
}

function escapeXml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '\u2026';
}

const QUADRANT_FILLS = [
  'rgba(37, 99, 235, 0.08)',   // top-left
  'rgba(16, 185, 129, 0.08)',  // top-right
  'rgba(245, 158, 11, 0.06)', // bottom-left
  'rgba(239, 68, 68, 0.06)',  // bottom-right
];

const ITEM_COLORS = [
  '2563eb', '0f766e', 'c2410c', '7c3aed', '0369a1', 'b91c1c',
];

export function renderQuadrantChartSvg(
  data: QuadrantChartData,
  palette: ProposalColorPalette
): SvgRenderResult {
  try {
    const items = data.items || [];
    const quadLabels = data.quadrant_labels || ['', '', '', ''];

    const primary = palette.primary || '2563eb';

    const PLOT = 400;
    const PAD_L = 60;
    const PAD_R = 20;
    const PAD_T = 20;
    const PAD_B = 50;
    const svgW = PAD_L + PLOT + PAD_R;
    const svgH = PAD_T + PLOT + PAD_B;

    const plotX = PAD_L;
    const plotY = PAD_T;
    const halfPlot = PLOT / 2;

    let out = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">`;
    out += `<rect width="${svgW}" height="${svgH}" fill="#ffffff"/>`;

    // Quadrant background fills: TL, TR, BL, BR
    out += `<rect x="${plotX}" y="${plotY}" width="${halfPlot}" height="${halfPlot}" fill="${QUADRANT_FILLS[0]}"/>`;
    out += `<rect x="${plotX + halfPlot}" y="${plotY}" width="${halfPlot}" height="${halfPlot}" fill="${QUADRANT_FILLS[1]}"/>`;
    out += `<rect x="${plotX}" y="${plotY + halfPlot}" width="${halfPlot}" height="${halfPlot}" fill="${QUADRANT_FILLS[2]}"/>`;
    out += `<rect x="${plotX + halfPlot}" y="${plotY + halfPlot}" width="${halfPlot}" height="${halfPlot}" fill="${QUADRANT_FILLS[3]}"/>`;

    // Quadrant labels
    out += `<text x="${plotX + halfPlot / 2}" y="${plotY + 18}" text-anchor="middle" font-family="${FONT}" font-size="10" fill="#94a3b8" font-style="italic">${escapeXml(quadLabels[0])}</text>`;
    out += `<text x="${plotX + halfPlot + halfPlot / 2}" y="${plotY + 18}" text-anchor="middle" font-family="${FONT}" font-size="10" fill="#94a3b8" font-style="italic">${escapeXml(quadLabels[1])}</text>`;
    out += `<text x="${plotX + halfPlot / 2}" y="${plotY + PLOT - 8}" text-anchor="middle" font-family="${FONT}" font-size="10" fill="#94a3b8" font-style="italic">${escapeXml(quadLabels[2])}</text>`;
    out += `<text x="${plotX + halfPlot + halfPlot / 2}" y="${plotY + PLOT - 8}" text-anchor="middle" font-family="${FONT}" font-size="10" fill="#94a3b8" font-style="italic">${escapeXml(quadLabels[3])}</text>`;

    // Axis lines through center
    out += `<line x1="${plotX}" y1="${plotY + halfPlot}" x2="${plotX + PLOT}" y2="${plotY + halfPlot}" stroke="#64748b" stroke-width="1.5"/>`;
    out += `<line x1="${plotX + halfPlot}" y1="${plotY}" x2="${plotX + halfPlot}" y2="${plotY + PLOT}" stroke="#64748b" stroke-width="1.5"/>`;

    // Outer border
    out += `<rect x="${plotX}" y="${plotY}" width="${PLOT}" height="${PLOT}" fill="none" stroke="#e2e8f0" stroke-width="1"/>`;

    // Items as circles with labels
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const ix = plotX + (item.x / 100) * PLOT;
      const iy = plotY + PLOT - (item.y / 100) * PLOT; // Y is inverted
      const r = item.size ? Math.max(8, Math.min(24, item.size / 4)) : 12;
      const color = ITEM_COLORS[i % ITEM_COLORS.length];

      out += `<circle cx="${ix}" cy="${iy}" r="${r}" fill="#${color}" fill-opacity="0.7" stroke="#${color}" stroke-width="1.5"/>`;
      // Label offset to avoid overlap with circle
      const labelY = iy - r - 4;
      out += `<text x="${ix}" y="${labelY}" text-anchor="middle" font-family="${FONT}" font-size="9" font-weight="600" fill="#1e293b">${escapeXml(truncate(item.label, 18))}</text>`;
    }

    // Axis labels
    out += `<text x="${plotX + halfPlot}" y="${svgH - 10}" text-anchor="middle" font-family="${FONT}" font-size="11" fill="#64748b">${escapeXml(data.x_axis_label)}</text>`;
    out += `<text transform="rotate(-90)" x="${-(plotY + halfPlot)}" y="16" text-anchor="middle" font-family="${FONT}" font-size="11" fill="#64748b">${escapeXml(data.y_axis_label)}</text>`;

    // Axis direction labels (Low/High)
    out += `<text x="${plotX}" y="${svgH - 24}" font-family="${FONT}" font-size="8" fill="#94a3b8">Low</text>`;
    out += `<text x="${plotX + PLOT}" y="${svgH - 24}" text-anchor="end" font-family="${FONT}" font-size="8" fill="#94a3b8">High</text>`;
    out += `<text x="${plotX - 8}" y="${plotY + PLOT}" text-anchor="end" font-family="${FONT}" font-size="8" fill="#94a3b8">Low</text>`;
    out += `<text x="${plotX - 8}" y="${plotY + 8}" text-anchor="end" font-family="${FONT}" font-size="8" fill="#94a3b8">High</text>`;

    out += `</svg>`;
    return { svg: out, width: svgW, height: svgH };
  } catch {
    return placeholder('Quadrant Chart');
  }
}

function placeholder(title: string): SvgRenderResult {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480" viewBox="0 0 480 480">
  <rect width="480" height="480" rx="8" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1.5"/>
  <text x="240" y="245" text-anchor="middle" font-family="${FONT}" font-size="13" fill="#94a3b8">${escapeXml(title)}</text>
</svg>`;
  return { svg, width: 480, height: 480 };
}
