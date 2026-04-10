import type { SvgRenderResult } from '../diagram-types';
import type { ProposalColorPalette } from '../../docx/colors';

const FONT = 'Arial, sans-serif';

export interface MilestoneTimelineData {
  type: 'milestone-timeline';
  milestones: Array<{
    label: string;
    date: string;
    description?: string;
    category?: 'phase' | 'deliverable' | 'review' | 'milestone';
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

const CATEGORY_COLORS: Record<string, string> = {
  phase: '2563eb',
  deliverable: '0f766e',
  review: 'c2410c',
  milestone: '7c3aed',
};

export function renderMilestoneTimelineSvg(
  data: MilestoneTimelineData,
  palette: ProposalColorPalette
): SvgRenderResult {
  try {
    const milestones = data.milestones || [];
    if (milestones.length === 0) return placeholder('Milestone Timeline');

    const primary = palette.primary || '2563eb';

    const svgW = 580;
    const PAD_L = 40;
    const PAD_R = 40;
    const LINE_Y = 140;
    const trackW = svgW - PAD_L - PAD_R;

    // Height depends on whether we have descriptions
    const hasDescriptions = milestones.some(m => m.description);
    const svgH = hasDescriptions ? 280 : 220;

    const spacing = milestones.length > 1 ? trackW / (milestones.length - 1) : 0;

    let out = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">`;
    out += `<rect width="${svgW}" height="${svgH}" fill="#ffffff"/>`;

    // Main horizontal line
    const lineX1 = PAD_L;
    const lineX2 = PAD_L + trackW;
    out += `<line x1="${lineX1}" y1="${LINE_Y}" x2="${lineX2}" y2="${LINE_Y}" stroke="#cbd5e1" stroke-width="3" stroke-linecap="round"/>`;

    // Arrow at end
    out += `<polygon points="${lineX2},${LINE_Y} ${lineX2 - 8},${LINE_Y - 5} ${lineX2 - 8},${LINE_Y + 5}" fill="#cbd5e1"/>`;

    for (let i = 0; i < milestones.length; i++) {
      const m = milestones[i];
      const cx = milestones.length === 1 ? PAD_L + trackW / 2 : PAD_L + i * spacing;
      const isAbove = i % 2 === 0;
      const color = CATEGORY_COLORS[m.category || 'milestone'] || primary;

      // Vertical connector
      const connectorLen = 40;
      const cy1 = isAbove ? LINE_Y - connectorLen : LINE_Y;
      const cy2 = isAbove ? LINE_Y : LINE_Y + connectorLen;
      out += `<line x1="${cx}" y1="${cy1}" x2="${cx}" y2="${cy2}" stroke="#${color}" stroke-width="1.5" stroke-dasharray="3,2"/>`;

      // Circle marker on the line
      out += `<circle cx="${cx}" cy="${LINE_Y}" r="8" fill="#${color}" stroke="#ffffff" stroke-width="2"/>`;

      // Label and date
      if (isAbove) {
        // Above the line
        out += `<text x="${cx}" y="${LINE_Y - connectorLen - 18}" text-anchor="middle" font-family="${FONT}" font-size="10" font-weight="600" fill="#1e293b">${escapeXml(truncate(m.label, 20))}</text>`;
        out += `<text x="${cx}" y="${LINE_Y - connectorLen - 6}" text-anchor="middle" font-family="${FONT}" font-size="9" fill="#64748b">${escapeXml(m.date)}</text>`;
        if (m.description) {
          out += `<text x="${cx}" y="${LINE_Y - connectorLen - 30}" text-anchor="middle" font-family="${FONT}" font-size="8" fill="#94a3b8">${escapeXml(truncate(m.description, 28))}</text>`;
        }
      } else {
        // Below the line
        out += `<text x="${cx}" y="${LINE_Y + connectorLen + 14}" text-anchor="middle" font-family="${FONT}" font-size="10" font-weight="600" fill="#1e293b">${escapeXml(truncate(m.label, 20))}</text>`;
        out += `<text x="${cx}" y="${LINE_Y + connectorLen + 26}" text-anchor="middle" font-family="${FONT}" font-size="9" fill="#64748b">${escapeXml(m.date)}</text>`;
        if (m.description) {
          out += `<text x="${cx}" y="${LINE_Y + connectorLen + 38}" text-anchor="middle" font-family="${FONT}" font-size="8" fill="#94a3b8">${escapeXml(truncate(m.description, 28))}</text>`;
        }
      }
    }

    // Legend
    const legendY = svgH - 24;
    const categories = [...new Set(milestones.map(m => m.category || 'milestone'))];
    let lx = PAD_L;
    for (const cat of categories) {
      const color = CATEGORY_COLORS[cat] || primary;
      out += `<circle cx="${lx + 6}" cy="${legendY}" r="5" fill="#${color}"/>`;
      out += `<text x="${lx + 16}" y="${legendY + 4}" font-family="${FONT}" font-size="9" fill="#64748b">${escapeXml(cat.charAt(0).toUpperCase() + cat.slice(1))}</text>`;
      lx += 90;
    }

    out += `</svg>`;
    return { svg: out, width: svgW, height: svgH };
  } catch {
    return placeholder('Milestone Timeline');
  }
}

function placeholder(title: string): SvgRenderResult {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="580" height="200" viewBox="0 0 580 200">
  <rect width="580" height="200" rx="8" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1.5"/>
  <text x="290" y="105" text-anchor="middle" font-family="${FONT}" font-size="13" fill="#94a3b8">${escapeXml(title)}</text>
</svg>`;
  return { svg, width: 580, height: 200 };
}
