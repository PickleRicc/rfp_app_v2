import type { NetworkDiagramData, SvgRenderResult } from '../diagram-types';
import type { ProposalColorPalette } from '../../docx/colors';

const FONT = 'Arial, sans-serif';
const NODE_R = 36;
const PAD = 48;

function escapeXml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

interface Pos { x: number; y: number; }

export function renderNetworkDiagramSvg(
  data: NetworkDiagramData,
  palette: ProposalColorPalette
): SvgRenderResult {
  try {
    const nodes = data.nodes || [];
    const edges = data.edges || [];
    if (nodes.length === 0) return placeholder('Network Diagram');

    const primary = palette.primary || '2563eb';
    const light = palette.primaryNodeFill || 'dbeafe';
    const dark = palette.primaryDark || '1e40af';
    const lineColor = '94a3b8';

    // Group nodes by tier, lay out in rows
    const tiers = [...new Set(nodes.map(n => n.tier || 'default'))];
    const tierMap = new Map<string, typeof nodes>();
    for (const t of tiers) tierMap.set(t, nodes.filter(n => (n.tier || 'default') === t));

    const posMap = new Map<string, Pos>();
    let currentY = PAD + NODE_R;

    const maxPerRow = Math.max(...[...tierMap.values()].map(g => g.length));
    const svgW = Math.max(400, PAD * 2 + maxPerRow * (NODE_R * 2 + 40));

    for (const [tier, group] of tierMap) {
      const rowW = group.length * (NODE_R * 2 + 40) - 40;
      let x = (svgW - rowW) / 2 + NODE_R;
      for (const n of group) {
        posMap.set(n.id, { x, y: currentY });
        x += NODE_R * 2 + 40;
      }
      currentY += NODE_R * 2 + 48;
    }

    const svgH = currentY + PAD;

    let out = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">`;
    out += `<rect width="${svgW}" height="${svgH}" fill="#ffffff"/>`;
    out += `<defs>
      <marker id="arr" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
        <polygon points="0 0, 8 3, 0 6" fill="#${lineColor}"/></marker>
    </defs>`;

    // Tier labels
    let labelY = PAD + NODE_R;
    for (const [tier] of tierMap) {
      if (tier !== 'default') {
        out += `<text x="8" y="${labelY + 4}" font-family="${FONT}" font-size="9" fill="#94a3b8"
          transform="rotate(-90, 8, ${labelY})">${escapeXml(tier)}</text>`;
      }
      labelY += NODE_R * 2 + 48;
    }

    // Edges
    for (const edge of edges) {
      const from = posMap.get(edge.from);
      const to = posMap.get(edge.to);
      if (!from || !to) continue;
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len === 0) continue;
      const ex = from.x + (dx / len) * NODE_R;
      const ey = from.y + (dy / len) * NODE_R;
      const tx = to.x - (dx / len) * (NODE_R + 6);
      const ty = to.y - (dy / len) * (NODE_R + 6);
      const dash = edge.style === 'dashed' ? ' stroke-dasharray="6 3"' : '';
      out += `<line x1="${ex}" y1="${ey}" x2="${tx}" y2="${ty}"
        stroke="#${lineColor}" stroke-width="1.5" marker-end="url(#arr)"${dash}/>`;
      if (edge.label) {
        const mx = (from.x + to.x) / 2;
        const my = (from.y + to.y) / 2;
        out += `<text x="${mx}" y="${my - 4}" text-anchor="middle"
          font-family="${FONT}" font-size="9" fill="#64748b">${escapeXml(edge.label)}</text>`;
      }
    }

    // Nodes
    for (const node of nodes) {
      const pos = posMap.get(node.id);
      if (!pos) continue;
      out += `<circle cx="${pos.x}" cy="${pos.y}" r="${NODE_R}"
        fill="#${light}" stroke="#${primary}" stroke-width="1.5"/>`;
      const labelLines = wrapLabel(node.label, 10);
      const lineH = 13;
      const startY = pos.y - ((labelLines.length - 1) * lineH) / 2 + 4;
      for (let i = 0; i < labelLines.length; i++) {
        out += `<text x="${pos.x}" y="${startY + i * lineH}" text-anchor="middle"
          font-family="${FONT}" font-size="10" font-weight="600" fill="#${dark}">${escapeXml(labelLines[i])}</text>`;
      }
    }

    out += `</svg>`;
    return { svg: out, width: svgW, height: svgH };
  } catch {
    return placeholder('Network Diagram');
  }
}

function wrapLabel(text: string, maxChars: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const w of words) {
    if ((current + ' ' + w).trim().length > maxChars && current) {
      lines.push(current);
      current = w;
    } else {
      current = (current + ' ' + w).trim();
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 3);
}

function placeholder(title: string): SvgRenderResult {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300" viewBox="0 0 600 300">
  <rect width="600" height="300" rx="8" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1.5"/>
  <text x="300" y="155" text-anchor="middle" font-family="${FONT}" font-size="13" fill="#94a3b8">${escapeXml(title)}</text>
</svg>`;
  return { svg, width: 600, height: 300 };
}
