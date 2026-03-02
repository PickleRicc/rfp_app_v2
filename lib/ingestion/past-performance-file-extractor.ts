import { anthropic, MODEL } from "@/lib/anthropic/client";
import { parseClaudeJSON } from "@/lib/anthropic/json-extractor";

export interface ExtractedPastPerformance {
  contract_nickname: string;
  contract_name: string;
  contract_number: string;
  task_order_number?: string;
  client_agency: string;
  client_office?: string;
  contract_type: "FFP" | "T&M" | "Cost-Plus" | "Labor Hour" | "Hybrid";
  contract_value: number;
  annual_value?: number;
  start_date: string;
  end_date: string;
  base_period?: string;
  option_periods?: number;
  role: "Prime" | "Subcontractor" | "Joint Venture" | "Teaming Partner";
  percentage_of_work?: number;
  prime_contractor?: string;
  team_size: number;
  place_of_performance: string;
  client_poc: {
    name: string;
    title: string;
    phone: string;
    email: string;
    note?: string;
  };
  alternate_poc?: {
    name: string;
    title: string;
    phone: string;
    email: string;
  };
  cpars_rating?: {
    overall?: string;
    quality?: string;
    schedule?: string;
    cost_control?: string;
    management?: string;
    regulatory_compliance?: string;
    date_of_rating?: string;
  };
  customer_feedback?: string;
  overview: string;
  description_of_effort: string;
  task_areas: string[];
  tools_used: string[];
  achievements: {
    statement: string;
    metric_value: string;
    metric_type: string;
  }[];
  relevance_tags: string[];
}

const SYSTEM_PROMPT = `You are an expert federal contracting data extractor. You extract structured past performance data from documents (proposals, capability statements, contract summaries, CPARs reports, etc.) into a precise JSON schema.

CRITICAL RULES:
- Extract EVERY past performance contract/project found in the document as a separate object.
- Use exact values from the document wherever possible.
- For fields you cannot find in the document, use the specified defaults.
- contract_type MUST be one of: "FFP", "T&M", "Cost-Plus", "Labor Hour", "Hybrid"
- role MUST be one of: "Prime", "Subcontractor", "Joint Venture", "Teaming Partner"
- achievement metric_type MUST be one of: "Cost Savings", "Time Savings", "Quality Improvement", "Efficiency Gain", "Customer Satisfaction", "Compliance", "Other"
- Dates should be in YYYY-MM-DD format.
- contract_value should be a number (no dollar signs or commas).
- overview should be a concise summary (max 500 characters).
- description_of_effort should be a detailed description (max 2000 characters).`;

function buildUserPrompt(text: string, filename: string): string {
  return `Extract all past performance records from this document. Return a JSON array of objects.

For each contract/project found, extract these fields:
- contract_nickname: short name for the contract (default: infer from contract name)
- contract_name: full contract/project name (default: "Extracted from ${filename}")
- contract_number: contract number (default: "TBD")
- task_order_number: task order number if applicable
- client_agency: government agency or client name (default: "TBD")
- client_office: specific office within the agency
- contract_type: one of FFP, T&M, Cost-Plus, Labor Hour, Hybrid (default: "FFP")
- contract_value: total contract value as a number (default: 0)
- annual_value: annual value if mentioned
- start_date: contract start date as YYYY-MM-DD (default: "2020-01-01")
- end_date: contract end date as YYYY-MM-DD or "Ongoing" (default: "Ongoing")
- base_period: base period description
- option_periods: number of option periods
- role: one of Prime, Subcontractor, Joint Venture, Teaming Partner (default: "Prime")
- percentage_of_work: percentage of work performed
- prime_contractor: prime contractor name if subcontractor
- team_size: number of team members (default: 1)
- place_of_performance: location of work (default: "TBD")
- client_poc: { name, title, phone, email } (default all "TBD" or "")
- cpars_rating: { overall, quality, schedule, cost_control, management } if mentioned
- customer_feedback: any customer quotes or feedback
- overview: concise 1-2 sentence summary of the contract (max 500 chars)
- description_of_effort: detailed description of work performed (max 2000 chars)
- task_areas: array of task/service areas (default: ["General"])
- tools_used: array of tools/technologies used
- achievements: array of { statement, metric_value, metric_type } (default: [{"statement": "Successfully delivered contract requirements", "metric_value": "100%", "metric_type": "Quality Improvement"}])
- relevance_tags: array of relevance keywords (default: ["Federal Contracting"])

Return ONLY a JSON array. Example: [{ ... }, { ... }]

DOCUMENT TEXT:
${text.slice(0, 80000)}`;
}

function applyDefaults(
  raw: Partial<ExtractedPastPerformance>,
  filename: string
): ExtractedPastPerformance {
  const contractName =
    raw.contract_name || `Extracted from ${filename}`;
  return {
    contract_nickname:
      raw.contract_nickname || contractName.slice(0, 60),
    contract_name: contractName,
    contract_number: raw.contract_number || "TBD",
    task_order_number: raw.task_order_number || undefined,
    client_agency: raw.client_agency || "TBD",
    client_office: raw.client_office || undefined,
    contract_type: validContractType(raw.contract_type),
    contract_value:
      typeof raw.contract_value === "number" ? raw.contract_value : 0,
    annual_value:
      typeof raw.annual_value === "number" ? raw.annual_value : undefined,
    start_date: raw.start_date || "2020-01-01",
    end_date: raw.end_date || "Ongoing",
    base_period: raw.base_period || undefined,
    option_periods:
      typeof raw.option_periods === "number"
        ? raw.option_periods
        : undefined,
    role: validRole(raw.role),
    percentage_of_work:
      typeof raw.percentage_of_work === "number"
        ? raw.percentage_of_work
        : undefined,
    prime_contractor: raw.prime_contractor || undefined,
    team_size: typeof raw.team_size === "number" ? raw.team_size : 1,
    place_of_performance: raw.place_of_performance || "TBD",
    client_poc: {
      name: raw.client_poc?.name || "TBD",
      title: raw.client_poc?.title || "",
      phone: raw.client_poc?.phone || "",
      email: raw.client_poc?.email || "",
      note: raw.client_poc?.note || undefined,
    },
    alternate_poc: raw.alternate_poc || undefined,
    cpars_rating: raw.cpars_rating || undefined,
    customer_feedback: raw.customer_feedback || undefined,
    overview: (raw.overview || `Past performance extracted from ${filename}`).slice(0, 500),
    description_of_effort: (
      raw.description_of_effort ||
      "Details extracted from uploaded document. Please review and update as needed."
    ).slice(0, 2000),
    task_areas:
      Array.isArray(raw.task_areas) && raw.task_areas.length > 0
        ? raw.task_areas
        : ["General"],
    tools_used: Array.isArray(raw.tools_used) ? raw.tools_used : [],
    achievements:
      Array.isArray(raw.achievements) && raw.achievements.length > 0
        ? raw.achievements.map((a) => ({
            statement: a.statement || "Requirement delivered",
            metric_value: a.metric_value || "N/A",
            metric_type: validMetricType(a.metric_type),
          }))
        : [
            {
              statement: "Successfully delivered contract requirements",
              metric_value: "100%",
              metric_type: "Quality Improvement",
            },
          ],
    relevance_tags:
      Array.isArray(raw.relevance_tags) && raw.relevance_tags.length > 0
        ? raw.relevance_tags
        : ["Federal Contracting"],
  };
}

const VALID_CONTRACT_TYPES = [
  "FFP",
  "T&M",
  "Cost-Plus",
  "Labor Hour",
  "Hybrid",
] as const;
function validContractType(
  val: unknown
): ExtractedPastPerformance["contract_type"] {
  if (
    typeof val === "string" &&
    VALID_CONTRACT_TYPES.includes(val as (typeof VALID_CONTRACT_TYPES)[number])
  ) {
    return val as ExtractedPastPerformance["contract_type"];
  }
  return "FFP";
}

const VALID_ROLES = [
  "Prime",
  "Subcontractor",
  "Joint Venture",
  "Teaming Partner",
] as const;
function validRole(val: unknown): ExtractedPastPerformance["role"] {
  if (
    typeof val === "string" &&
    VALID_ROLES.includes(val as (typeof VALID_ROLES)[number])
  ) {
    return val as ExtractedPastPerformance["role"];
  }
  return "Prime";
}

const VALID_METRIC_TYPES = [
  "Cost Savings",
  "Time Savings",
  "Quality Improvement",
  "Efficiency Gain",
  "Customer Satisfaction",
  "Compliance",
  "Other",
];
function validMetricType(val: unknown): string {
  if (typeof val === "string" && VALID_METRIC_TYPES.includes(val)) {
    return val;
  }
  return "Other";
}

export async function extractPastPerformanceFromText(
  text: string,
  filename: string
): Promise<ExtractedPastPerformance[]> {
  if (!text || text.trim().length < 50) {
    throw new Error("Document text is too short to extract past performance data");
  }

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: buildUserPrompt(text, filename),
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  const parsed = parseClaudeJSON<Partial<ExtractedPastPerformance>[]>(
    content.text
  );

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error(
      "No past performance records could be extracted from the document"
    );
  }

  return parsed.map((raw) => applyDefaults(raw, filename));
}
