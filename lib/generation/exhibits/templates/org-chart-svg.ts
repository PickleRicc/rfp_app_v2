import type { OrgChartData, SvgRenderResult } from '../diagram-types';
import type { ProposalColorPalette } from '../../docx/colors';

const NODE_W = 180;
const ROOT_NODE_W = 280;
const NODE_H = 54;
const NODE_H_WRAPPED = 68; // taller node when text wraps
const H_PAD = 10; // horizontal text padding inside node
const H_GAP = 24;
const V_GAP = 60;
const FONT = 'Arial, sans-serif';
const CHARS_PER_LINE = 24; // approximate chars that fit per line at font-size 11

interface LayoutNode {
  id: string;
  label: string;
  sublabel?: string;
  children: LayoutNode[];
  x: number;
  y: number;
  width: number;       // subtree width (used for layout)
  nodeWidth: number;   // visual width of this specific node box
  nodeHeight: number;  // visual height of this specific node box
}

/** Check whether a label needs wrapping (exceeds available width) */
function needsWrap(text: string, maxChars: number): boolean {
  return text.length > maxChars;
}

/** Split text into two lines near the midpoint at a word boundary */
function wrapText(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];
  const mid = Math.floor(text.length / 2);
  let splitIdx = text.lastIndexOf(' ', mid);
  if (splitIdx <= 0) splitIdx = text.indexOf(' ', mid);
  if (splitIdx <= 0) return [text.slice(0, maxChars), text.slice(maxChars)];
  return [text.slice(0, splitIdx), text.slice(splitIdx + 1)];
}

/** Compute effective node height based on whether label/sublabel need wrapping */
function computeNodeHeight(label: string, sublabel?: string, nw: number = NODE_W): number {
  const maxChars = Math.floor((nw - H_PAD * 2) / 7); // ~7px per char at font-size 11
  const labelWraps = needsWrap(label, maxChars);
  const sublabelWraps = sublabel ? needsWrap(sublabel, maxChars + 2) : false; // sublabel font is smaller
  if (labelWraps || sublabelWraps) return NODE_H_WRAPPED;
  return NODE_H;
}

function buildTree(data: OrgChartData): LayoutNode {
  const map = new Map<string, LayoutNode>();

  // Root node — wider to accommodate company name
  const rootLabel = data.root || 'Organization';
  const rootNw = ROOT_NODE_W;
  const root: LayoutNode = {
    id: '__root__',
    label: rootLabel,
    children: [],
    x: 0,
    y: 0,
    width: rootNw,
    nodeWidth: rootNw,
    nodeHeight: computeNodeHeight(rootLabel, undefined, rootNw),
  };
  map.set('__root__', root);

  for (const n of (data.nodes || [])) {
    const label = n.label || n.id;
    const nw = NODE_W;
    map.set(n.id, {
      id: n.id,
      label,
      sublabel: n.sublabel,
      children: [],
      x: 0,
      y: 0,
      width: nw,
      nodeWidth: nw,
      nodeHeight: computeNodeHeight(label, n.sublabel, nw),
    });
  }

  for (const n of (data.nodes || [])) {
    const parentId = n.parentId || '__root__';
    const parent = map.get(parentId) ?? root;
    const child = map.get(n.id);
    if (child) parent.children.push(child);
  }

  return root;
}

/** Assign x positions via post-order traversal */
function assignX(node: LayoutNode, depth: number): number {
  node.y = depth * (NODE_H_WRAPPED + V_GAP); // use max height for uniform row spacing
  if (node.children.length === 0) {
    node.width = node.nodeWidth;
    return node.width;
  }
  let totalWidth = 0;
  for (const child of node.children) {
    totalWidth += assignX(child, depth + 1) + H_GAP;
  }
  totalWidth -= H_GAP;
  node.width = Math.max(totalWidth, node.nodeWidth);
  return node.width;
}

/** Assign absolute x positions from left edge */
function assignAbsX(node: LayoutNode, left: number) {
  node.x = left + (node.width - node.nodeWidth) / 2;
  let childLeft = left;
  for (const child of node.children) {
    assignAbsX(child, childLeft);
    childLeft += child.width + H_GAP;
  }
}

function collectNodes(node: LayoutNode, out: LayoutNode[]) {
  out.push(node);
  for (const c of node.children) collectNodes(c, out);
}

function renderNode(n: LayoutNode, primary: string, light: string, textColor: string): string {
  const nw = n.nodeWidth;
  const nh = n.nodeHeight;
  const cx = n.x + nw / 2;
  const maxChars = Math.floor((nw - H_PAD * 2) / 7);
  const labelLines = wrapText(n.label, maxChars);
  const sublabelMaxChars = Math.floor((nw - H_PAD * 2) / 6); // sublabel font is smaller
  const sublabelLines = n.sublabel ? wrapText(n.sublabel, sublabelMaxChars) : [];

  let svg = `
  <rect x="${n.x}" y="${n.y}" width="${nw}" height="${nh}"
    rx="6" ry="6" fill="#${light}" stroke="#${primary}" stroke-width="1.5"/>`;

  // Label text with wrapping
  const totalTextLines = labelLines.length + sublabelLines.length;
  const lineHeight = 14;
  const totalTextHeight = totalTextLines * lineHeight;
  const startY = n.y + (nh - totalTextHeight) / 2 + 11; // 11 = approx baseline offset

  svg += `<text x="${cx}" y="${startY}" text-anchor="middle"
    font-family="${FONT}" font-size="11" font-weight="600" fill="#${textColor}">`;
  for (let i = 0; i < labelLines.length; i++) {
    if (i === 0) {
      svg += `<tspan x="${cx}" dy="0">${escapeXml(labelLines[i])}</tspan>`;
    } else {
      svg += `<tspan x="${cx}" dy="${lineHeight}">${escapeXml(labelLines[i])}</tspan>`;
    }
  }
  svg += `</text>`;

  // Sublabel text with wrapping
  if (sublabelLines.length > 0) {
    const sublabelY = startY + labelLines.length * lineHeight;
    svg += `<text x="${cx}" y="${sublabelY}" text-anchor="middle"
      font-family="${FONT}" font-size="9.5" fill="#64748b">`;
    for (let i = 0; i < sublabelLines.length; i++) {
      if (i === 0) {
        svg += `<tspan x="${cx}" dy="0">${escapeXml(sublabelLines[i])}</tspan>`;
      } else {
        svg += `<tspan x="${cx}" dy="${lineHeight}">${escapeXml(sublabelLines[i])}</tspan>`;
      }
    }
    svg += `</text>`;
  }

  return svg;
}

function renderEdge(parent: LayoutNode, child: LayoutNode, lineColor: string): string {
  const px = parent.x + parent.nodeWidth / 2;
  const py = parent.y + parent.nodeHeight;
  const cx = child.x + child.nodeWidth / 2;
  const cy = child.y;
  const my = py + (cy - py) / 2;
  return `<path d="M${px},${py} L${px},${my} L${cx},${my} L${cx},${cy}"
    fill="none" stroke="#${lineColor}" stroke-width="1.5"/>`;
}

function escapeXml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderOrgChartSvg(
  data: OrgChartData,
  palette: ProposalColorPalette
): SvgRenderResult {
  try {
    const root = buildTree(data);
    assignX(root, 0);
    assignAbsX(root, 0);

    const allNodes: LayoutNode[] = [];
    collectNodes(root, allNodes);

    const svgW = root.width + 40;
    const maxY = allNodes.reduce((m, n) => Math.max(m, n.y + n.nodeHeight), 0);
    const svgH = maxY + 40;

    const primary = palette.primary || '2563eb';
    const light = palette.primaryNodeFill || 'dbeafe';
    const textColor = palette.primaryDark || '1e40af';
    const lineColor = '94a3b8';

    const nodeSvg = allNodes.map(n => renderNode(n, primary, light, textColor)).join('');
    const edgeSvg: string[] = [];
    for (const n of allNodes) {
      for (const c of n.children) {
        edgeSvg.push(renderEdge(n, c, lineColor));
      }
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">
  <g transform="translate(20,20)">
    ${edgeSvg.join('')}
    ${nodeSvg}
  </g>
</svg>`;

    return { svg, width: svgW, height: svgH };
  } catch {
    return placeholder(data.root || 'Organizational Chart');
  }
}

function placeholder(title: string): SvgRenderResult {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="200" viewBox="0 0 600 200">
  <rect width="600" height="200" rx="8" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1.5"/>
  <text x="300" y="105" text-anchor="middle" font-family="${FONT}" font-size="13" fill="#94a3b8">${escapeXml(title)}</text>
</svg>`;
  return { svg, width: 600, height: 200 };
}
