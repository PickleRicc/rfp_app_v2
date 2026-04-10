import type { SvgRenderResult } from '../diagram-types';
import type { ProposalColorPalette } from '../../docx/colors';

const FONT = 'Arial, sans-serif';
const SVG_W = 580;
const HEADER_H = 32;
const ROW_H = 28;
const PAD = 0; // outer padding is baked into viewBox

export interface DataTableData {
  type: 'data-table';
  /** Column headers */
  headers: string[];
  rows: Array<{
    /** Values — must match headers length */
    cells: string[];
    /** Optional: highlight this row (e.g., total row, divergence) */
    highlight?: boolean;
  }>;
  /** Optional sub-caption below title */
  caption?: string;
  /** Optional: relative column widths (must sum to ~100) */
  column_widths?: number[];
}

function escapeXml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Resolve pixel column widths from optional relative weights */
function resolveColWidths(headers: string[], column_widths?: number[]): number[] {
  const n = headers.length;
  if (!n) return [];

  if (column_widths && column_widths.length === n) {
    const total = column_widths.reduce((a, b) => a + b, 0);
    return column_widths.map(w => Math.round((w / total) * SVG_W));
  }

  // Equal distribution
  const base = Math.floor(SVG_W / n);
  const remainder = SVG_W - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < remainder ? 1 : 0));
}

export function renderDataTableSvg(
  data: DataTableData,
  palette: ProposalColorPalette
): SvgRenderResult {
  try {
    const headers = data.headers || [];
    const rows = data.rows || [];

    if (headers.length === 0 || rows.length === 0) return placeholder('Data Table');

    const primary = palette.primary || '2563eb';
    const primaryDark = palette.primaryDark || '1e40af';
    // Derive a very light tint: use primaryLight from palette if present, else a fixed slate
    const primaryLight = (palette as any).primaryLight || 'f1f5f9';

    const colWidths = resolveColWidths(headers, data.column_widths);
    const captionH = data.caption ? 20 : 0;
    const svgH = HEADER_H + rows.length * ROW_H + captionH + 2; // +2 for bottom border bleed

    let out = `<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_W}" height="${svgH}" viewBox="0 0 ${SVG_W} ${svgH}">`;
    out += `<rect width="${SVG_W}" height="${svgH}" fill="#ffffff"/>`;

    // ---- Header row ----
    out += `<rect x="0" y="0" width="${SVG_W}" height="${HEADER_H}" fill="#${primary}" rx="4"/>`;
    // Cover bottom-left / bottom-right rounded corners so they're square at the bottom
    out += `<rect x="0" y="${HEADER_H - 4}" width="${SVG_W}" height="4" fill="#${primary}"/>`;

    let cx = 0;
    for (let i = 0; i < headers.length; i++) {
      const cw = colWidths[i];
      const textX = cx + cw / 2;
      out += `<text x="${textX}" y="${HEADER_H / 2 + 4}" text-anchor="middle"
        font-family="${FONT}" font-size="11" font-weight="700" fill="#ffffff">${escapeXml(headers[i])}</text>`;
      cx += cw;
    }

    // ---- Data rows ----
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      const ry = HEADER_H + r * ROW_H;

      let rowBg: string;
      if (row.highlight) {
        rowBg = '#FFF8E1';
      } else {
        rowBg = r % 2 === 0 ? '#ffffff' : `#${primaryLight}`;
      }

      out += `<rect x="0" y="${ry}" width="${SVG_W}" height="${ROW_H}" fill="${rowBg}"/>`;

      // Highlight: left accent border
      if (row.highlight) {
        // Amber accent — no secondary on palette, use a fixed amber that works with any primary
        out += `<rect x="0" y="${ry}" width="3" height="${ROW_H}" fill="#f59e0b"/>`;
      }

      // Bottom rule
      out += `<line x1="0" y1="${ry + ROW_H}" x2="${SVG_W}" y2="${ry + ROW_H}"
        stroke="#${primaryDark}" stroke-width="0.5" opacity="0.3"/>`;

      // Cell text + vertical column dividers
      let cellX = 0;
      for (let i = 0; i < headers.length; i++) {
        const cw = colWidths[i];
        const cellVal = row.cells[i] ?? '';
        const textX = cellX + 8; // left-align with 8px padding
        const textY = ry + ROW_H / 2 + 4;

        out += `<text x="${textX}" y="${textY}"
          font-family="${FONT}" font-size="10" fill="#1e293b">${escapeXml(cellVal)}</text>`;

        // Vertical divider (not before first column)
        if (i > 0) {
          out += `<line x1="${cellX}" y1="${HEADER_H}" x2="${cellX}" y2="${HEADER_H + rows.length * ROW_H}"
            stroke="#${primaryDark}" stroke-width="0.5" opacity="0.3"/>`;
        }

        cellX += cw;
      }
    }

    // ---- Outer border ----
    const tableH = HEADER_H + rows.length * ROW_H;
    out += `<rect x="0" y="0" width="${SVG_W}" height="${tableH}"
      fill="none" stroke="#${primaryDark}" stroke-width="1.5" rx="4"/>`;

    // ---- Caption ----
    if (data.caption) {
      const capY = tableH + 14;
      out += `<text x="${SVG_W / 2}" y="${capY}" text-anchor="middle"
        font-family="${FONT}" font-size="9" font-style="italic" fill="#64748b">${escapeXml(data.caption)}</text>`;
    }

    out += `</svg>`;
    return { svg: out, width: SVG_W, height: svgH };
  } catch {
    return placeholder('Data Table');
  }
}

function placeholder(title: string): SvgRenderResult {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="200" viewBox="0 0 600 200">
  <rect width="600" height="200" rx="8" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1.5"/>
  <text x="300" y="105" text-anchor="middle" font-family="${FONT}" font-size="13" fill="#94a3b8">${escapeXml(title)}</text>
</svg>`;
  return { svg, width: 600, height: 200 };
}
