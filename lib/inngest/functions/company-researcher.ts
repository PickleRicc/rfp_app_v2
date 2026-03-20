import { inngest } from '@/lib/inngest/client';
import { getServerClient } from '@/lib/supabase/client';
import { anthropic, MODEL } from '@/lib/anthropic/client';
import { parseClaudeJSON } from '@/lib/anthropic/json-extractor';
import { buildCompanySpendingReport } from '@/lib/usaspending/client';
import { researchCompany } from '@/lib/perplexity/client';
import {
  comprehensiveOpportunitySearch,
  type TangoOpportunity,
} from '@/lib/samgov/client';

/**
 * Company Researcher — Pre-Sales Intelligence Workflow
 *
 * Free-form research on ANY company (not limited to our platform).
 * Takes a company name + optional CAGE/UEI and gathers intel from:
 *   1. USASpending.gov — contract history, agency relationships
 *   2. Perplexity AI — web research (leadership, news, partnerships)
 *   3. SAM.gov (Tango) — matching active opportunities
 *   4. Claude — synthesize into actionable talking points
 */
export const companyResearcher = inngest.createFunction(
  {
    id: 'company-researcher',
    name: 'Company Research — Pre-Sales Intel',
    retries: 1,
  },
  { event: 'company.research.start' },
  async ({ event, step }) => {
    const { researchId, companyName, cageCode, uei } = event.data as {
      researchId: string;
      companyName: string;
      cageCode: string | null;
      uei: string | null;
    };

    const supabase = getServerClient();

    try {
      // Mark as researching
      await step.run('mark-researching', async () => {
        await supabase
          .from('company_research')
          .update({ status: 'researching', updated_at: new Date().toISOString() })
          .eq('id', researchId);
      });

      // ── Step 1: USASpending.gov lookup ────────────────────────
      const spendingReport = await step.run('usaspending-lookup', async () => {
        try {
          const report = await buildCompanySpendingReport({
            companyName,
            uei: uei || undefined,
            cageCode: cageCode || undefined,
          });

          return {
            total_awards: report.total_awards,
            total_obligation: report.total_obligation,
            agency_breakdown: report.agency_breakdown,
            naics_breakdown: report.naics_breakdown,
            recent_awards: report.recent_awards.map((a) => ({
              award_id: a.award_id,
              description: a.description,
              total_obligation: a.total_obligation,
              awarding_agency_name: a.awarding_agency_name,
              naics_code: a.naics_code,
              naics_description: a.naics_description,
              date_signed: a.date_signed,
              period_of_performance_current_end_date: a.period_of_performance_current_end_date,
            })),
            largest_awards: report.largest_awards.map((a) => ({
              award_id: a.award_id,
              description: a.description,
              total_obligation: a.total_obligation,
              awarding_agency_name: a.awarding_agency_name,
              naics_code: a.naics_code,
              naics_description: a.naics_description,
              date_signed: a.date_signed,
              period_of_performance_current_end_date: a.period_of_performance_current_end_date,
            })),
          };
        } catch (err) {
          console.error('[company-researcher] USASpending error:', err);
          return null;
        }
      });

      // Extract NAICS codes from spending data for opportunity search
      const naicsFromSpending = spendingReport?.naics_breakdown
        ?.slice(0, 5)
        .map((n) => n.code)
        .filter(Boolean) || [];

      // ── Step 2: Perplexity AI web research ────────────────────
      const perplexityReport = await step.run('perplexity-research', async () => {
        try {
          // Build context from USASpending data we already have
          const existingContext = [
            spendingReport?.total_awards
              ? `USASpending shows ${spendingReport.total_awards} federal awards totaling $${(spendingReport.total_obligation / 1_000_000).toFixed(1)}M`
              : '',
            spendingReport?.agency_breakdown?.length
              ? `Top agencies: ${spendingReport.agency_breakdown.slice(0, 3).map((a) => a.agency_name).join(', ')}`
              : '',
            naicsFromSpending.length
              ? `Known NAICS codes: ${naicsFromSpending.join(', ')}`
              : '',
          ].filter(Boolean).join('\n');

          const result = await researchCompany({
            companyName,
            cageCode: cageCode || undefined,
            uei: uei || undefined,
            naicsCodes: naicsFromSpending,
            existingContext: existingContext || undefined,
          });

          return {
            company_overview: result.company_overview,
            leadership: result.leadership,
            recent_contracts_and_wins: result.recent_contracts_and_wins,
            partnerships_and_teaming: result.partnerships_and_teaming,
            competitive_landscape: result.competitive_landscape,
            news_and_developments: result.news_and_developments,
            technology_and_capabilities: result.technology_and_capabilities,
            financial_health: result.financial_health,
            recommendations_for_engagement: result.recommendations_for_engagement,
            sources: result.sources,
          };
        } catch (err) {
          console.error('[company-researcher] Perplexity error:', err);
          return null;
        }
      });

      // ── Step 3: Search SAM.gov for matching opportunities ─────
      const matchedOpportunities = await step.run('search-opportunities', async () => {
        if (!naicsFromSpending.length) return [];

        try {
          const result = await comprehensiveOpportunitySearch({
            naicsCodes: naicsFromSpending,
            keywords: [companyName.split(/\s+/)[0]],
            setAsideCodes: [],
            limit: 50,
          });

          return result.opportunities.slice(0, 20).map((opp: TangoOpportunity) => ({
            notice_id: opp.opportunity_id,
            title: opp.title,
            solicitation_number: opp.solicitation_number || null,
            department: String(opp.department || opp.agency || 'Unknown'),
            response_deadline: opp.response_deadline || null,
            naics_code: opp.naics_code || null,
            set_aside: String(opp.set_aside || '') || null,
            relevance_score: naicsFromSpending.includes(opp.naics_code || '') ? 80 : 50,
            recommended_action: naicsFromSpending.includes(opp.naics_code || '') ? 'evaluate' : 'monitor',
          }));
        } catch (err) {
          console.error('[company-researcher] Opportunity search error:', err);
          return [];
        }
      });

      // ── Step 4: Claude synthesizes an executive briefing ──────
      const briefing = await step.run('synthesize-briefing', async () => {
        try {
          const context = [];

          context.push(`Company: ${companyName}`);
          if (cageCode) context.push(`CAGE Code: ${cageCode}`);
          if (uei) context.push(`UEI: ${uei}`);

          if (spendingReport) {
            context.push(`\n--- USASpending.gov Data ---`);
            context.push(`Total federal awards: ${spendingReport.total_awards}`);
            context.push(`Total obligation: $${(spendingReport.total_obligation / 1_000_000).toFixed(2)}M`);
            if (spendingReport.agency_breakdown.length) {
              context.push(`Top agencies: ${spendingReport.agency_breakdown.slice(0, 5).map((a) => `${a.agency_name} ($${(a.total_obligation / 1_000_000).toFixed(1)}M)`).join(', ')}`);
            }
            if (spendingReport.naics_breakdown.length) {
              context.push(`Top NAICS: ${spendingReport.naics_breakdown.slice(0, 5).map((n) => `${n.code} - ${n.description} ($${(n.amount / 1_000_000).toFixed(1)}M)`).join(', ')}`);
            }
          }

          if (perplexityReport) {
            context.push(`\n--- Web Research (Perplexity AI) ---`);
            if (perplexityReport.company_overview) context.push(`Overview: ${perplexityReport.company_overview}`);
            if (perplexityReport.leadership) context.push(`Leadership: ${perplexityReport.leadership}`);
            if (perplexityReport.recent_contracts_and_wins) context.push(`Recent wins: ${perplexityReport.recent_contracts_and_wins}`);
            if (perplexityReport.competitive_landscape) context.push(`Competition: ${perplexityReport.competitive_landscape}`);
            if (perplexityReport.recommendations_for_engagement) context.push(`Engagement tips: ${perplexityReport.recommendations_for_engagement}`);
          }

          if (matchedOpportunities?.length) {
            context.push(`\n--- Active SAM.gov Opportunities (${matchedOpportunities.length} found) ---`);
            for (const opp of matchedOpportunities.slice(0, 5)) {
              context.push(`- ${opp.title} (${opp.department}) - NAICS ${opp.naics_code || 'N/A'}, deadline: ${opp.response_deadline || 'TBD'}`);
            }
          }

          const systemPrompt = `You are a federal contracting business development strategist. Given research data about a government contractor, synthesize a concise executive briefing and actionable talking points for an upcoming sales call.

Your goal: help our staff walk into the call with complete context and a clear value proposition. We help companies respond to federal RFPs with AI-powered proposal generation.

Return valid JSON with this exact structure:
{
  "executive_briefing": "2-3 paragraph summary of who this company is, their federal footprint, and the opportunity for us",
  "key_talking_points": ["point 1", "point 2", ...],
  "recommended_services": ["service 1", "service 2", ...]
}

For key_talking_points: 4-6 specific, actionable conversation starters based on the data. Reference specific contracts, dollar amounts, or deadlines where possible.
For recommended_services: which of our services to pitch them on — options are: opportunity finding, proposal writing, compliance review, past performance management, data call support.`;

          const response = await anthropic.messages.create({
            model: MODEL,
            max_tokens: 2048,
            temperature: 0.3,
            system: systemPrompt,
            messages: [{ role: 'user', content: context.join('\n') }],
          });

          const text = response.content[0].type === 'text' ? response.content[0].text : '';
          return parseClaudeJSON<{
            executive_briefing: string;
            key_talking_points: string[];
            recommended_services: string[];
          }>(text);
        } catch (err) {
          console.error('[company-researcher] Claude synthesis error:', err);
          return null;
        }
      });

      // ── Step 5: Save everything ───────────────────────────────
      await step.run('save-results', async () => {
        await supabase
          .from('company_research')
          .update({
            status: 'complete',
            perplexity_report: perplexityReport as any,
            spending_report: spendingReport as any,
            matched_opportunities: matchedOpportunities as any,
            executive_briefing: briefing?.executive_briefing ?? null,
            key_talking_points: briefing?.key_talking_points ?? [],
            recommended_services: briefing?.recommended_services ?? [],
            updated_at: new Date().toISOString(),
          })
          .eq('id', researchId);
      });

      return {
        status: 'complete',
        researchId,
        companyName,
      };
    } catch (err) {
      console.error('[company-researcher] Fatal error:', err);

      // Mark the research as failed so the frontend stops polling
      await step.run('mark-failed', async () => {
        const message = err instanceof Error ? err.message : 'Unknown error during research';
        await supabase
          .from('company_research')
          .update({
            status: 'failed',
            error_message: message,
            updated_at: new Date().toISOString(),
          })
          .eq('id', researchId);
      });

      throw err;
    }
  }
);
