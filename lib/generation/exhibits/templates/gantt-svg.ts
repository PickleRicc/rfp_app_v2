import type { GanttData, SvgRenderResult } from '../diagram-types';
import type { ProposalColorPalette } from '../../docx/colors';

const FONT = 'Arial, sans-serif';
const ROW_H = 36;
const HEADER_H = 40;
const LABEL_W = 160;
const COL_W = 80;
const PAD = 20;

function escapeXml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderGanttSvg(
  data: GanttData,
  palette: ProposalColorPalette
): SvgRenderResult {
  try {
    const headers = data.headers || [];
    const phases = data.phases || [];
    const periodCols = Math.max(headers.length - 1, 1);

    const svgW = PAD * 2 + LABEL_W + periodCols * COL_W;
    const svgH = PAD * 2 + HEADER_H + phases.length * ROW_H;

    const primary = palette.primary || '2563eb';
    const light = palette.primaryNodeFill || 'dbeafe';
    const dark = palette.primaryDark || '1e40af';

    let out = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">`;
    out += `<rect width="${svgW}" height="${svgH}" fill="#ffffff"/>`;

    const gx = PAD;
    const gy = PAD;

    // Header background
    out += `<rect x="${gx}" y="${gy}" width="${LABEL_W + periodCols * COL_W}" height="${HEADER_H}"
      fill="#${primary}" rx="4"/>`;

    // Label column header
    out += `<text x="${gx + LABEL_W / 2}" y="${gy + HEADER_H / 2 + 5}" text-anchor="middle"
      font-family="${FONT}" font-size="11" font-weight="700" fill="#ffffff">${escapeXml(headers[0] || 'Phase')}</text>`;

    // Period column headers
    for (let i = 0; i < periodCols; i++) {
      const cx = gx + LABEL_W + i * COL_W + COL_W / 2;
      out += `<text x="${cx}" y="${gy + HEADER_H / 2 + 5}" text-anchor="middle"
        font-family="${FONT}" font-size="10" font-weight="600" fill="#ffffff">${escapeXml(headers[i + 1] || `P${i + 1}`)}</text>`;
    }

    // Column grid lines
    for (let i = 0; i <= periodCols; i++) {
      const lx = gx + LABEL_W + i * COL_W;
      out += `<line x1="${lx}" y1="${gy + HEADER_H}" x2="${lx}" y2="${gy + HEADER_H + phases.length * ROW_H}"
        stroke="#e2e8f0" stroke-width="1"/>`;
    }

    // Rows
    for (let r = 0; r < phases.length; r++) {
      const phase = phases[r];
      const ry = gy + HEADER_H + r * ROW_H;
      const rowBg = r % 2 === 0 ? '#f8fafc' : '#ffffff';

      out += `<rect x="${gx}" y="${ry}" width="${LABEL_W + periodCols * COL_W}" height="${ROW_H}"
        fill="${rowBg}"/>`;
      out += `<line x1="${gx}" y1="${ry + ROW_H}" x2="${gx + LABEL_W + periodCols * COL_W}" y2="${ry + ROW_H}"
        stroke="#e2e8f0" stroke-width="0.5"/>`;

      // Row label
      out += `<text x="${gx + 8}" y="${ry + ROW_H / 2 + 4}" font-family="${FONT}" font-size="10.5"
        fill="#1e293b">${escapeXml(phase.name)}</text>`;

      const startCol = Math.max(0, phase.startCol || 0);
      const dur = Math.max(1, phase.durationCols || 1);

      if (phase.milestone) {
        // Diamond milestone
        const mx = gx + LABEL_W + startCol * COL_W + COL_W / 2;
        const my = ry + ROW_H / 2;
        const ms = 10;
        out += `<polygon points="${mx},${my - ms} ${mx + ms},${my} ${mx},${my + ms} ${mx - ms},${my}"
          fill="#${primary}" stroke="#${dark}" stroke-width="1.5"/>`;
      } else {
        // Bar
        const bx = gx + LABEL_W + startCol * COL_W + 2;
        const bw = dur * COL_W - 4;
        const by = ry + 7;
        const bh = ROW_H - 14;
        out += `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}"
          rx="3" fill="#${light}" stroke="#${primary}" stroke-width="1.5"/>`;
      }
    }

    // Outer border
    out += `<rect x="${gx}" y="${gy}" width="${LABEL_W + periodCols * COL_W}" height="${HEADER_H + phases.length * ROW_H}"
      fill="none" stroke="#${dark}" stroke-width="1.5" rx="4"/>`;

    out += `</svg>`;
    return { svg: out, width: svgW, height: svgH };
  } catch {
    return placeholder('Gantt Timeline');
  }
}

function placeholder(title: string): SvgRenderResult {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="760" height="200" viewBox="0 0 760 200">
  <rect width="760" height="200" rx="8" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1.5"/>
  <text x="380" y="105" text-anchor="middle" font-family="${FONT}" font-size="13" fill="#94a3b8">${escapeXml(title)}</text>
</svg>`;
  return { svg, width: 760, height: 200 };
}
