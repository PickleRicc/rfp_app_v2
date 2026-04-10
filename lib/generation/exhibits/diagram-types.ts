/**
 * Diagram Types — Shared data contract for AI-generated SVG diagrams
 *
 * Claude generates DiagramSpec[] via a focused API call after volume content generation.
 * TypeScript SVG template functions consume these specs to produce inline SVG.
 * The SVG embeds natively in DOCX (docx v9.5.1 ImageRun type: 'svg') and previews in-browser.
 */

import type { DataTableData } from './templates/data-table-svg';
import type { ComparisonTableData } from './templates/comparison-table-svg';
import type { MilestoneTimelineData } from './templates/milestone-timeline-svg';
import type { HeatMapData } from './templates/heat-map-svg';
import type { QuadrantChartData } from './templates/quadrant-chart-svg';
import type { CapabilityMatrixData } from './templates/capability-matrix-svg';
export type { DataTableData, ComparisonTableData, MilestoneTimelineData, HeatMapData, QuadrantChartData, CapabilityMatrixData };

// ===== DIAGRAM TYPES =====

export type DiagramType =
  | 'org-chart'
  | 'gantt'
  | 'process-flow'
  | 'bar-chart'
  | 'raci-matrix'
  | 'network-diagram'
  | 'radar-chart'
  | 'swimlane'
  | 'data-table'
  | 'comparison-table'
  | 'milestone-timeline'
  | 'heat-map'
  | 'quadrant-chart'
  | 'capability-matrix';

// ===== PLACEMENT =====

export interface DiagramPlacement {
  /** Keywords to search for in section titles (case-insensitive substring match) */
  sectionKeywords: string[];
  /** Where in the matched section to insert the diagram (default: 'end') */
  position?: 'start' | 'end';
}

// ===== MASTER SPEC =====

export interface DiagramSpec {
  /** Unique identifier within this volume — used for section keyword matching and logging */
  id: string;
  /** Diagram type — selects the SVG template renderer */
  type: DiagramType;
  /** Human-readable caption shown below the diagram in the document */
  title: string;
  /** Type-discriminated data payload — structure depends on type */
  data: DiagramData;
  /** Where in the volume to insert this diagram */
  placement: DiagramPlacement;
}

// ===== PER-TYPE DATA SHAPES =====

export type DiagramData =
  | OrgChartData
  | GanttData
  | ProcessFlowData
  | BarChartData
  | RaciMatrixData
  | NetworkDiagramData
  | RadarChartData
  | SwimlaneDiagramData
  | DataTableData
  | ComparisonTableData
  | MilestoneTimelineData
  | HeatMapData
  | QuadrantChartData
  | CapabilityMatrixData;

// --- Org Chart ---

export interface OrgChartData {
  type: 'org-chart';
  /** Root node — usually company name or contract name */
  root: string;
  /** All nodes in the hierarchy */
  nodes: OrgChartNode[];
}

export interface OrgChartNode {
  id: string;
  /** Primary label (e.g., role title) */
  label: string;
  /** Optional secondary label (e.g., person name or clearance) */
  sublabel?: string;
  /** Parent node id — omit for direct children of root */
  parentId?: string;
}

// --- Gantt Chart ---

export interface GanttData {
  type: 'gantt';
  /** Column header labels — first is the row-label column, rest are period labels */
  headers: string[];
  /** Rows/phases to display */
  phases: GanttPhase[];
}

export interface GanttPhase {
  /** Phase or task name */
  name: string;
  /** 0-based index of the first filled column (after the label column) */
  startCol: number;
  /** Number of columns this phase spans */
  durationCols: number;
  /** Render as a milestone diamond instead of a bar */
  milestone?: boolean;
}

// --- Process Flow ---

export interface ProcessFlowData {
  type: 'process-flow';
  nodes: ProcessFlowNode[];
  edges: ProcessFlowEdge[];
}

export interface ProcessFlowNode {
  id: string;
  label: string;
  shape: 'rect' | 'diamond' | 'rounded' | 'oval';
}

export interface ProcessFlowEdge {
  from: string;
  to: string;
  label?: string;
}

// --- Bar Chart ---

export interface BarChartData {
  type: 'bar-chart';
  orientation: 'horizontal' | 'vertical';
  xLabel?: string;
  yLabel?: string;
  series: BarChartSeries[];
}

export interface BarChartSeries {
  label: string;
  value: number;
  /** Override bar color (hex without #) — falls back to palette primary */
  color?: string;
}

// --- RACI Matrix ---

export interface RaciMatrixData {
  type: 'raci-matrix';
  /** Role names for column headers (first column is always "Activity") */
  roles: string[];
  rows: RaciRow[];
}

export interface RaciRow {
  activity: string;
  /** Map from role name → RACI designation */
  assignments: Record<string, 'R' | 'A' | 'C' | 'I' | ''>;
}

// --- Network Diagram ---

export interface NetworkDiagramData {
  type: 'network-diagram';
  nodes: NetworkNode[];
  edges: NetworkEdge[];
}

export interface NetworkNode {
  id: string;
  label: string;
  /** Optional tier/layer for vertical positioning (e.g., 'presentation', 'business', 'data') */
  tier?: string;
}

export interface NetworkEdge {
  from: string;
  to: string;
  label?: string;
  style?: 'solid' | 'dashed';
}

// --- Radar Chart ---

export interface RadarChartData {
  type: 'radar-chart';
  /** Axis labels — displayed around the radar perimeter */
  axes: string[];
  /** One or more data series */
  series: RadarSeries[];
}

export interface RadarSeries {
  name: string;
  /** Values 0–100 for each axis, in the same order as axes[] */
  values: number[];
}

// --- Swimlane ---

export interface SwimlaneDiagramData {
  type: 'swimlane';
  /** Lane names — each step belongs to one lane */
  lanes: string[];
  steps: SwimlaneStep[];
}

export interface SwimlaneStep {
  id: string;
  label: string;
  /** Which lane this step belongs to */
  lane: string;
  /** IDs of steps this connects to */
  nextIds?: string[];
}

// ===== SVG RENDER RESULT =====

/** Returned by every SVG template function */
export interface SvgRenderResult {
  /** Complete self-contained SVG string */
  svg: string;
  /** Intrinsic width in pixels — used for ImageRun transformation */
  width: number;
  /** Intrinsic height in pixels — used for ImageRun transformation */
  height: number;
}
