/**
 * Diagram Spec Generator
 *
 * Produces DiagramSpec[] for a proposal volume from three priority sources:
 *
 *  1. REQUIRED — RFP-extracted diagram requirements (Section L/C/H text)
 *     e.g. "provide a CONOPS diagram", "include an organizational chart"
 *     Source: SectionLFields.diagram_requirements from compliance_extractions
 *
 *  2. REQUIRED — PM-specified diagram requests from the Strategy Builder
 *     e.g. PM adds a RACI matrix for the Management volume
 *     Source: VolumeStrategy.diagram_requests from solicitation_strategies
 *
 *  3. AI-SUGGESTED — A focused Claude call analyzes the generated volume content
 *     and context data to suggest additional diagrams that would add value.
 *     Claude respects required diagrams and adds up to maxDiagrams total.
 *
 * All failures are non-fatal — callers catch and continue without diagrams.
 */

import { anthropic } from '@/lib/anthropic/client';
import type { DiagramSpec, DiagramType } from './diagram-types';
import type { VolumeDiagramRequest } from '@/lib/supabase/strategy-types';
import type { SectionLFields } from '@/lib/supabase/compliance-types';
import type { ComplianceExtractionsByCategory } from '@/lib/supabase/compliance-types';

// ===== TYPES =====

export interface DiagramSpecRequest {
  /** Generated volume markdown — first 4000 chars used for context */
  volumeMarkdown: string;
  /** Human-readable volume name (e.g., "Technical Approach") */
  volumeName: string;
  /** Canonical volume type (e.g., 'technical', 'management') */
  volumeType: string;
  /** Key context data for generating diagram data payloads */
  context: DiagramContext;
  /**
   * PM-specified diagrams from the Strategy Builder.
   * These are always generated — Claude adds extras on top.
   */
  requiredFromStrategy?: VolumeDiagramRequest[];
  /**
   * Diagrams explicitly required by the RFP (extracted from Section L/C/H).
   * These are always generated — highest priority.
   */
  requiredFromRfp?: RfpDiagramRequirement[];
  /** Max total diagrams (required + AI-suggested combined, default: 3) */
  maxDiagrams?: number;
}

export interface DiagramContext {
  companyName: string;
  /** Key personnel with role titles and optional names */
  personnel?: Array<{ role: string; name?: string; clearance?: string }>;
  /** Service areas / task areas from the SOW */
  serviceAreas?: string[];
  /** Transition or project phases */
  phases?: Array<{ name: string; durationWeeks?: number }>;
  /** Technology stack items */
  technologies?: string[];
  /** Any other context string to help Claude choose diagrams */
  additionalContext?: string;
}

export interface RfpDiagramRequirement {
  type: string;
  requirement_text: string;
  section_reference?: string;
  applies_to_volume?: string | null;
}

export interface DiagramSpecResult {
  specs: DiagramSpec[];
  success: boolean;
  /** How many specs came from each source */
  sources: { rfp: number; strategy: number; ai: number };
  error?: string;
}

// ===== SYSTEM PROMPT =====

const SYSTEM_PROMPT = `You are a diagram specification generator for government proposal documents.

Given a proposal volume's content and context data, output a JSON array of DiagramSpec objects.
Each DiagramSpec describes one diagram that adds professional visual value to the proposal.

Output ONLY a valid JSON array. No explanation. No markdown code fences. No prose. Just raw JSON.

If no additional diagrams are needed beyond the required ones, return an empty array: []`;

// ===== SCHEMA HINT =====

const SCHEMA_HINT = `
DiagramSpec schema:
{
  "id": string,           // unique snake_case identifier, e.g. "org_chart_1", "transition_gantt"
  "type": one of: "org-chart" | "gantt" | "process-flow" | "bar-chart" | "raci-matrix" | "network-diagram" | "radar-chart" | "swimlane" | "data-table" | "comparison-table" | "milestone-timeline" | "heat-map" | "quadrant-chart" | "capability-matrix",
  "title": string,        // SPECIFIC caption — must reference actual contract content, NOT generic type names
  "placement": {
    "sectionKeywords": string[],  // keywords to find the right section (e.g. ["organizational", "management"])
    "position": "end"
  },
  "data": { ... }         // payload depends on type (see below)
}

Data shapes by type:
- org-chart: { type:"org-chart", root:string, nodes:[{id,label,sublabel?,parentId?}] }
- gantt: { type:"gantt", headers:["Phase",...periodLabels], phases:[{name,startCol,durationCols,milestone?}] }
- process-flow: { type:"process-flow", nodes:[{id,label,shape:"rect"|"diamond"|"rounded"|"oval"}], edges:[{from,to,label?}] }
- bar-chart: { type:"bar-chart", orientation:"horizontal"|"vertical", xLabel?,yLabel?, series:[{label,value,color?}] }
- raci-matrix: { type:"raci-matrix", roles:[roleNames], rows:[{activity,assignments:{roleName:"R"|"A"|"C"|"I"|""}}] }
- network-diagram: { type:"network-diagram", nodes:[{id,label,tier?}], edges:[{from,to,label?,style?}] }
- radar-chart: { type:"radar-chart", axes:[axisLabels], series:[{name,values:[0-100 per axis]}] }
- swimlane: { type:"swimlane", lanes:[laneNames], steps:[{id,label,lane,nextIds?}] }`;

const EXAMPLE = `
Example for a management volume with personnel:
[
  {
    "id": "org_chart_management",
    "type": "org-chart",
    "title": "Figure: Proposed Organizational Structure",
    "placement": { "sectionKeywords": ["organizational", "management", "structure"], "position": "end" },
    "data": {
      "type": "org-chart",
      "root": "Acme Corp — Contract Team",
      "nodes": [
        { "id": "pm", "label": "Program Manager", "sublabel": "Jane Smith" },
        { "id": "tl", "label": "Technical Lead", "sublabel": "John Doe", "parentId": "pm" },
        { "id": "qm", "label": "QA Manager", "sublabel": "TBD", "parentId": "pm" }
      ]
    }
  }
]`;

// ===== MAIN FUNCTION =====

export async function generateDiagramSpecs(
  request: DiagramSpecRequest
): Promise<DiagramSpecResult> {
  const rfpRequired = request.requiredFromRfp ?? [];
  const strategyRequired = request.requiredFromStrategy ?? [];

  // RFP + PM-selected diagrams are ALWAYS generated — no cap
  const rfpSpecs = rfpRequired.map(r => buildRequiredSpec(r, request));
  const strategySpecs = strategyRequired.map(r => buildStrategySpec(r, request));

  // AI suggestions fill remaining slots up to maxDiagrams (default 3)
  const maxAiSuggestions = Math.min(request.maxDiagrams ?? 3, 5);
  const aiSlots = Math.max(0, maxAiSuggestions - rfpSpecs.length - strategySpecs.length);

  let aiSpecs: DiagramSpec[] = [];
  if (aiSlots > 0) {
    aiSpecs = await fetchAiSuggestedSpecs(request, aiSlots, rfpSpecs, strategySpecs);
  }

  // Enrich all specs with AI-determined titles and placement
  // This single Claude call analyzes volume content and assigns specific,
  // context-aware titles and section placements for every diagram.
  const allSpecs = [...rfpSpecs, ...strategySpecs, ...aiSpecs];
  const enrichedSpecs = await enrichSpecsWithContext(allSpecs, request);

  console.log(`[diagram-spec-generator] Generated ${enrichedSpecs.length} specs: ${rfpSpecs.length} RFP-required, ${strategySpecs.length} PM-selected, ${aiSpecs.length} AI-suggested`);
  for (const spec of enrichedSpecs) {
    console.log(`[diagram-spec-generator] Diagram: "${spec.title}" (${spec.type}) → placement: ${spec.placement?.sectionKeywords?.join(', ')}`);
  }

  return {
    specs: enrichedSpecs,
    success: true,
    sources: { rfp: rfpSpecs.length, strategy: strategySpecs.length, ai: aiSpecs.length },
  };
}

/**
 * Enriches diagram specs with AI-determined titles and placement keywords.
 * Analyzes the actual volume content to assign specific, meaningful titles
 * and identify the exact subsection each diagram should appear near.
 *
 * One focused Claude call handles all specs in a batch.
 */
async function enrichSpecsWithContext(
  specs: DiagramSpec[],
  request: DiagramSpecRequest
): Promise<DiagramSpec[]> {
  if (specs.length === 0) return specs;

  // Extract H2/H3 section headings from volume markdown for placement guidance
  const headings: string[] = [];
  const lines = (request.volumeMarkdown || '').split('\n');
  for (const line of lines) {
    const h2 = line.match(/^## (.+)$/);
    const h3 = line.match(/^### (.+)$/);
    if (h2) headings.push(h2[1].trim());
    if (h3) headings.push(h3[1].trim());
  }

  if (headings.length === 0) return specs; // No content to analyze

  const specsForEnrichment = specs.map((s, i) => ({
    index: i,
    type: s.type,
    currentTitle: s.title,
    currentPlacement: s.placement?.sectionKeywords?.filter(k => k.length > 0) || [],
  }));

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      temperature: 0.2,
      system: 'You assign specific, professional figure titles and section placements for proposal diagrams. Return ONLY valid JSON.',
      messages: [{
        role: 'user',
        content: `Analyze this proposal volume and assign the best title and placement for each diagram.

VOLUME: ${request.volumeName}
COMPANY: ${request.context.companyName}

SECTION HEADINGS IN THIS VOLUME:
${headings.map((h, i) => `  ${i + 1}. ${h}`).join('\n')}

DIAGRAMS TO PLACE:
${specsForEnrichment.map(s => `  ${s.index}. Type: ${s.type}, Current title: "${s.currentTitle}"`).join('\n')}

For each diagram, return:
1. "title" — A specific figure caption referencing the actual contract content (e.g., "Figure: TechVision Proposed 28.3-FTE Organizational Structure for METC C4/IT Support"). NEVER use generic type names like "Org Chart" or "Bar Chart".
2. "bestSection" — The exact heading text (from the list above) where this diagram should appear. Pick the MOST relevant section/subsection.

Return a JSON array:
[
  { "index": 0, "title": "Figure: ...", "bestSection": "exact heading text" },
  ...
]

Return ONLY the JSON array.`,
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return specs;

    const enrichments = JSON.parse(jsonMatch[0]) as Array<{
      index: number;
      title: string;
      bestSection: string;
    }>;

    // Apply enrichments back to specs
    for (const e of enrichments) {
      if (e.index < 0 || e.index >= specs.length) continue;
      const spec = specs[e.index];

      // Update title — always use AI title (it's content-specific)
      if (e.title && e.title.length > 10) {
        spec.title = e.title;
      }

      // Update placement — add the AI-identified section heading as a keyword
      if (e.bestSection && e.bestSection.length > 3) {
        const existing = spec.placement?.sectionKeywords || [];
        // AI's exact section heading is highest priority — put first
        const sectionWords = e.bestSection.toLowerCase().split(/\s+/).filter(w => w.length > 3 && !['and', 'the', 'for', 'with'].includes(w));
        spec.placement = {
          sectionKeywords: [e.bestSection, ...sectionWords, ...existing],
          position: spec.placement?.position || 'end',
        };
      }
    }

    return specs;
  } catch (err) {
    console.warn('[diagram-spec-generator] Enrichment call failed, using defaults:', err instanceof Error ? err.message : err);
    return specs; // Non-fatal — use original specs
  }
}

// ===== REQUIRED SPEC BUILDERS =====

/**
 * Builds a DiagramSpec from an RFP-extracted diagram requirement.
 * Uses Claude to populate the data payload in a separate small call.
 */
function buildRequiredSpec(
  req: RfpDiagramRequirement,
  request: DiagramSpecRequest
): DiagramSpec {
  const type = normalizeDiagramType(req.type);
  const id = `rfp_required_${type.replace(/-/g, '_')}`;
  return {
    id,
    type,
    title: `Figure: ${req.requirement_text.slice(0, 80)}`,
    placement: {
      sectionKeywords: deriveKeywordsFromType(type),
      position: 'end',
    },
    data: buildPlaceholderData(type, request),
  };
}

/**
 * Builds a DiagramSpec from a PM strategy diagram request.
 * Filters empty placement sections and ensures meaningful keywords.
 */
function buildStrategySpec(
  req: VolumeDiagramRequest,
  request: DiagramSpecRequest
): DiagramSpec {
  const id = `strategy_${req.type.replace(/-/g, '_')}_${Date.now()}`;

  // Build placement keywords — filter out empty strings
  const placementKeywords = [
    ...(req.placement_section ? [req.placement_section] : []),
    ...deriveKeywordsFromType(req.type),
  ];

  // Split multi-word placement section into individual keywords too
  // e.g., "Staffing and Organization" → also adds ["staffing", "organization"]
  if (req.placement_section) {
    const words = req.placement_section.toLowerCase().split(/\s+/).filter(w => w.length > 3 && w !== 'and');
    placementKeywords.push(...words);
  }

  return {
    id,
    type: req.type,
    title: req.title || `Figure: ${req.type}`,
    placement: {
      sectionKeywords: [...new Set(placementKeywords)],
      position: 'end',
    },
    data: buildPlaceholderData(req.type, request, req.notes),
  };
}

// ===== AI SUGGESTED SPECS =====

async function fetchAiSuggestedSpecs(
  request: DiagramSpecRequest,
  slots: number,
  alreadyRequired: DiagramSpec[],
  alreadyStrategy: DiagramSpec[]
): Promise<DiagramSpec[]> {
  const contentPreview = request.volumeMarkdown.slice(0, 4000);
  const alreadyTypes = [...alreadyRequired, ...alreadyStrategy].map(s => s.type);

  const userPrompt = buildAiPrompt(request, contentPreview, slots, alreadyTypes);

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      temperature: 0.1,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const rawText = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as any).text)
      .join('');

    return parseSpecsFromResponse(rawText);
  } catch (err) {
    console.warn('[diagram-spec-generator] AI suggestion call failed:', err instanceof Error ? err.message : err);
    return [];
  }
}

function buildAiPrompt(
  request: DiagramSpecRequest,
  contentPreview: string,
  slots: number,
  alreadyTypes: DiagramType[]
): string {
  const { volumeName, volumeType, context } = request;

  const personnelStr = context.personnel?.length
    ? context.personnel.map(p => `- ${p.role}${p.name ? `: ${p.name}` : ''}${p.clearance ? ` (${p.clearance})` : ''}`).join('\n')
    : 'Not provided';

  const serviceAreasStr = context.serviceAreas?.length
    ? context.serviceAreas.slice(0, 8).join(', ')
    : 'Not provided';

  const phasesStr = context.phases?.length
    ? context.phases.map(p => `${p.name}${p.durationWeeks ? ` (${p.durationWeeks} weeks)` : ''}`).join(', ')
    : 'Not provided';

  const techStr = context.technologies?.length
    ? context.technologies.slice(0, 8).join(', ')
    : 'Not provided';

  const alreadyCoveredStr = alreadyTypes.length
    ? `\nALREADY INCLUDED (do NOT duplicate these types): ${alreadyTypes.join(', ')}`
    : '';

  return `Suggest up to ${slots} additional diagram(s) for this proposal volume.
${alreadyCoveredStr}

VOLUME NAME: ${volumeName}
VOLUME TYPE: ${volumeType}
COMPANY: ${context.companyName}

KEY PERSONNEL:
${personnelStr}

SERVICE AREAS / TASK AREAS:
${serviceAreasStr}

PROJECT PHASES:
${phasesStr}

TECHNOLOGIES:
${techStr}

${context.additionalContext ? `ADDITIONAL CONTEXT:\n${context.additionalContext}\n` : ''}
VOLUME CONTENT PREVIEW (first 4000 chars):
${contentPreview}

${SCHEMA_HINT}

${EXAMPLE}

CRITICAL: Every diagram title MUST be specific to the contract content.
NOT "Bar Chart" — instead "Staffing Distribution Across 12 METC Service Areas".
NOT "Network Diagram" — instead "Proposed Zero Trust Network Architecture — METC SIPR/NIPR".
NOT "Capability Matrix" — instead "TechVision Technical Capability Assessment by PWS Task Area".
The title should read like a figure caption in a published government proposal.

Suggest ${slots} diagram(s) that would add visual value to this specific volume beyond those already included.
Use the actual data provided above (personnel names, service areas, phases) to populate diagram data.
Return ONLY the JSON array. If no additional diagrams are needed, return [].`;
}

// ===== PLACEHOLDER DATA BUILDERS =====
// These produce sensible default data payloads from available context.
// The AI suggestion call populates richer data — these are for required specs.

function buildPlaceholderData(
  type: DiagramType,
  request: DiagramSpecRequest,
  notes?: string
): any {
  const ctx = request.context;

  // Helper: use array only if non-empty, otherwise fallback
  const nonEmpty = <T>(arr: T[] | undefined | null, fallback: T[]): T[] =>
    arr && arr.length > 0 ? arr : fallback;

  switch (type) {
    case 'org-chart': {
      const nodes = (ctx.personnel || []).slice(0, 8).map((p, i) => ({
        id: `p${i}`,
        label: p.role,
        sublabel: p.name || undefined,
      }));
      return {
        type: 'org-chart',
        root: `${ctx.companyName} — Contract Team`,
        nodes: nodes.length > 0 ? nodes : [
          { id: 'pm', label: 'Program Manager' },
          { id: 'tl', label: 'Technical Lead', parentId: 'pm' },
        ],
      };
    }

    case 'gantt': {
      const phases = nonEmpty(ctx.phases, [
        { name: 'Planning & Preparation' },
        { name: 'Knowledge Transfer' },
        { name: 'Parallel Operations' },
        { name: 'Full Assumption' },
      ]).slice(0, 6);
      return {
        type: 'gantt',
        headers: ['Phase', ...phases.map((_, i) => `Month ${i + 1}`)],
        phases: phases.map((p, i) => ({
          name: p.name,
          startCol: i,
          durationCols: 1,
          milestone: i === phases.length - 1,
        })),
      };
    }

    case 'process-flow': {
      const steps = nonEmpty(ctx.serviceAreas, ['Initiate', 'Plan', 'Execute', 'Monitor', 'Close']).slice(0, 7);
      const nodes = steps.map((s, i) => ({ id: `s${i}`, label: s, shape: 'rect' as const }));
      const edges = nodes.slice(0, -1).map((n, i) => ({ from: n.id, to: nodes[i + 1].id }));
      return { type: 'process-flow', nodes, edges };
    }

    case 'raci-matrix': {
      const personnelRoles = (ctx.personnel || []).slice(0, 4).map(p => p.role);
      const roles = nonEmpty(personnelRoles, ['PM', 'Tech Lead', 'QA', 'COTR']);
      const activities = nonEmpty(ctx.serviceAreas, ['Planning', 'Execution', 'Reporting', 'QA']).slice(0, 5);
      return {
        type: 'raci-matrix',
        roles,
        rows: activities.map(a => ({
          activity: a,
          assignments: Object.fromEntries(roles.map((r, i) => [r, i === 0 ? 'A' : i === 1 ? 'R' : 'C'])),
        })),
      };
    }

    case 'network-diagram': {
      const techs = nonEmpty(ctx.technologies, ['Application', 'Database', 'Network', 'Security']).slice(0, 6);
      const nodes = techs.map((t, i) => ({ id: `n${i}`, label: t }));
      const edges = nodes.slice(0, -1).map((n, i) => ({ from: n.id, to: nodes[i + 1].id }));
      return { type: 'network-diagram', nodes, edges };
    }

    case 'bar-chart': {
      const labels = nonEmpty(ctx.serviceAreas, ['Q1', 'Q2', 'Q3', 'Q4']).slice(0, 5);
      return {
        type: 'bar-chart',
        orientation: 'horizontal',
        series: labels.map((l, i) => ({ label: l, value: 70 + i * 5 })),
      };
    }

    case 'radar-chart': {
      const axes = ['Technical', 'Management', 'Past Performance', 'Price', 'Innovation'];
      return {
        type: 'radar-chart',
        axes,
        series: [{ name: ctx.companyName, values: axes.map(() => 75 + Math.floor(Math.random() * 20)) }],
      };
    }

    case 'swimlane': {
      const personnelLanes = (ctx.personnel || []).slice(0, 3).map(p => p.role);
      const lanes = nonEmpty(personnelLanes, ['Government', 'Contractor', 'Subcontractor']);
      const steps = nonEmpty(ctx.serviceAreas, ['Request', 'Review', 'Approve', 'Execute']).slice(0, 4);
      return {
        type: 'swimlane',
        lanes,
        steps: steps.map((s, i) => ({
          id: `step${i}`,
          label: s,
          lane: lanes[i % lanes.length],
          nextIds: i < steps.length - 1 ? [`step${i + 1}`] : [],
        })),
      };
    }

    case 'comparison-table': {
      const areas = nonEmpty(ctx.serviceAreas, ['Response Time', 'Staffing', 'Technology', 'Reporting']).slice(0, 4);
      return {
        type: 'comparison-table',
        left_header: 'Current State',
        right_header: 'Proposed State',
        rows: areas.map(a => ({
          category: a,
          left_value: 'Existing approach',
          right_value: 'Our improved approach',
          improvement: true,
        })),
      };
    }

    case 'milestone-timeline': {
      const phases = nonEmpty(ctx.phases, [
        { name: 'Contract Award' },
        { name: 'Kick-off Meeting' },
        { name: 'Transition Complete' },
        { name: 'Full Operations' },
      ]).slice(0, 8);
      return {
        type: 'milestone-timeline',
        milestones: phases.map((p, i) => ({
          label: p.name,
          date: `Month ${i + 1}`,
          category: i === 0 ? 'milestone' as const : i === phases.length - 1 ? 'deliverable' as const : 'phase' as const,
        })),
      };
    }

    case 'heat-map': {
      const xLabels = nonEmpty(ctx.serviceAreas, ['Area 1', 'Area 2', 'Area 3', 'Area 4']).slice(0, 5);
      const yLabels = nonEmpty(ctx.technologies, ['Capability A', 'Capability B', 'Capability C']).slice(0, 5);
      const cells: Array<{ x: number; y: number; value: number }> = [];
      for (let y = 0; y < yLabels.length; y++) {
        for (let x = 0; x < xLabels.length; x++) {
          cells.push({ x, y, value: 40 + Math.floor(Math.random() * 60) });
        }
      }
      return { type: 'heat-map', x_labels: xLabels, y_labels: yLabels, cells };
    }

    case 'quadrant-chart': {
      const items = nonEmpty(ctx.serviceAreas, ['Initiative A', 'Initiative B', 'Initiative C', 'Initiative D']).slice(0, 6);
      return {
        type: 'quadrant-chart',
        x_axis_label: 'Implementation Effort',
        y_axis_label: 'Business Impact',
        quadrant_labels: ['High Impact / Low Effort', 'High Impact / High Effort', 'Low Impact / Low Effort', 'Low Impact / High Effort'] as [string, string, string, string],
        items: items.map((label, i) => ({
          label,
          x: 20 + (i * 15) % 80,
          y: 30 + ((i * 20 + 10) % 70),
        })),
      };
    }

    case 'capability-matrix': {
      const categories = nonEmpty(ctx.serviceAreas, ['Planning', 'Execution', 'Support', 'Analysis']).slice(0, 5);
      const caps = nonEmpty(ctx.technologies, ['Cloud', 'Security', 'DevOps', 'Data']).slice(0, 5);
      return {
        type: 'capability-matrix',
        categories,
        capabilities: caps.map(name => ({
          name,
          levels: categories.map(() => 2 + Math.floor(Math.random() * 3)),
        })),
      };
    }

    default:
      return { type };
  }
}

// ===== UTILITIES =====

const DIAGRAM_TYPE_ALIASES: Record<string, DiagramType> = {
  'org chart': 'org-chart',
  'organizational chart': 'org-chart',
  'organization chart': 'org-chart',
  'orgchart': 'org-chart',
  'org_chart': 'org-chart',
  'gantt chart': 'gantt',
  'timeline': 'gantt',
  'schedule': 'gantt',
  'process flow': 'process-flow',
  'flowchart': 'process-flow',
  'flow chart': 'process-flow',
  'workflow': 'process-flow',
  'conops': 'process-flow',
  'conops diagram': 'process-flow',
  'bar chart': 'bar-chart',
  'bar graph': 'bar-chart',
  'chart': 'bar-chart',
  'raci': 'raci-matrix',
  'raci matrix': 'raci-matrix',
  'responsibility matrix': 'raci-matrix',
  'network diagram': 'network-diagram',
  'architecture diagram': 'network-diagram',
  'system diagram': 'network-diagram',
  'topology': 'network-diagram',
  'radar chart': 'radar-chart',
  'spider chart': 'radar-chart',
  'capability chart': 'radar-chart',
  'swimlane': 'swimlane',
  'swim lane': 'swimlane',
  'cross-functional': 'swimlane',
  'comparison table': 'comparison-table',
  'comparison': 'comparison-table',
  'side by side': 'comparison-table',
  'milestone timeline': 'milestone-timeline',
  'milestones': 'milestone-timeline',
  'key dates': 'milestone-timeline',
  'heat map': 'heat-map',
  'heatmap': 'heat-map',
  'risk matrix': 'heat-map',
  'quadrant chart': 'quadrant-chart',
  'quadrant': 'quadrant-chart',
  '2x2 matrix': 'quadrant-chart',
  'effort impact': 'quadrant-chart',
  'capability matrix': 'capability-matrix',
  'skills matrix': 'capability-matrix',
  'competency matrix': 'capability-matrix',
};

function normalizeDiagramType(raw: string): DiagramType {
  const lower = raw.toLowerCase().trim();
  return (DIAGRAM_TYPE_ALIASES[lower] as DiagramType) ?? (lower as DiagramType) ?? 'process-flow';
}

function deriveKeywordsFromType(type: DiagramType): string[] {
  const map: Record<DiagramType, string[]> = {
    'org-chart': ['organizational', 'org', 'structure', 'management', 'personnel'],
    'gantt': ['transition', 'timeline', 'schedule', 'phase', 'plan'],
    'process-flow': ['process', 'workflow', 'approach', 'methodology', 'quality'],
    'bar-chart': ['performance', 'metrics', 'staffing', 'comparison', 'data'],
    'raci-matrix': ['responsibility', 'raci', 'roles', 'assignment', 'accountability'],
    'network-diagram': ['architecture', 'network', 'infrastructure', 'system', 'technology'],
    'radar-chart': ['capability', 'strength', 'evaluation', 'criteria', 'assessment'],
    'swimlane': ['process', 'workflow', 'coordination', 'integration', 'collaboration'],
    'data-table': ['staffing', 'labor', 'basis of estimate', 'boe', 'rate', 'pricing', 'table'],
    'comparison-table': ['comparison', 'current state', 'proposed', 'requirement', 'capability'],
    'milestone-timeline': ['milestone', 'key dates', 'deliverable', 'schedule', 'timeline'],
    'heat-map': ['risk', 'impact', 'coverage', 'intensity', 'matrix'],
    'quadrant-chart': ['priority', 'effort', 'impact', 'analysis', 'quadrant'],
    'capability-matrix': ['capability', 'skill', 'competency', 'assessment', 'proficiency'],
  };
  return map[type] ?? [type];
}

function parseSpecsFromResponse(rawText: string): DiagramSpec[] {
  try {
    let clean = rawText.trim();
    clean = clean.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const start = clean.indexOf('[');
    const end = clean.lastIndexOf(']');
    if (start === -1 || end === -1 || end < start) return [];
    const parsed = JSON.parse(clean.slice(start, end + 1));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(s =>
      s &&
      typeof s.id === 'string' &&
      typeof s.type === 'string' &&
      typeof s.title === 'string' &&
      s.data &&
      s.placement?.sectionKeywords
    ) as DiagramSpec[];
  } catch {
    return [];
  }
}

// ===== EXTRACTION HELPER =====

/**
 * Extract RFP diagram requirements from compliance extractions for a specific volume.
 * Pass the result as `requiredFromRfp` in DiagramSpecRequest.
 */
export function extractRfpDiagramRequirements(
  extractions: ComplianceExtractionsByCategory,
  volumeName: string
): RfpDiagramRequirement[] {
  const sectionLRows = extractions.section_l || [];
  const diagReqRow = sectionLRows.find(r => r.field_name === 'diagram_requirements');
  if (!diagReqRow?.field_value) return [];

  const requirements = diagReqRow.field_value as SectionLFields['diagram_requirements'];
  if (!Array.isArray(requirements)) return [];

  // Return requirements that apply to this volume or to all volumes
  return requirements.filter(r =>
    !r.applies_to_volume ||
    r.applies_to_volume.toLowerCase().includes(volumeName.toLowerCase()) ||
    volumeName.toLowerCase().includes(r.applies_to_volume.toLowerCase())
  );
}

/**
 * Extract PM diagram requests from strategy for a specific volume.
 * Pass the result as `requiredFromStrategy` in DiagramSpecRequest.
 */
export function extractStrategyDiagramRequests(
  strategy: { volume_strategies: Array<{ volume_name: string; diagram_requests?: VolumeDiagramRequest[] }> } | null | undefined,
  volumeName: string
): VolumeDiagramRequest[] {
  if (!strategy?.volume_strategies) return [];
  const volStrategy = strategy.volume_strategies.find(
    v => v.volume_name.toLowerCase() === volumeName.toLowerCase()
  );
  return volStrategy?.diagram_requests || [];
}
