import type { SvgRenderResult } from '../diagram-types';
import type { ProposalColorPalette } from '../../docx/colors';

const FONT = 'Arial, sans-serif';
const ROW_H = 32;
const HEADER_H = 38;
const PAD = 16;
const CAT_W = 160;
const COL_W = 200;

export interface ComparisonTableData {
  type: 'comparison-table';
  left_header: string;
  right_header: string;
  rows: Array<{
    category: string;
    left_value: string;
    right_value: string;
    improvement?: boolean;
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

export function renderComparisonTableSvg(
  data: ComparisonTableData,
  palette: ProposalColorPalette
): SvgRenderResult {
  try {
    const rows = data.rows || [];
    if (rows.length === 0) return placeholder('Comparison Table');

    const primary = palette.primary || '2563eb';
    const primaryLight = palette.primaryLight || 'dbeafe';
    const improvementBg = '#E8F5E9';

    const tableW = CAT_W + COL_W * 2;
    const svgW = PAD * 2 + tableW;
    const svgH = PAD * 2 + HEADER_H + rows.length * ROW_H;

    let out = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">`;
    out += `<rect width="${svgW}" height="${svgH}" fill="#ffffff"/>`;

    const gx = PAD;
    const gy = PAD;

    // Header row
    out += `<rect x="${gx}" y="${gy}" width="${tableW}" height="${HEADER_H}" fill="#${primary}" rx="4"/>`;
    out += `<text x="${gx + CAT_W / 2}" y="${gy + HEADER_H / 2 + 5}" text-anchor="middle" font-family="${FONT}" font-size="11" font-weight="700" fill="#ffffff">Category</text>`;
    out += `<text x="${gx + CAT_W + COL_W / 2}" y="${gy + HEADER_H / 2 + 5}" text-anchor="middle" font-family="${FONT}" font-size="11" font-weight="700" fill="#ffffff">${escapeXml(data.left_header)}</text>`;
    out += `<text x="${gx + CAT_W + COL_W + COL_W / 2}" y="${gy + HEADER_H / 2 + 5}" text-anchor="middle" font-family="${FONT}" font-size="11" font-weight="700" fill="#ffffff">${escapeXml(data.right_header)}</text>`;

    // Column separators in header
    out += `<line x1="${gx + CAT_W}" y1="${gy}" x2="${gx + CAT_W}" y2="${gy + HEADER_H}" stroke="rgba(255,255,255,0.3)" stroke-width="1"/>`;
    out += `<line x1="${gx + CAT_W + COL_W}" y1="${gy}" x2="${gx + CAT_W + COL_W}" y2="${gy + HEADER_H}" stroke="rgba(255,255,255,0.3)" stroke-width="1"/>`;

    // Data rows
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      const ry = gy + HEADER_H + r * ROW_H;
      const altBg = r % 2 === 0 ? '#f8fafc' : '#ffffff';

      // Category cell
      out += `<rect x="${gx}" y="${ry}" width="${CAT_W}" height="${ROW_H}" fill="${altBg}"/>`;
      out += `<text x="${gx + 8}" y="${ry + ROW_H / 2 + 4}" font-family="${FONT}" font-size="10" font-weight="600" fill="#1e293b">${escapeXml(truncate(row.category, 24))}</text>`;

      // Left value cell — primaryLight background
      out += `<rect x="${gx + CAT_W}" y="${ry}" width="${COL_W}" height="${ROW_H}" fill="#${primaryLight}"/>`;
      out += `<text x="${gx + CAT_W + 8}" y="${ry + ROW_H / 2 + 4}" font-family="${FONT}" font-size="10" fill="#1e293b">${escapeXml(truncate(row.left_value, 30))}</text>`;

      // Right value cell — green if improvement
      const rightBg = row.improvement ? improvementBg : altBg;
      out += `<rect x="${gx + CAT_W + COL_W}" y="${ry}" width="${COL_W}" height="${ROW_H}" fill="${rightBg}"/>`;
      out += `<text x="${gx + CAT_W + COL_W + 8}" y="${ry + ROW_H / 2 + 4}" font-family="${FONT}" font-size="10" fill="#1e293b">${escapeXml(truncate(row.right_value, 30))}</text>`;

      // Row separator
      out += `<line x1="${gx}" y1="${ry + ROW_H}" x2="${gx + tableW}" y2="${ry + ROW_H}" stroke="#e2e8f0" stroke-width="0.5"/>`;

      // Column separators
      out += `<line x1="${gx + CAT_W}" y1="${ry}" x2="${gx + CAT_W}" y2="${ry + ROW_H}" stroke="#e2e8f0" stroke-width="0.5"/>`;
      out += `<line x1="${gx + CAT_W + COL_W}" y1="${ry}" x2="${gx + CAT_W + COL_W}" y2="${ry + ROW_H}" stroke="#e2e8f0" stroke-width="0.5"/>`;
    }

    // Outer border
    out += `<rect x="${gx}" y="${gy}" width="${tableW}" height="${HEADER_H + rows.length * ROW_H}" fill="none" stroke="#${palette.primaryDark || '1e40af'}" stroke-width="1.5" rx="4"/>`;

    out += `</svg>`;
    return { svg: out, width: svgW, height: svgH };
  } catch {
    return placeholder('Comparison Table');
  }
}

function placeholder(title: string): SvgRenderResult {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="200" viewBox="0 0 600 200">
  <rect width="600" height="200" rx="8" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1.5"/>
  <text x="300" y="105" text-anchor="middle" font-family="${FONT}" font-size="13" fill="#94a3b8">${escapeXml(title)}</text>
</svg>`;
  return { svg, width: 600, height: 200 };
}
