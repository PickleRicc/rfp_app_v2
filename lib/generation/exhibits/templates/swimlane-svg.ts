import type { SwimlaneDiagramData, SvgRenderResult } from '../diagram-types';
import type { ProposalColorPalette } from '../../docx/colors';

const FONT = 'Arial, sans-serif';
const LANE_LABEL_W = 100;
const NODE_W = 140;
const NODE_H = 40;
const COL_W = 160;
const ROW_H = 80;
const PAD = 16;

function escapeXml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

interface LayoutStep {
  id: string;
  label: string;
  lane: string;
  nextIds: string[];
  col: number;
  row: number;
}

export function renderSwimlaneSvg(
  data: SwimlaneDiagramData,
  palette: ProposalColorPalette
): SvgRenderResult {
  try {
    const lanes = data.lanes || [];
    const steps = data.steps || [];
    if (lanes.length === 0 || steps.length === 0) return placeholder('Swimlane Diagram');

    const primary = palette.primary || '2563eb';
    const light = palette.primaryNodeFill || 'dbeafe';
    const dark = palette.primaryDark || '1e40af';
    const lineColor = '94a3b8';

    // Simple column-based layout: assign column by sequence order, row by lane
    const laneIndex = new Map(lanes.map((l, i) => [l, i]));
    const laid: LayoutStep[] = steps.map((s, col) => ({
      id: s.id,
      label: s.label,
      lane: s.lane,
      nextIds: s.nextIds || [],
      col,
      row: laneIndex.get(s.lane) ?? 0,
    }));
    const stepMap = new Map(laid.map(s => [s.id, s]));

    const maxCol = Math.max(...laid.map(s => s.col), 0);
    const svgW = PAD * 2 + LANE_LABEL_W + (maxCol + 1) * COL_W;
    const svgH = PAD * 2 + lanes.length * ROW_H;

    let out = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">`;
    out += `<rect width="${svgW}" height="${svgH}" fill="#ffffff"/>`;
    out += `<defs><marker id="arr" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="#${lineColor}"/></marker></defs>`;

    // Lane rows
    for (let i = 0; i < lanes.length; i++) {
      const ry = PAD + i * ROW_H;
      const rowBg = i % 2 === 0 ? '#f8fafc' : '#ffffff';
      out += `<rect x="${PAD}" y="${ry}" width="${svgW - PAD * 2}" height="${ROW_H}" fill="${rowBg}"/>`;
      out += `<line x1="${PAD}" y1="${ry}" x2="${svgW - PAD}" y2="${ry}" stroke="#e2e8f0" stroke-width="1"/>`;
      // Lane label column
      out += `<rect x="${PAD}" y="${ry}" width="${LANE_LABEL_W}" height="${ROW_H}" fill="#${light}"/>`;
      out += `<text x="${PAD + LANE_LABEL_W / 2}" y="${ry + ROW_H / 2 + 4}" text-anchor="middle"
        font-family="${FONT}" font-size="10" font-weight="700" fill="#${dark}">${escapeXml(lanes[i])}</text>`;
    }
    // Bottom border
    out += `<line x1="${PAD}" y1="${PAD + lanes.length * ROW_H}" x2="${svgW - PAD}" y2="${PAD + lanes.length * ROW_H}"
      stroke="#e2e8f0" stroke-width="1"/>`;

    // Lane label column right border
    out += `<line x1="${PAD + LANE_LABEL_W}" y1="${PAD}" x2="${PAD + LANE_LABEL_W}" y2="${PAD + lanes.length * ROW_H}"
      stroke="#${dark}" stroke-width="1.5"/>`;

    // Outer border
    out += `<rect x="${PAD}" y="${PAD}" width="${svgW - PAD * 2}" height="${lanes.length * ROW_H}"
      fill="none" stroke="#${dark}" stroke-width="1.5" rx="4"/>`;

    // Node positions
    const nodePosMap = new Map<string, { cx: number; cy: number }>();
    for (const step of laid) {
      const cx = PAD + LANE_LABEL_W + step.col * COL_W + COL_W / 2;
      const cy = PAD + step.row * ROW_H + ROW_H / 2;
      nodePosMap.set(step.id, { cx, cy });
    }

    // Edges
    for (const step of laid) {
      const from = nodePosMap.get(step.id);
      if (!from) continue;
      for (const nextId of step.nextIds) {
        const to = nodePosMap.get(nextId);
        if (!to) continue;
        const x1 = from.cx + NODE_W / 2;
        const x2 = to.cx - NODE_W / 2 - 6;
        out += `<line x1="${x1}" y1="${from.cy}" x2="${x2}" y2="${to.cy}"
          stroke="#${lineColor}" stroke-width="1.5" marker-end="url(#arr)"/>`;
      }
    }

    // Nodes
    for (const step of laid) {
      const pos = nodePosMap.get(step.id);
      if (!pos) continue;
      const nx = pos.cx - NODE_W / 2;
      const ny = pos.cy - NODE_H / 2;
      out += `<rect x="${nx}" y="${ny}" width="${NODE_W}" height="${NODE_H}"
        rx="6" fill="#${light}" stroke="#${primary}" stroke-width="1.5"/>`;
      out += `<text x="${pos.cx}" y="${pos.cy + 4}" text-anchor="middle"
        font-family="${FONT}" font-size="10" font-weight="600" fill="#${dark}">${escapeXml(step.label)}</text>`;
    }

    out += `</svg>`;
    return { svg: out, width: svgW, height: svgH };
  } catch {
    return placeholder('Swimlane Diagram');
  }
}

function placeholder(title: string): SvgRenderResult {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="700" height="280" viewBox="0 0 700 280">
  <rect width="700" height="280" rx="8" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1.5"/>
  <text x="350" y="145" text-anchor="middle" font-family="${FONT}" font-size="13" fill="#94a3b8">${escapeXml(title)}</text>
</svg>`;
  return { svg, width: 700, height: 280 };
}
