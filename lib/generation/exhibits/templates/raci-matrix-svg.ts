import type { RaciMatrixData, SvgRenderResult } from '../diagram-types';
import type { ProposalColorPalette } from '../../docx/colors';

const FONT = 'Arial, sans-serif';
const ROW_H = 32;
const HEADER_H = 40;
const ACTIVITY_W = 200;
const CELL_W = 70;
const PAD = 16;

// RACI badge colors
const RACI_COLORS: Record<string, { bg: string; text: string }> = {
  R: { bg: '2563eb', text: 'ffffff' },
  A: { bg: '0f766e', text: 'ffffff' },
  C: { bg: 'c2410c', text: 'ffffff' },
  I:  { bg: '6d28d9', text: 'ffffff' },
};

function escapeXml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderRaciMatrixSvg(
  data: RaciMatrixData,
  palette: ProposalColorPalette
): SvgRenderResult {
  try {
    const roles = data.roles || [];
    const rows = data.rows || [];

    if (roles.length === 0 || rows.length === 0) return placeholder('RACI Matrix');

    const primary = palette.primary || '2563eb';
    const svgW = PAD * 2 + ACTIVITY_W + roles.length * CELL_W;
    const svgH = PAD * 2 + HEADER_H + rows.length * ROW_H + ROW_H; // +1 for legend row

    let out = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">`;
    out += `<rect width="${svgW}" height="${svgH}" fill="#ffffff"/>`;

    const gx = PAD;
    const gy = PAD;

    // Header background
    out += `<rect x="${gx}" y="${gy}" width="${ACTIVITY_W + roles.length * CELL_W}" height="${HEADER_H}"
      fill="#${primary}" rx="4"/>`;

    // "Activity" header
    out += `<text x="${gx + ACTIVITY_W / 2}" y="${gy + HEADER_H / 2 + 5}" text-anchor="middle"
      font-family="${FONT}" font-size="11" font-weight="700" fill="#ffffff">Activity</text>`;

    // Role headers
    for (let i = 0; i < roles.length; i++) {
      const cx = gx + ACTIVITY_W + i * CELL_W + CELL_W / 2;
      out += `<text x="${cx}" y="${gy + HEADER_H / 2 + 5}" text-anchor="middle"
        font-family="${FONT}" font-size="10" font-weight="600" fill="#ffffff">${escapeXml(roles[i])}</text>`;
    }

    // Rows
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      const ry = gy + HEADER_H + r * ROW_H;
      const rowBg = r % 2 === 0 ? '#f8fafc' : '#ffffff';

      out += `<rect x="${gx}" y="${ry}" width="${ACTIVITY_W + roles.length * CELL_W}" height="${ROW_H}"
        fill="${rowBg}"/>`;
      out += `<line x1="${gx}" y1="${ry + ROW_H}" x2="${gx + ACTIVITY_W + roles.length * CELL_W}" y2="${ry + ROW_H}"
        stroke="#e2e8f0" stroke-width="0.5"/>`;

      // Activity label
      out += `<text x="${gx + 8}" y="${ry + ROW_H / 2 + 4}"
        font-family="${FONT}" font-size="10" fill="#1e293b">${escapeXml(row.activity)}</text>`;

      // RACI cells
      for (let i = 0; i < roles.length; i++) {
        const role = roles[i];
        const val = (row.assignments?.[role] || '').toUpperCase() as 'R' | 'A' | 'C' | 'I' | '';
        if (!val) continue;
        const colors = RACI_COLORS[val] || { bg: 'e2e8f0', text: '1e293b' };
        const cx = gx + ACTIVITY_W + i * CELL_W + CELL_W / 2;
        const cy = ry + ROW_H / 2;
        out += `<circle cx="${cx}" cy="${cy}" r="12" fill="#${colors.bg}"/>`;
        out += `<text x="${cx}" y="${cy + 4}" text-anchor="middle"
          font-family="${FONT}" font-size="11" font-weight="700" fill="#${colors.text}">${val}</text>`;
      }
    }

    // Outer border
    out += `<rect x="${gx}" y="${gy}" width="${ACTIVITY_W + roles.length * CELL_W}" height="${HEADER_H + rows.length * ROW_H}"
      fill="none" stroke="#${palette.primaryDark || '1e40af'}" stroke-width="1.5" rx="4"/>`;

    // Legend row
    const ly = gy + HEADER_H + rows.length * ROW_H + 10;
    const legendItems = [
      { val: 'R', label: 'Responsible' },
      { val: 'A', label: 'Accountable' },
      { val: 'C', label: 'Consulted' },
      { val: 'I', label: 'Informed' },
    ];
    let lx = gx;
    for (const item of legendItems) {
      const colors = RACI_COLORS[item.val];
      out += `<circle cx="${lx + 10}" cy="${ly + 8}" r="8" fill="#${colors.bg}"/>`;
      out += `<text x="${lx + 10}" y="${ly + 12}" text-anchor="middle"
        font-family="${FONT}" font-size="8" font-weight="700" fill="#${colors.text}">${item.val}</text>`;
      out += `<text x="${lx + 22}" y="${ly + 12}"
        font-family="${FONT}" font-size="9" fill="#64748b">${item.label}</text>`;
      lx += 95;
    }

    out += `</svg>`;
    return { svg: out, width: svgW, height: svgH };
  } catch {
    return placeholder('RACI Matrix');
  }
}

function placeholder(title: string): SvgRenderResult {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="200" viewBox="0 0 600 200">
  <rect width="600" height="200" rx="8" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1.5"/>
  <text x="300" y="105" text-anchor="middle" font-family="${FONT}" font-size="13" fill="#94a3b8">${escapeXml(title)}</text>
</svg>`;
  return { svg, width: 600, height: 200 };
}
