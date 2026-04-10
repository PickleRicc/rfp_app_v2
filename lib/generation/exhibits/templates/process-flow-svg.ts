import type { ProcessFlowData, ProcessFlowNode, SvgRenderResult } from '../diagram-types';
import type { ProposalColorPalette } from '../../docx/colors';

const FONT = 'Arial, sans-serif';
const NODE_W = 160;
const RECT_H = 44;
const DIAMOND_H = 50;
const V_GAP = 48;
const PAD = 30;

function escapeXml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

interface LayoutNode {
  node: ProcessFlowNode;
  x: number;
  y: number;
  h: number;
}

export function renderProcessFlowSvg(
  data: ProcessFlowData,
  palette: ProposalColorPalette
): SvgRenderResult {
  try {
    const nodes = data.nodes || [];
    const edges = data.edges || [];

    if (nodes.length === 0) return placeholder('Process Flow');

    const primary = palette.primary || '2563eb';
    const light = palette.primaryNodeFill || 'dbeafe';
    const dark = palette.primaryDark || '1e40af';
    const lineColor = '94a3b8';

    // Simple top-to-bottom linear layout
    const nodeMap = new Map<string, LayoutNode>();
    let y = PAD;

    for (const n of nodes) {
      const isDiamond = n.shape === 'diamond';
      const h = isDiamond ? DIAMOND_H : RECT_H;
      nodeMap.set(n.id, { node: n, x: PAD, y, h });
      y += h + V_GAP;
    }

    const svgW = PAD * 2 + NODE_W;
    const svgH = y - V_GAP + PAD;

    let out = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">`;
    out += `<rect width="${svgW}" height="${svgH}" fill="#ffffff"/>`;
    out += `<defs><marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="#${lineColor}"/></marker></defs>`;

    // Edges
    for (const edge of edges) {
      const from = nodeMap.get(edge.from);
      const to = nodeMap.get(edge.to);
      if (!from || !to) continue;
      const x1 = PAD + NODE_W / 2;
      const y1 = from.y + from.h;
      const x2 = PAD + NODE_W / 2;
      const y2 = to.y;
      out += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2 - 6}"
        stroke="#${lineColor}" stroke-width="1.5" marker-end="url(#arrowhead)"/>`;
      if (edge.label) {
        const mx = x1 + 8;
        const my = (y1 + y2) / 2;
        out += `<text x="${mx}" y="${my + 4}" font-family="${FONT}" font-size="9" fill="#64748b">${escapeXml(edge.label)}</text>`;
      }
    }

    // Nodes
    for (const layout of nodeMap.values()) {
      const { node, x, y: ny, h } = layout;
      const cx = x + NODE_W / 2;
      const cy = ny + h / 2;
      const label = escapeXml(node.label || node.id);

      if (node.shape === 'diamond') {
        const hw = NODE_W / 2;
        const hh = DIAMOND_H / 2;
        out += `<polygon points="${cx},${ny} ${cx + hw},${cy} ${cx},${ny + DIAMOND_H} ${cx - hw},${cy}"
          fill="#${light}" stroke="#${primary}" stroke-width="1.5"/>`;
        out += `<text x="${cx}" y="${cy + 4}" text-anchor="middle"
          font-family="${FONT}" font-size="10" font-weight="600" fill="#${dark}">${label}</text>`;
      } else if (node.shape === 'oval') {
        out += `<ellipse cx="${cx}" cy="${cy}" rx="${NODE_W / 2}" ry="${RECT_H / 2}"
          fill="#${primary}" stroke="#${dark}" stroke-width="1.5"/>`;
        out += `<text x="${cx}" y="${cy + 4}" text-anchor="middle"
          font-family="${FONT}" font-size="10" font-weight="700" fill="#ffffff">${label}</text>`;
      } else if (node.shape === 'rounded') {
        out += `<rect x="${x}" y="${ny}" width="${NODE_W}" height="${RECT_H}"
          rx="22" fill="#${light}" stroke="#${primary}" stroke-width="1.5"/>`;
        out += `<text x="${cx}" y="${cy + 4}" text-anchor="middle"
          font-family="${FONT}" font-size="10" font-weight="600" fill="#${dark}">${label}</text>`;
      } else {
        // rect (default)
        out += `<rect x="${x}" y="${ny}" width="${NODE_W}" height="${RECT_H}"
          rx="4" fill="#${light}" stroke="#${primary}" stroke-width="1.5"/>`;
        out += `<text x="${cx}" y="${cy + 4}" text-anchor="middle"
          font-family="${FONT}" font-size="10" font-weight="600" fill="#${dark}">${label}</text>`;
      }
    }

    out += `</svg>`;
    return { svg: out, width: svgW, height: svgH };
  } catch {
    return placeholder('Process Flow');
  }
}

function placeholder(title: string): SvgRenderResult {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="200" viewBox="0 0 220 200">
  <rect width="220" height="200" rx="8" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1.5"/>
  <text x="110" y="105" text-anchor="middle" font-family="${FONT}" font-size="13" fill="#94a3b8">${escapeXml(title)}</text>
</svg>`;
  return { svg, width: 220, height: 200 };
}
