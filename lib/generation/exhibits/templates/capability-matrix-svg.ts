import type { SvgRenderResult } from '../diagram-types';
import type { ProposalColorPalette } from '../../docx/colors';

const FONT = 'Arial, sans-serif';
const ROW_H = 34;
const HEADER_H = 42;
const PAD = 16;
const NAME_W = 160;
const CELL_W = 70;

export interface CapabilityMatrixData {
  type: 'capability-matrix';
  categories: string[];
  capabilities: Array<{
    name: string;
    levels: number[]; // One per category, 0-4
  }>;
  level_labels?: string[];
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

/**
 * Draw a "level circle" — filled proportionally based on level 0-4.
 * 0 = empty ring, 1 = quarter, 2 = half, 3 = three-quarter, 4 = full
 */
function levelCircle(cx: number, cy: number, r: number, level: number, color: string): string {
  let out = '';

  // Background ring
  out += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#e2e8f0" stroke-width="1.5"/>`;

  if (level === 0) return out;

  if (level === 4) {
    out += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#${color}"/>`;
    return out;
  }

  // Partial fill using arc path
  // Angles: 1=90deg, 2=180deg, 3=270deg
  const angle = (level / 4) * 360;
  const startAngle = -90; // Start from top
  const endAngle = startAngle + angle;
  const startRad = (startAngle * Math.PI) / 180;
  const endRad = (endAngle * Math.PI) / 180;

  const x1 = cx + r * Math.cos(startRad);
  const y1 = cy + r * Math.sin(startRad);
  const x2 = cx + r * Math.cos(endRad);
  const y2 = cy + r * Math.sin(endRad);

  const largeArc = angle > 180 ? 1 : 0;

  out += `<path d="M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z" fill="#${color}"/>`;

  return out;
}

export function renderCapabilityMatrixSvg(
  data: CapabilityMatrixData,
  palette: ProposalColorPalette
): SvgRenderResult {
  try {
    const categories = data.categories || [];
    const capabilities = data.capabilities || [];

    if (categories.length === 0 || capabilities.length === 0) return placeholder('Capability Matrix');

    const primary = palette.primary || '2563eb';
    const levelLabels = data.level_labels || ['None', 'Basic', 'Intermediate', 'Advanced', 'Expert'];

    const tableW = NAME_W + categories.length * CELL_W;
    const svgW = PAD * 2 + tableW;
    const legendH = 36;
    const svgH = PAD * 2 + HEADER_H + capabilities.length * ROW_H + legendH;

    let out = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">`;
    out += `<rect width="${svgW}" height="${svgH}" fill="#ffffff"/>`;

    const gx = PAD;
    const gy = PAD;

    // Header background
    out += `<rect x="${gx}" y="${gy}" width="${tableW}" height="${HEADER_H}" fill="#${primary}" rx="4"/>`;

    // "Capability" header
    out += `<text x="${gx + NAME_W / 2}" y="${gy + HEADER_H / 2 + 5}" text-anchor="middle" font-family="${FONT}" font-size="11" font-weight="700" fill="#ffffff">Capability</text>`;

    // Category headers
    for (let i = 0; i < categories.length; i++) {
      const cx = gx + NAME_W + i * CELL_W + CELL_W / 2;
      out += `<text x="${cx}" y="${gy + HEADER_H / 2 + 5}" text-anchor="middle" font-family="${FONT}" font-size="9" font-weight="600" fill="#ffffff">${escapeXml(truncate(categories[i], 10))}</text>`;
    }

    // Data rows
    for (let r = 0; r < capabilities.length; r++) {
      const cap = capabilities[r];
      const ry = gy + HEADER_H + r * ROW_H;
      const rowBg = r % 2 === 0 ? '#f8fafc' : '#ffffff';

      out += `<rect x="${gx}" y="${ry}" width="${tableW}" height="${ROW_H}" fill="${rowBg}"/>`;
      out += `<line x1="${gx}" y1="${ry + ROW_H}" x2="${gx + tableW}" y2="${ry + ROW_H}" stroke="#e2e8f0" stroke-width="0.5"/>`;

      // Capability name
      out += `<text x="${gx + 8}" y="${ry + ROW_H / 2 + 4}" font-family="${FONT}" font-size="10" fill="#1e293b">${escapeXml(truncate(cap.name, 24))}</text>`;

      // Level circles
      for (let i = 0; i < categories.length; i++) {
        const level = Math.max(0, Math.min(4, cap.levels[i] ?? 0));
        const cx = gx + NAME_W + i * CELL_W + CELL_W / 2;
        const cy = ry + ROW_H / 2;
        out += levelCircle(cx, cy, 10, level, primary);
      }
    }

    // Outer border
    out += `<rect x="${gx}" y="${gy}" width="${tableW}" height="${HEADER_H + capabilities.length * ROW_H}" fill="none" stroke="#${palette.primaryDark || '1e40af'}" stroke-width="1.5" rx="4"/>`;

    // Legend row
    const ly = gy + HEADER_H + capabilities.length * ROW_H + 12;
    let lx = gx;
    for (let lvl = 0; lvl <= 4; lvl++) {
      out += levelCircle(lx + 10, ly + 8, 8, lvl, primary);
      const label = levelLabels[lvl] || String(lvl);
      out += `<text x="${lx + 22}" y="${ly + 12}" font-family="${FONT}" font-size="8" fill="#64748b">${escapeXml(label)}</text>`;
      lx += 80 + label.length * 2;
    }

    out += `</svg>`;
    return { svg: out, width: svgW, height: svgH };
  } catch {
    return placeholder('Capability Matrix');
  }
}

function placeholder(title: string): SvgRenderResult {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="200" viewBox="0 0 600 200">
  <rect width="600" height="200" rx="8" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1.5"/>
  <text x="300" y="105" text-anchor="middle" font-family="${FONT}" font-size="13" fill="#94a3b8">${escapeXml(title)}</text>
</svg>`;
  return { svg, width: 600, height: 200 };
}
