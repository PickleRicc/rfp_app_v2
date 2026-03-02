import { anthropic, MODEL } from "@/lib/anthropic/client";
import { parseClaudeJSON } from "@/lib/anthropic/json-extractor";

export type GeneratableField =
  | "corporate_overview"
  | "core_services_summary"
  | "enterprise_win_themes"
  | "key_differentiators_summary"
  | "standard_management_approach"
  | "elevator_pitch_and_descriptions";

export interface CompanyContext {
  companyName: string;
  legalName?: string;
  cageCode?: string;
  ueiNumber?: string;
  yearFounded?: number;
  employeeCount?: number;
  website?: string;
  corporateOverview?: string;
  coreServicesSummary?: string;
  elevatorPitch?: string;
  fullDescription?: string;
  pastPerformance: {
    contract_name: string;
    client_agency: string;
    contract_value: number;
    role: string;
    overview: string;
    task_areas: string[];
    tools_used: string[];
    relevance_tags: string[];
  }[];
  certifications: { certification_type: string }[];
  naicsCodes: { code: string; title: string; is_primary: boolean }[];
  contractVehicles: { vehicle_name: string; vehicle_type: string }[];
}

export interface ElevatorPitchBundle {
  elevator_pitch: string;
  full_description: string;
  mission_statement: string;
  vision_statement: string;
  core_values: string[];
}

function buildContextBlock(ctx: CompanyContext): string {
  const parts: string[] = [];

  parts.push(`Company Name: ${ctx.companyName}`);
  if (ctx.legalName) parts.push(`Legal Name: ${ctx.legalName}`);
  if (ctx.yearFounded) parts.push(`Founded: ${ctx.yearFounded}`);
  if (ctx.employeeCount) parts.push(`Employees: ${ctx.employeeCount}`);
  if (ctx.website) parts.push(`Website: ${ctx.website}`);

  if (ctx.naicsCodes.length > 0) {
    const primary = ctx.naicsCodes.find((n) => n.is_primary);
    parts.push(
      `NAICS Codes: ${ctx.naicsCodes.map((n) => `${n.code} - ${n.title}${n.is_primary ? " (Primary)" : ""}`).join("; ")}`
    );
    if (primary) parts.push(`Primary Industry: ${primary.title}`);
  }

  if (ctx.certifications.length > 0) {
    parts.push(
      `Certifications: ${ctx.certifications.map((c) => c.certification_type).join(", ")}`
    );
  }

  if (ctx.contractVehicles.length > 0) {
    parts.push(
      `Contract Vehicles: ${ctx.contractVehicles.map((v) => `${v.vehicle_name} (${v.vehicle_type})`).join(", ")}`
    );
  }

  if (ctx.corporateOverview) {
    parts.push(`\nExisting Corporate Overview:\n${ctx.corporateOverview}`);
  }
  if (ctx.coreServicesSummary) {
    parts.push(
      `\nExisting Core Services Summary:\n${ctx.coreServicesSummary}`
    );
  }
  if (ctx.elevatorPitch) {
    parts.push(`\nExisting Elevator Pitch:\n${ctx.elevatorPitch}`);
  }

  if (ctx.pastPerformance.length > 0) {
    parts.push("\n--- PAST PERFORMANCE ---");
    for (const pp of ctx.pastPerformance.slice(0, 10)) {
      parts.push(
        `\nContract: ${pp.contract_name}\nAgency: ${pp.client_agency}\nValue: $${pp.contract_value.toLocaleString()}\nRole: ${pp.role}\nOverview: ${pp.overview}\nTask Areas: ${pp.task_areas.join(", ")}\nTools: ${pp.tools_used.join(", ")}\nRelevance: ${pp.relevance_tags.join(", ")}`
      );
    }
  }

  return parts.join("\n");
}

const FIELD_PROMPTS: Record<
  GeneratableField,
  { system: string; user: (ctx: string) => string }
> = {
  corporate_overview: {
    system:
      "You are a federal government contracting proposal writer. Write corporate overviews for capability statements and proposal volumes.",
    user: (ctx) =>
      `Based on the company information and past performance below, write a compelling corporate overview for a federal contractor. This should be 100-400 words, written in third person, professional tone. Focus on the company's mission, core capabilities, federal experience, and what sets them apart.

Return ONLY the text, no JSON wrapping.

${ctx}`,
  },

  core_services_summary: {
    system:
      "You are a federal government contracting proposal writer specializing in capability statements.",
    user: (ctx) =>
      `Based on the company information and past performance below, write a concise core services summary. This should be 60-250 words, listing and briefly describing the company's primary service offerings relevant to federal clients. Group related services together.

Return ONLY the text, no JSON wrapping.

${ctx}`,
  },

  enterprise_win_themes: {
    system:
      "You are a federal capture and proposal strategist who develops win themes for government proposals.",
    user: (ctx) =>
      `Based on the company information and past performance below, generate 5-8 enterprise-level win themes. Each theme should be a concise statement (under 100 characters) that communicates a competitive advantage.

Examples of good win themes: "Proven FERC modernization expertise with 15+ years of agency-specific experience", "98% employee retention rate ensures continuity of institutional knowledge"

Return a JSON array of strings. Example: ["Theme 1", "Theme 2", ...]

${ctx}`,
  },

  key_differentiators_summary: {
    system:
      "You are a federal proposal strategist focused on competitive differentiation.",
    user: (ctx) =>
      `Based on the company information and past performance below, write a key differentiators summary. This should be 60-250 words describing what uniquely positions this company to win federal contracts — specific advantages competitors lack. Reference concrete evidence from past performance.

Return ONLY the text, no JSON wrapping.

${ctx}`,
  },

  standard_management_approach: {
    system:
      "You are a federal project management expert who writes management approach sections for proposals.",
    user: (ctx) =>
      `Based on the company information and past performance below, write a standard management approach description. This should be 100-400 words covering the company's typical approach to managing federal contracts: governance, quality assurance, risk management, communication, staffing, and transition methodology. Reference relevant frameworks and tools from their past performance.

Return ONLY the text, no JSON wrapping.

${ctx}`,
  },

  elevator_pitch_and_descriptions: {
    system:
      "You are a federal contracting business development expert who crafts company positioning statements.",
    user: (ctx) =>
      `Based on the company information and past performance below, generate the following as a JSON object:

{
  "elevator_pitch": "A 1-2 sentence pitch (max 500 characters) that captures who the company is and what they do for federal clients",
  "full_description": "A comprehensive company description (300-1500 characters) suitable for capability statements",
  "mission_statement": "A mission statement (max 300 characters)",
  "vision_statement": "A vision statement (max 300 characters)",
  "core_values": ["array", "of", "5-7", "core values"]
}

Return ONLY valid JSON matching this structure.

${ctx}`,
  },
};

export async function generateCapabilitiesField(
  field: GeneratableField,
  context: CompanyContext
): Promise<string | string[] | ElevatorPitchBundle> {
  const contextBlock = buildContextBlock(context);
  const prompt = FIELD_PROMPTS[field];

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system: prompt.system,
    messages: [{ role: "user", content: prompt.user(contextBlock) }],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  if (field === "enterprise_win_themes") {
    return parseClaudeJSON<string[]>(text);
  }

  if (field === "elevator_pitch_and_descriptions") {
    return parseClaudeJSON<ElevatorPitchBundle>(text);
  }

  return text.trim();
}
