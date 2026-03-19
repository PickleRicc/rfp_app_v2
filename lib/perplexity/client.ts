/**
 * Perplexity API Client — Company Research
 *
 * Uses Perplexity's sonar model to do deep web research on a company
 * before a sales call. Pulls leadership, recent wins, news, partnerships,
 * competitive landscape, and tech stack.
 *
 * Docs: https://docs.perplexity.ai/
 */

const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';
const MODEL = 'sonar';

function getApiKey(): string | null {
  return process.env.PERPLEXITY_API_KEY || null;
}

export interface PerplexityResearchResult {
  company_overview: string;
  leadership: string;
  recent_contracts_and_wins: string;
  partnerships_and_teaming: string;
  competitive_landscape: string;
  news_and_developments: string;
  technology_and_capabilities: string;
  financial_health: string;
  recommendations_for_engagement: string;
  sources: string[];
  raw_response: string;
}

/**
 * Run a Perplexity search query and return the text response.
 */
async function query(prompt: string, systemPrompt: string): Promise<{ text: string; citations: string[] }> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn('[perplexity] PERPLEXITY_API_KEY not configured');
    return { text: '', citations: [] };
  }

  const res = await fetch(PERPLEXITY_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
      max_tokens: 4096,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.error(`[perplexity] API error (${res.status}):`, errText.slice(0, 500));
    throw new Error(`Perplexity API error: ${res.status}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || '';
  const citations: string[] = data.citations || [];

  return { text, citations };
}

/**
 * Research a company for pre-sales intelligence.
 * Returns structured sections that staff can review before a sales call.
 */
export async function researchCompany(params: {
  companyName: string;
  cageCode?: string;
  uei?: string;
  naicsCodes?: string[];
  location?: string;
  existingContext?: string;
}): Promise<PerplexityResearchResult> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return emptyResult('PERPLEXITY_API_KEY not configured — skipping web research.');
  }

  const identifiers = [
    params.companyName,
    params.cageCode ? `CAGE code: ${params.cageCode}` : '',
    params.uei ? `UEI: ${params.uei}` : '',
    params.naicsCodes?.length ? `NAICS codes: ${params.naicsCodes.join(', ')}` : '',
    params.location ? `Location: ${params.location}` : '',
  ].filter(Boolean).join('\n');

  const systemPrompt = `You are a federal contracting business development researcher. Your job is to provide comprehensive intelligence on a government contractor company to prepare staff for a sales call. Focus on actionable information that helps us understand:
- Who they are and what they do
- Who leads the company (key decision makers)
- What contracts they've recently won or lost
- Who they team with and who they compete against
- Any recent news, mergers, or strategic changes
- Their technical capabilities and differentiators
- How financially healthy they appear

Be specific. Include names, dollar amounts, contract numbers, and dates whenever possible. If you can't find information on a topic, say so clearly rather than guessing.`;

  const userPrompt = `Research this federal government contractor for a pre-sales engagement call:

${identifiers}

${params.existingContext ? `Additional context we already have:\n${params.existingContext}\n` : ''}

Provide your research in the following sections. Use markdown formatting with headers.

## Company Overview
Brief description of who they are, what they do, size, history.

## Leadership & Key Decision Makers
Names, titles, backgrounds of executives and BD leads.

## Recent Contracts & Wins
Specific contract awards, recompetes, task orders from the last 2 years.

## Partnerships & Teaming Arrangements
Known teaming partners, joint ventures, mentor-protege relationships.

## Competitive Landscape
Who they compete against, their differentiators, where they're vulnerable.

## News & Developments
Recent press releases, mergers, acquisitions, leadership changes, protests.

## Technology & Capabilities
Core technical competencies, platforms, certifications (CMMI, ISO, FedRAMP).

## Financial Health
Revenue estimates, growth trajectory, any concerns.

## Recommendations for Engagement
How we should approach this company — what pain points to address, what value proposition to lead with.`;

  try {
    const { text, citations } = await query(userPrompt, systemPrompt);

    if (!text) {
      return emptyResult('Perplexity returned empty response.');
    }

    // Parse sections from the markdown response
    const sections = parseResearchSections(text);

    return {
      company_overview: sections['Company Overview'] || '',
      leadership: sections['Leadership & Key Decision Makers'] || sections['Leadership'] || '',
      recent_contracts_and_wins: sections['Recent Contracts & Wins'] || sections['Recent Contracts'] || '',
      partnerships_and_teaming: sections['Partnerships & Teaming Arrangements'] || sections['Partnerships'] || '',
      competitive_landscape: sections['Competitive Landscape'] || '',
      news_and_developments: sections['News & Developments'] || sections['News'] || '',
      technology_and_capabilities: sections['Technology & Capabilities'] || sections['Technology'] || '',
      financial_health: sections['Financial Health'] || '',
      recommendations_for_engagement: sections['Recommendations for Engagement'] || sections['Recommendations'] || '',
      sources: citations,
      raw_response: text,
    };
  } catch (err) {
    console.error('[perplexity] researchCompany error:', err);
    return emptyResult(`Research failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

/**
 * Parse markdown sections from the Perplexity response.
 */
function parseResearchSections(text: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const lines = text.split('\n');
  let currentSection = '';
  let currentContent: string[] = [];

  for (const line of lines) {
    const headerMatch = line.match(/^##\s+(.+)/);
    if (headerMatch) {
      if (currentSection && currentContent.length) {
        sections[currentSection] = currentContent.join('\n').trim();
      }
      currentSection = headerMatch[1].trim();
      currentContent = [];
    } else if (currentSection) {
      currentContent.push(line);
    }
  }

  // Save last section
  if (currentSection && currentContent.length) {
    sections[currentSection] = currentContent.join('\n').trim();
  }

  return sections;
}

function emptyResult(reason: string): PerplexityResearchResult {
  return {
    company_overview: reason,
    leadership: '',
    recent_contracts_and_wins: '',
    partnerships_and_teaming: '',
    competitive_landscape: '',
    news_and_developments: '',
    technology_and_capabilities: '',
    financial_health: '',
    recommendations_for_engagement: '',
    sources: [],
    raw_response: reason,
  };
}
