interface RfpDocumentContent {
  filename: string;
  document_type: string;
  text: string;
}

interface PastPerformanceDocContent {
  filename: string;
  text: string;
}

interface DatabasePastPerformance {
  contract_nickname: string;
  contract_name: string;
  contract_number: string;
  client_agency: string;
  contract_type: string;
  contract_value: number;
  role: string;
  team_size: number;
  start_date: string;
  end_date: string;
  overview: string;
  description_of_effort: string;
  task_areas: string[];
  tools_used: string[];
  achievements: Array<{ statement: string; metric_value: string; metric_type: string }>;
  relevance_tags: string[];
  cpars_rating?: {
    overall: string;
    quality?: string;
    schedule?: string;
    cost_control?: string;
    management?: string;
  };
}

export interface OpportunityAnalysisPromptData {
  mode: 'raw' | 'database';
  rfpDocuments: RfpDocumentContent[];
  pastPerformanceDocuments?: PastPerformanceDocContent[];
  databasePastPerformance?: DatabasePastPerformance[];
  companyName?: string;
  companyOverview?: string;
}

export function assembleOpportunityAnalysisPrompt(
  data: OpportunityAnalysisPromptData
): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = `You are an expert federal government contracting capture analyst. Your role is to evaluate whether a company should pursue a given opportunity (RFP/RFI/SOW) based on their past performance and capabilities.

You produce thorough, actionable opportunity confirmation analyses used by business development teams to make go/no-go decisions.

ANALYSIS METHODOLOGY:
1. Extract key requirements, evaluation criteria, and scope from the solicitation documents
2. Map each requirement against the provided past performance evidence
3. Identify strengths (direct experience matches), weaknesses (gaps), and risks
4. Evaluate go/no-go decision factors: incumbency, contract size match, clearance requirements, socioeconomic set-asides, geographic requirements, technical capability alignment
5. Score overall fit on a 0-100 scale
6. Provide a clear fit rating and actionable recommendations

SCORING CRITERIA:
- 80-100: Strong Fit — direct relevant experience, strong past performance alignment
- 60-79: Moderate Fit — good experience with some gaps that can be addressed
- 40-59: Weak Fit — significant gaps, would need teaming or capability development
- 0-39: Not Recommended — fundamental misalignment, high risk of non-competitive proposal

RESPONSE FORMAT:
Respond with a single JSON object (no markdown wrapping) matching this exact schema:
{
  "fit_rating": "strong_fit" | "moderate_fit" | "weak_fit" | "not_recommended",
  "score": <number 0-100>,
  "executive_summary": "<2-3 sentence high-level assessment>",
  "strengths": [
    {
      "title": "<short title>",
      "description": "<explanation>",
      "severity": "high" | "medium" | "low",
      "evidence": "<specific reference to past performance or capability>"
    }
  ],
  "weaknesses": [
    {
      "title": "<short title>",
      "description": "<explanation>",
      "severity": "high" | "medium" | "low",
      "evidence": "<what's missing or misaligned>"
    }
  ],
  "risks": [
    {
      "title": "<short title>",
      "description": "<explanation>",
      "severity": "high" | "medium" | "low",
      "evidence": "<risk indicator>"
    }
  ],
  "recommendations": ["<actionable recommendation>", ...],
  "past_performance_alignment": [
    {
      "past_performance_title": "<contract name>",
      "rfp_requirement": "<requirement it maps to>",
      "alignment_score": <number 0-100>,
      "reasoning": "<why this maps>"
    }
  ],
  "requirement_coverage": [
    {
      "requirement": "<extracted requirement>",
      "source_section": "<RFP section reference>",
      "coverage_status": "fully_covered" | "partially_covered" | "not_covered",
      "supporting_evidence": "<what past performance supports this>"
    }
  ],
  "go_no_go_factors": [
    {
      "factor": "<factor name>",
      "assessment": "go" | "caution" | "no_go",
      "rationale": "<explanation>"
    }
  ],
  "competitive_positioning": "<assessment of competitive position>",
  "estimated_win_probability": "<Low/Medium/High with percentage range>"
}

Be thorough but concise. Focus on actionable insights that help the business development team make informed decisions.`;

  let userPrompt = '';

  // RFP documents section
  userPrompt += `=== SOLICITATION DOCUMENTS ===\n\n`;
  for (const doc of data.rfpDocuments) {
    userPrompt += `--- ${doc.filename} (${doc.document_type}) ---\n`;
    const truncated = doc.text.length > 50000
      ? doc.text.slice(0, 50000) + '\n\n[TRUNCATED — document exceeds 50,000 characters]'
      : doc.text;
    userPrompt += truncated + '\n\n';
  }

  // Past performance section
  if (data.mode === 'raw' && data.pastPerformanceDocuments) {
    userPrompt += `=== PAST PERFORMANCE DOCUMENTS (Raw Upload) ===\n\n`;
    for (const doc of data.pastPerformanceDocuments) {
      userPrompt += `--- ${doc.filename} ---\n`;
      const truncated = doc.text.length > 30000
        ? doc.text.slice(0, 30000) + '\n\n[TRUNCATED — document exceeds 30,000 characters]'
        : doc.text;
      userPrompt += truncated + '\n\n';
    }
  } else if (data.mode === 'database' && data.databasePastPerformance) {
    userPrompt += `=== COMPANY PAST PERFORMANCE (Database Records) ===\n`;
    if (data.companyName) {
      userPrompt += `Company: ${data.companyName}\n`;
    }
    if (data.companyOverview) {
      userPrompt += `Overview: ${data.companyOverview}\n`;
    }
    userPrompt += '\n';

    for (const pp of data.databasePastPerformance) {
      userPrompt += `--- ${pp.contract_nickname || pp.contract_name} ---\n`;
      userPrompt += `Contract: ${pp.contract_name} (${pp.contract_number})\n`;
      userPrompt += `Client: ${pp.client_agency}\n`;
      userPrompt += `Type: ${pp.contract_type} | Value: $${pp.contract_value.toLocaleString()}\n`;
      userPrompt += `Role: ${pp.role} | Team Size: ${pp.team_size}\n`;
      userPrompt += `Period: ${pp.start_date} — ${pp.end_date}\n`;
      userPrompt += `Overview: ${pp.overview}\n`;
      userPrompt += `Effort: ${pp.description_of_effort}\n`;

      if (pp.task_areas.length > 0) {
        userPrompt += `Task Areas: ${pp.task_areas.join(', ')}\n`;
      }
      if (pp.tools_used.length > 0) {
        userPrompt += `Tools: ${pp.tools_used.join(', ')}\n`;
      }
      if (pp.relevance_tags.length > 0) {
        userPrompt += `Relevance Tags: ${pp.relevance_tags.join(', ')}\n`;
      }
      if (pp.achievements.length > 0) {
        userPrompt += `Achievements:\n`;
        for (const a of pp.achievements) {
          userPrompt += `  - ${a.statement} (${a.metric_type}: ${a.metric_value})\n`;
        }
      }
      if (pp.cpars_rating) {
        userPrompt += `CPARS: Overall=${pp.cpars_rating.overall}`;
        if (pp.cpars_rating.quality) userPrompt += `, Quality=${pp.cpars_rating.quality}`;
        if (pp.cpars_rating.schedule) userPrompt += `, Schedule=${pp.cpars_rating.schedule}`;
        if (pp.cpars_rating.cost_control) userPrompt += `, Cost=${pp.cpars_rating.cost_control}`;
        userPrompt += '\n';
      }
      userPrompt += '\n';
    }
  }

  userPrompt += `\n=== INSTRUCTION ===\nAnalyze the solicitation documents above against the provided past performance. Produce a comprehensive opportunity confirmation analysis as a JSON object matching the schema described in your instructions.\n`;

  return { systemPrompt, userPrompt };
}
