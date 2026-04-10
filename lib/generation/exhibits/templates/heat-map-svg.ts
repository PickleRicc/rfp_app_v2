import type { SvgRenderResult } from '../diagram-types';
import type { ProposalColorPalette } from '../../docx/colors';

const FONT = 'Arial, sans-serif';

export interface HeatMapData {
  type: 'heat-map';
  x_labels: string[];
  y_labels: string[];
  cells: Array<{
    x: number;
    y: number;
    value: number;
    label?: string;
  }>;
  x_axis_title?: string;
  y_axis_title?: string;
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

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace(/^#/, '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

export function renderHeatMapSvg(
  data: HeatMapData,
  palette: ProposalColorPalette
): SvgRenderResult {
  try {
    const xLabels = data.x_labels || [];
    const yLabels = data.y_labels || [];
    const cells = data.cells || [];

    if (xLabels.length === 0 || yLabels.length === 0) return placeholder('Heat Map');

    const primary = palette.primary || '2563eb';
    const rgb = hexToRgb(primary);

    const svgW = 580;
    const PAD_L = 120;
    const PAD_R = 30;
    const PAD_T = 50;
    const PAD_B = data.x_axis_title ? 50 : 30;
    const Y_TITLE_W = data.y_axis_title ? 20 : 0;

    const gridW = svgW - PAD_L - PAD_R - Y_TITLE_W;
    const cellW = Math.min(80, Math.floor(gridW / xLabels.length));
    const cellH = Math.min(40, Math.max(28, Math.floor(200 / yLabels.length)));
    const actualGridW = cellW * xLabels.length;
    const actualGridH = cellH * yLabels.length;

    const svgH = PAD_T + actualGridH + PAD_B;

    // Build a lookup map for cells
    const cellMap = new Map<string, { value: number; label?: string }>();
    for (const c of cells) {
      cellMap.set(`${c.x},${c.y}`, { value: c.value, label: c.label });
    }

    let out = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">`;
    out += `<rect width="${svgW}" height="${svgH}" fill="#ffffff"/>`;

    const gridX = PAD_L + Y_TITLE_W;
    const gridY = PAD_T;

    // X-axis labels (top)
    for (let xi = 0; xi < xLabels.length; xi++) {
      const cx = gridX + xi * cellW + cellW / 2;
      out += `<text x="${cx}" y="${gridY - 8}" text-anchor="middle" font-family="${FONT}" font-size="9" font-weight="600" fill="#1e293b">${escapeXml(truncate(xLabels[xi], 12))}</text>`;
    }

    // Y-axis labels (left)
    for (let yi = 0; yi < yLabels.length; yi++) {
      const cy = gridY + yi * cellH + cellH / 2 + 4;
      out += `<text x="${gridX - 8}" y="${cy}" text-anchor="end" font-family="${FONT}" font-size="9" font-weight="600" fill="#1e293b">${escapeXml(truncate(yLabels[yi], 16))}</text>`;
    }

    // Grid cells
    for (let yi = 0; yi < yLabels.length; yi++) {
      for (let xi = 0; xi < xLabels.length; xi++) {
        const cx = gridX + xi * cellW;
        const cy = gridY + yi * cellH;
        const entry = cellMap.get(`${xi},${yi}`);
        const value = entry?.value ?? 0;
        const opacity = Math.max(0.05, Math.min(1, value / 100));

        out += `<rect x="${cx}" y="${cy}" width="${cellW}" height="${cellH}" fill="rgba(${rgb.r},${rgb.g},${rgb.b},${opacity.toFixed(2)})" stroke="#ffffff" stroke-width="1.5"/>`;

        // Cell label or value
        const label = entry?.label ?? (value > 0 ? String(value) : '');
        if (label) {
          const textColor = opacity > 0.5 ? '#ffffff' : '#1e293b';
          out += `<text x="${cx + cellW / 2}" y="${cy + cellH / 2 + 4}" text-anchor="middle" font-family="${FONT}" font-size="9" fill="${textColor}">${escapeXml(truncate(label, 8))}</text>`;
        }
      }
    }

    // Outer border
    out += `<rect x="${gridX}" y="${gridY}" width="${actualGridW}" height="${actualGridH}" fill="none" stroke="#e2e8f0" stroke-width="1"/>`;

    // Axis titles
    if (data.x_axis_title) {
      out += `<text x="${gridX + actualGridW / 2}" y="${svgH - 10}" text-anchor="middle" font-family="${FONT}" font-size="10" fill="#64748b">${escapeXml(data.x_axis_title)}</text>`;
    }
    if (data.y_axis_title) {
      out += `<text transform="rotate(-90)" x="${-(gridY + actualGridH / 2)}" y="14" text-anchor="middle" font-family="${FONT}" font-size="10" fill="#64748b">${escapeXml(data.y_axis_title)}</text>`;
    }

    // Legend bar
    const legendW = 120;
    const legendH = 10;
    const legendX = gridX + actualGridW - legendW;
    const legendY2 = svgH - (data.x_axis_title ? 30 : 14);
    for (let i = 0; i < legendW; i++) {
      const o = (i / legendW).toFixed(2);
      out += `<rect x="${legendX + i}" y="${legendY2}" width="1" height="${legendH}" fill="rgba(${rgb.r},${rgb.g},${rgb.b},${o})"/>`;
    }
    out += `<text x="${legendX - 4}" y="${legendY2 + 8}" text-anchor="end" font-family="${FONT}" font-size="8" fill="#94a3b8">0</text>`;
    out += `<text x="${legendX + legendW + 4}" y="${legendY2 + 8}" font-family="${FONT}" font-size="8" fill="#94a3b8">100</text>`;

    out += `</svg>`;
    return { svg: out, width: svgW, height: svgH };
  } catch {
    return placeholder('Heat Map');
  }
}

function placeholder(title: string): SvgRenderResult {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="580" height="200" viewBox="0 0 580 200">
  <rect width="580" height="200" rx="8" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1.5"/>
  <text x="290" y="105" text-anchor="middle" font-family="${FONT}" font-size="13" fill="#94a3b8">${escapeXml(title)}</text>
</svg>`;
  return { svg, width: 580, height: 200 };
}
