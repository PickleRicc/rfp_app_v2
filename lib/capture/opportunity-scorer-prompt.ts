/**
 * AI Prompt — Opportunity Scorer
 *
 * Takes a parsed company profile and a batch of SAM.gov opportunities,
 * then scores each opportunity by relevance and provides actionable
 * solicitation information for the company to pursue.
 */

import type { ParsedCompanyProfile, SamOpportunity } from '@/lib/supabase/capture-types';

export interface OpportunityScorerInput {
  companyProfile: ParsedCompanyProfile;
  opportunities: SamOpportunity[];
}

export function assembleOpportunityScorerPrompt(input: OpportunityScorerInput): {
  systemPrompt: string;
  userPrompt: string;
} {
  const systemPrompt = `You are an expert federal government contracting business development analyst specializing in opportunity identification and pursuit decisions.

You are given a company profile and a list of active federal contract opportunities from SAM.gov. Your task is to:

1. Score each opportunity 0-100 based on how well it matches the company's capabilities, certifications, NAICS codes, agency experience, and contract vehicles
2. Provide specific match reasons explaining WHY each opportunity is relevant
3. Identify any risk factors (clearance requirements, geographic constraints, incumbent advantages, etc.)
4. Recommend a pursuit action for each opportunity
5. Sort results by relevance score (highest first)
6. Only include opportunities scoring 40 or above — discard poor matches entirely

SCORING CRITERIA:
- **90-100**: Perfect match — exact NAICS, matching set-aside, proven agency experience, capability alignment
- **70-89**: Strong match — NAICS match with relevant capabilities, some agency experience
- **50-69**: Good match — Related NAICS or capabilities, could be competitive
- **40-49**: Marginal — Some relevance, worth monitoring

PURSUIT ACTIONS:
- **pursue**: Score 70+, strong alignment, should actively respond
- **evaluate**: Score 50-69, worth deeper investigation
- **monitor**: Score 40-49, track for future
- **skip**: Score <40 (don't include these in output)

PURSUIT PRIORITY:
- **high**: Response deadline within 30 days + score 70+
- **medium**: Score 60+ or deadline within 60 days
- **low**: Everything else worth tracking

RESPONSE FORMAT — Return a single JSON object (no markdown wrapping):
{
  "scored_opportunities": [
    {
      "notice_id": "<SAM notice ID>",
      "relevance_score": <0-100>,
      "match_reasons": ["<specific reason>", ...],
      "naics_match": <boolean>,
      "set_aside_match": <boolean>,
      "capability_alignment": "<1-2 sentence explanation>",
      "risk_factors": ["<risk>", ...],
      "recommended_action": "pursue" | "evaluate" | "monitor",
      "pursuit_priority": "high" | "medium" | "low"
    }
  ],
  "search_summary": "<2-3 sentence summary of the overall opportunity landscape for this company>"
}

Be thorough and specific in match_reasons — reference specific company capabilities that align with the opportunity. For risk_factors, mention things like: incumbent contractor advantages, clearance requirements the company may not meet, geographic limitations, etc.`;

  let userPrompt = '';

  // Company profile section
  const cp = input.companyProfile;
  userPrompt += `=== COMPANY PROFILE ===\n`;
  userPrompt += `Company: ${cp.company_name}\n`;
  userPrompt += `Capabilities: ${cp.capabilities_summary}\n`;
  userPrompt += `NAICS Codes: ${cp.naics_codes.join(', ')}\n`;
  userPrompt += `Set-Aside Qualifications: ${cp.set_aside_codes.join(', ') || 'None'}\n`;
  userPrompt += `Business Size: ${cp.business_size || 'Unknown'}\n`;
  userPrompt += `Agency Experience: ${cp.agency_experience.join(', ') || 'None listed'}\n`;
  userPrompt += `Contract Vehicles: ${cp.contract_vehicles.join(', ') || 'None listed'}\n`;
  userPrompt += `Clearance: ${cp.clearance_level || 'Unknown'}\n`;
  if (cp.location?.state) userPrompt += `Location: ${cp.location.state}${cp.location.zip ? ' ' + cp.location.zip : ''}\n`;
  userPrompt += `Keywords: ${cp.keywords.join(', ')}\n\n`;

  // Opportunities section
  userPrompt += `=== ACTIVE FEDERAL OPPORTUNITIES (${input.opportunities.length} total) ===\n\n`;

  for (const opp of input.opportunities) {
    userPrompt += `--- ${opp.notice_id} ---\n`;
    userPrompt += `Title: ${opp.title}\n`;
    if (opp.solicitation_number) userPrompt += `Solicitation #: ${opp.solicitation_number}\n`;
    userPrompt += `Department: ${opp.department}`;
    if (opp.sub_tier) userPrompt += ` > ${opp.sub_tier}`;
    if (opp.office) userPrompt += ` > ${opp.office}`;
    userPrompt += '\n';
    userPrompt += `Type: ${opp.type}\n`;
    userPrompt += `Posted: ${opp.posted_date}\n`;
    if (opp.response_deadline) userPrompt += `Deadline: ${opp.response_deadline}\n`;
    if (opp.naics_code) userPrompt += `NAICS: ${opp.naics_code}\n`;
    if (opp.set_aside) userPrompt += `Set-Aside: ${opp.set_aside_description || opp.set_aside}\n`;
    if (opp.classification_code) userPrompt += `PSC: ${opp.classification_code}\n`;
    if (opp.description) {
      const desc = opp.description.length > 500 ? opp.description.slice(0, 500) + '...' : opp.description;
      userPrompt += `Description: ${desc}\n`;
    }
    if (opp.place_of_performance?.state) {
      userPrompt += `Place of Performance: ${opp.place_of_performance.city || ''}${opp.place_of_performance.state ? ', ' + opp.place_of_performance.state : ''}\n`;
    }
    if (opp.point_of_contact?.length) {
      const poc = opp.point_of_contact[0];
      userPrompt += `POC: ${poc.full_name || 'N/A'} — ${poc.email || 'N/A'} — ${poc.phone || 'N/A'}\n`;
    }
    userPrompt += '\n';
  }

  userPrompt += `\n=== INSTRUCTION ===\nScore each opportunity against the company profile. Only include opportunities scoring 40 or above. Sort by relevance_score descending. Be specific about why each opportunity matches.\n`;

  return { systemPrompt, userPrompt };
}
