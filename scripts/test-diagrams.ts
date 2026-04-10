/**
 * Diagram Visual Test Script
 * Renders all 9 diagram templates to SVG files in /tmp/diagrams/
 * Open them in a browser to visually inspect output.
 *
 * Usage:
 *   npx ts-node --project tsconfig.json scripts/test-diagrams.ts
 *
 * Output: /tmp/diagrams/*.svg + /tmp/diagrams/index.html (gallery)
 */

import * as fs from 'fs';
import * as path from 'path';

import { renderOrgChartSvg } from '../lib/generation/exhibits/templates/org-chart-svg';
import { renderGanttSvg } from '../lib/generation/exhibits/templates/gantt-svg';
import { renderProcessFlowSvg } from '../lib/generation/exhibits/templates/process-flow-svg';
import { renderBarChartSvg } from '../lib/generation/exhibits/templates/bar-chart-svg';
import { renderRaciMatrixSvg } from '../lib/generation/exhibits/templates/raci-matrix-svg';
import { renderNetworkDiagramSvg } from '../lib/generation/exhibits/templates/network-diagram-svg';
import { renderRadarChartSvg } from '../lib/generation/exhibits/templates/radar-chart-svg';
import { renderSwimlaneSvg } from '../lib/generation/exhibits/templates/swimlane-svg';
import { renderDataTableSvg } from '../lib/generation/exhibits/templates/data-table-svg';

import type { ProposalColorPalette } from '../lib/generation/docx/colors';
import type {
  OrgChartData, GanttData, ProcessFlowData, BarChartData,
  RaciMatrixData, NetworkDiagramData, RadarChartData,
  SwimlaneDiagramData, DataTableData,
} from '../lib/generation/exhibits/diagram-types';

// ── Test palette (mimics a real company brand) ──────────────────────────────
const palette: ProposalColorPalette = {
  primary: '#1e40af',
  primaryDark: '#1e3a8a',
  primaryNodeFill: '#dbeafe',
  secondary: '#0f766e',
  accent: '#c2410c',
  text: '#1f2937',
  textLight: '#6b7280',
  background: '#ffffff',
  border: '#e5e7eb',
  tableHeader: '#1e40af',
  tableHeaderText: '#ffffff',
  tableRowAlt: '#f0f9ff',
};

// ── Sample data fixtures ─────────────────────────────────────────────────────

const orgChart: OrgChartData = {
  type: 'org-chart',
  root: 'Program Manager',
  nodes: [
    { id: 'pm',   label: 'Program Manager',      sublabel: 'Jane Smith, PMP' },
    { id: 'tl',   label: 'Technical Lead',        sublabel: 'TS/SCI', parentId: 'pm' },
    { id: 'ml',   label: 'Management Lead',       sublabel: 'Secret', parentId: 'pm' },
    { id: 'se1',  label: 'Sr. Systems Engineer',  parentId: 'tl' },
    { id: 'se2',  label: 'Cloud Architect',        parentId: 'tl' },
    { id: 'qa',   label: 'QA Lead',               parentId: 'tl' },
    { id: 'hr',   label: 'HR / Recruiting',       parentId: 'ml' },
    { id: 'fin',  label: 'Finance / Contracts',   parentId: 'ml' },
  ],
};

const gantt: GanttData = {
  type: 'gantt',
  headers: ['Phase', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9', 'M10', 'M11', 'M12'],
  phases: [
    { name: 'Transition',         startCol: 0, durationCols: 3 },
    { name: 'Requirements',       startCol: 1, durationCols: 2 },
    { name: 'Design & Architect', startCol: 3, durationCols: 3 },
    { name: 'Implementation',     startCol: 5, durationCols: 4 },
    { name: 'Testing & QA',       startCol: 8, durationCols: 2 },
    { name: 'Deployment',         startCol: 9, durationCols: 1, milestone: true },
    { name: 'O&M',                startCol: 9, durationCols: 3 },
  ],
};

const processFlow: ProcessFlowData = {
  type: 'process-flow',
  nodes: [
    { id: 'start',   label: 'Ticket Received',    shape: 'oval' },
    { id: 'triage',  label: 'Triage & Classify',  shape: 'diamond' },
    { id: 'p1',      label: 'P1/P2\nEscalation',  shape: 'rounded' },
    { id: 'std',     label: 'Standard\nResolution', shape: 'rect' },
    { id: 'review',  label: 'QA Review',           shape: 'diamond' },
    { id: 'close',   label: 'Ticket Closed',       shape: 'oval' },
    { id: 'kb',      label: 'Update KB',           shape: 'rounded' },
  ],
  edges: [
    { from: 'start',  to: 'triage' },
    { from: 'triage', to: 'p1',     label: 'Critical' },
    { from: 'triage', to: 'std',    label: 'Standard' },
    { from: 'p1',     to: 'review' },
    { from: 'std',    to: 'review' },
    { from: 'review', to: 'close',  label: 'Pass' },
    { from: 'review', to: 'std',    label: 'Rework' },
    { from: 'close',  to: 'kb' },
  ],
};

const barChart: BarChartData = {
  type: 'bar-chart',
  orientation: 'horizontal',
  xLabel: 'Score (0–100)',
  yLabel: 'Capability Area',
  series: [
    { label: 'Cloud Migration',    value: 95 },
    { label: 'Cybersecurity',      value: 92 },
    { label: 'IT Service Mgmt',    value: 88 },
    { label: 'Data Analytics',     value: 85 },
    { label: 'DevSecOps',          value: 90 },
    { label: 'Program Management', value: 97 },
  ],
};

const raciMatrix: RaciMatrixData = {
  type: 'raci-matrix',
  roles: ['PM', 'Tech Lead', 'Dev Team', 'QA', 'COTR', 'Sec Officer'],
  rows: [
    { activity: 'Requirement Analysis',   assignments: { PM: 'A', 'Tech Lead': 'R', 'Dev Team': 'C', QA: 'I', COTR: 'C', 'Sec Officer': 'I' } },
    { activity: 'System Design',          assignments: { PM: 'C', 'Tech Lead': 'A', 'Dev Team': 'R', QA: 'C', COTR: 'I', 'Sec Officer': 'C' } },
    { activity: 'Code Development',       assignments: { PM: 'I', 'Tech Lead': 'A', 'Dev Team': 'R', QA: 'C', COTR: 'I', 'Sec Officer': 'I' } },
    { activity: 'Security Testing',       assignments: { PM: 'I', 'Tech Lead': 'C', 'Dev Team': 'C', QA: 'R', COTR: 'I', 'Sec Officer': 'A' } },
    { activity: 'Deployment',             assignments: { PM: 'A', 'Tech Lead': 'R', 'Dev Team': 'R', QA: 'C', COTR: 'A', 'Sec Officer': 'C' } },
    { activity: 'Incident Response',      assignments: { PM: 'C', 'Tech Lead': 'A', 'Dev Team': 'R', QA: 'I', COTR: 'I', 'Sec Officer': 'R' } },
  ],
};

const networkDiagram: NetworkDiagramData = {
  type: 'network-diagram',
  nodes: [
    { id: 'user',   label: 'End Users',          tier: 'presentation' },
    { id: 'portal', label: 'Web Portal',         tier: 'presentation' },
    { id: 'api',    label: 'API Gateway',        tier: 'business' },
    { id: 'auth',   label: 'Auth Service',       tier: 'business' },
    { id: 'svc1',   label: 'Core Service',       tier: 'business' },
    { id: 'db',     label: 'PostgreSQL DB',      tier: 'data' },
    { id: 'cache',  label: 'Redis Cache',        tier: 'data' },
    { id: 'siem',   label: 'SIEM / Splunk',      tier: 'security' },
  ],
  edges: [
    { from: 'user',   to: 'portal' },
    { from: 'portal', to: 'api' },
    { from: 'api',    to: 'auth' },
    { from: 'api',    to: 'svc1' },
    { from: 'svc1',   to: 'db' },
    { from: 'svc1',   to: 'cache' },
    { from: 'api',    to: 'siem', style: 'dashed', label: 'logs' },
  ],
};

const radarChart: RadarChartData = {
  type: 'radar-chart',
  axes: ['Technical Excellence', 'Past Performance', 'Key Personnel', 'Management Approach', 'Price Competitiveness', 'Security Posture'],
  series: [
    { name: 'Our Proposal',  values: [95, 90, 88, 92, 78, 96] },
    { name: 'Threshold',     values: [70, 70, 70, 70, 70, 70] },
  ],
};

const swimlane: SwimlaneDiagramData = {
  type: 'swimlane',
  lanes: ['Government (COTR)', 'Program Manager', 'Technical Team', 'QA / Test'],
  steps: [
    { id: 's1', label: 'Task Order\nReceived',     lane: 'Government (COTR)',  nextIds: ['s2'] },
    { id: 's2', label: 'Kickoff &\nPlanning',      lane: 'Program Manager',    nextIds: ['s3'] },
    { id: 's3', label: 'Design &\nDevelopment',    lane: 'Technical Team',     nextIds: ['s4'] },
    { id: 's4', label: 'Unit Testing',             lane: 'Technical Team',     nextIds: ['s5'] },
    { id: 's5', label: 'QA Review',                lane: 'QA / Test',          nextIds: ['s6', 's3'] },
    { id: 's6', label: 'COTR Acceptance',          lane: 'Government (COTR)',  nextIds: ['s7'] },
    { id: 's7', label: 'Deployment',               lane: 'Technical Team' },
  ],
};

const dataTable: DataTableData = {
  type: 'data-table',
  caption: 'Key Personnel Summary',
  columns: ['Position', 'Name', 'Clearance', 'Years Exp', 'Certifications'],
  rows: [
    ['Program Manager',    'Jane Smith',    'Secret',    '15', 'PMP, ITIL v4'],
    ['Technical Lead',     'John Doe',      'TS/SCI',    '12', 'CISSP, AWS SA'],
    ['Cloud Architect',    'Maria Torres',  'Secret',    '10', 'AWS Pro, Azure SA'],
    ['Cybersecurity Lead', 'Marcus Lee',    'TS/SCI',    '8',  'CISSP, CEH, CMMC RP'],
    ['QA Manager',         'Sarah Johnson', 'Secret',    '9',  'CSTE, Six Sigma BB'],
  ],
};

// ── Render and write ─────────────────────────────────────────────────────────

const OUT_DIR = '/tmp/diagrams';
fs.mkdirSync(OUT_DIR, { recursive: true });

interface TestCase {
  name: string;
  filename: string;
  result: { svg: string; width: number; height: number };
}

const results: TestCase[] = [
  { name: 'Org Chart',       filename: 'org-chart.svg',       result: renderOrgChartSvg(orgChart, palette) },
  { name: 'Gantt Chart',     filename: 'gantt.svg',           result: renderGanttSvg(gantt, palette) },
  { name: 'Process Flow',    filename: 'process-flow.svg',    result: renderProcessFlowSvg(processFlow, palette) },
  { name: 'Bar Chart',       filename: 'bar-chart.svg',       result: renderBarChartSvg(barChart, palette) },
  { name: 'RACI Matrix',     filename: 'raci-matrix.svg',     result: renderRaciMatrixSvg(raciMatrix, palette) },
  { name: 'Network Diagram', filename: 'network-diagram.svg', result: renderNetworkDiagramSvg(networkDiagram, palette) },
  { name: 'Radar Chart',     filename: 'radar-chart.svg',     result: renderRadarChartSvg(radarChart, palette) },
  { name: 'Swimlane',        filename: 'swimlane.svg',        result: renderSwimlaneSvg(swimlane, palette) },
  { name: 'Data Table',      filename: 'data-table.svg',      result: renderDataTableSvg(dataTable, palette) },
];

let allPassed = true;

for (const tc of results) {
  const outPath = path.join(OUT_DIR, tc.filename);
  const { svg, width, height } = tc.result;

  // Basic assertions
  const pass =
    typeof svg === 'string' &&
    svg.trimStart().startsWith('<svg') &&
    width > 0 &&
    height > 0;

  if (pass) {
    fs.writeFileSync(outPath, svg, 'utf8');
    console.log(`  ✓  ${tc.name.padEnd(18)} ${width}×${height}px  →  ${outPath}`);
  } else {
    console.error(`  ✗  ${tc.name} FAILED — svg=${typeof svg}, w=${width}, h=${height}`);
    allPassed = false;
  }
}

// ── Write HTML gallery ───────────────────────────────────────────────────────

const galleryHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Diagram Template Gallery</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f8fafc; padding: 32px; }
    h1   { color: #1e40af; margin-bottom: 8px; }
    p    { color: #6b7280; margin-bottom: 32px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(500px, 1fr)); gap: 24px; }
    .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
    .card h2 { font-size: 14px; font-weight: 600; color: #374151; margin: 0 0 12px; text-transform: uppercase; letter-spacing: .05em; }
    .card img { width: 100%; height: auto; border: 1px solid #f3f4f6; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>Diagram Template Gallery</h1>
  <p>Generated by scripts/test-diagrams.ts — ${new Date().toLocaleString()}</p>
  <div class="grid">
    ${results.map(tc => `
    <div class="card">
      <h2>${tc.name}</h2>
      <img src="${tc.filename}" alt="${tc.name}" width="${tc.result.width}" height="${tc.result.height}">
    </div>`).join('')}
  </div>
</body>
</html>`;

fs.writeFileSync(path.join(OUT_DIR, 'index.html'), galleryHtml, 'utf8');

console.log(`\n${allPassed ? '✓ All diagrams passed' : '✗ Some diagrams failed'}`);
console.log(`\nOpen gallery:  open ${OUT_DIR}/index.html\n`);

if (!allPassed) process.exit(1);
