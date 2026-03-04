import { inngest } from '@/lib/inngest/client';
import { getServerClient } from '@/lib/supabase/client';
import { anthropic, MODEL } from '@/lib/anthropic/client';
import { parseClaudeJSON } from '@/lib/anthropic/json-extractor';
import {
  assembleCompanyParserPrompt,
  type CompanyParserInput,
} from '@/lib/capture/company-parser-prompt';
import { assembleOpportunityScorerPrompt } from '@/lib/capture/opportunity-scorer-prompt';
import {
  comprehensiveOpportunitySearch,
  type SamApiOpportunity,
} from '@/lib/samgov/client';
import type {
  ParsedCompanyProfile,
  SamOpportunity,
  ScoredOpportunity,
  OpportunityFinderReport,
} from '@/lib/supabase/capture-types';

/**
 * Convert SAM.gov API response format to our internal format.
 */
function normalizeSamOpportunity(raw: SamApiOpportunity): SamOpportunity {
  return {
    notice_id: raw.noticeId,
    title: raw.title,
    solicitation_number: raw.solicitationNumber,
    department: raw.department || raw.fullParentPathName || 'Unknown',
    sub_tier: raw.subTier,
    office: raw.office,
    posted_date: raw.postedDate,
    response_deadline: raw.responseDeadLine,
    type: raw.type,
    base_type: raw.baseType,
    naics_code: raw.naicsCode,
    classification_code: raw.classificationCode,
    set_aside: raw.typeOfSetAside,
    set_aside_description: raw.typeOfSetAsideDescription,
    active: raw.active === 'Yes' || raw.active === 'true',
    description: raw.description,
    resource_links: raw.resourceLinks,
    point_of_contact: raw.pointOfContact?.map((poc) => ({
      type: poc.type,
      full_name: poc.fullName,
      email: poc.email,
      phone: poc.phone,
      title: poc.title,
    })),
    place_of_performance: raw.placeOfPerformance
      ? {
          state: raw.placeOfPerformance.state?.code || raw.placeOfPerformance.state?.name,
          zip: raw.placeOfPerformance.zip,
          city: raw.placeOfPerformance.city?.name,
        }
      : undefined,
    award: raw.award
      ? {
          date: raw.award.date,
          number: raw.award.number,
          amount: raw.award.amount ? parseFloat(raw.award.amount) : undefined,
          awardee_name: raw.award.awardee?.name,
        }
      : undefined,
  };
}

export const opportunityFinder = inngest.createFunction(
  {
    id: 'opportunity-finder-search',
    name: 'Opportunity Finder — Company Data Search',
    retries: 1,
  },
  { event: 'opportunity.finder.search' },
  async ({ event, step }) => {
    const { analysisId, companyId } = event.data as {
      analysisId: string;
      companyId: string | null;
    };

    const supabase = getServerClient();

    // ── Step 1: Gather company data ──────────────────────────
    const companyData = await step.run('fetch-company-data', async () => {
      const { data: analysis } = await supabase
        .from('opportunity_analyses')
        .select('*')
        .eq('id', analysisId)
        .single();

      if (!analysis) throw new Error('Analysis not found');

      // Get uploaded company data documents
      const { data: documents } = await supabase
        .from('opportunity_documents')
        .select('*')
        .eq('analysis_id', analysisId)
        .eq('document_type', 'company_data');

      const companyDocs = (documents || [])
        .filter((d) => d.extracted_text)
        .map((d) => ({ filename: d.filename, text: d.extracted_text! }));

      // Get existing company profile if available
      let existingProfile: CompanyParserInput['existingProfile'] | undefined;

      if (companyId) {
        const { data: company } = await supabase
          .from('company_profiles')
          .select(
            'company_name, primary_naics, socioeconomic_certs, business_size, corporate_overview, core_services_summary, headquarters_address, clearance_level'
          )
          .eq('id', companyId)
          .single();

        if (company) {
          existingProfile = {
            company_name: company.company_name,
            primary_naics: company.primary_naics,
            socioeconomic_certs: company.socioeconomic_certs,
            business_size: company.business_size,
            corporate_overview: company.corporate_overview,
            core_services_summary: company.core_services_summary,
            headquarters_state: company.headquarters_address?.state,
            headquarters_zip: company.headquarters_address?.zip,
            clearance_level: company.clearance_level,
          };
        }

        // Also fetch NAICS codes from the company
        const { data: naicsCodes } = await supabase
          .from('naics_codes')
          .select('code, title')
          .eq('company_id', companyId);

        // Also fetch past performance for additional context
        const { data: pastPerf } = await supabase
          .from('past_performance')
          .select('contract_nickname, client_agency, task_areas, relevance_tags, naics_codes:relevance_tags')
          .eq('company_id', companyId)
          .limit(10);

        // Build a synthetic "document" from database records
        if (naicsCodes?.length || pastPerf?.length) {
          let dbText = '';
          if (naicsCodes?.length) {
            dbText += 'NAICS Codes:\n';
            for (const nc of naicsCodes) {
              dbText += `  ${nc.code} — ${nc.title}\n`;
            }
            dbText += '\n';
          }
          if (pastPerf?.length) {
            dbText += 'Past Performance:\n';
            for (const pp of pastPerf) {
              dbText += `  ${pp.contract_nickname} — ${pp.client_agency}\n`;
              if (pp.task_areas?.length) {
                dbText += `    Task Areas: ${pp.task_areas.join(', ')}\n`;
              }
              if (pp.relevance_tags?.length) {
                dbText += `    Tags: ${pp.relevance_tags.join(', ')}\n`;
              }
            }
          }
          if (dbText) {
            companyDocs.push({ filename: 'database_records.txt', text: dbText });
          }
        }
      }

      return { companyDocs, existingProfile };
    });

    if (companyData.companyDocs.length === 0) {
      await step.run('mark-failed-no-data', async () => {
        await supabase
          .from('opportunity_analyses')
          .update({
            status: 'failed',
            summary: 'No company data documents with extracted text found. Please re-upload documents.',
            updated_at: new Date().toISOString(),
          })
          .eq('id', analysisId);
      });
      return { status: 'failed', reason: 'no-company-data' };
    }

    // ── Step 2: AI parses company data into structured profile ──
    const parsedProfile = await step.run('parse-company-data', async () => {
      const parserInput: CompanyParserInput = {
        documents: companyData.companyDocs,
        existingProfile: companyData.existingProfile,
      };

      const { systemPrompt, userPrompt } = assembleCompanyParserPrompt(parserInput);

      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 4096,
        temperature: 0.1,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });

      const text =
        response.content[0].type === 'text' ? response.content[0].text : '';

      return parseClaudeJSON<ParsedCompanyProfile>(text);
    });

    // ── Step 3: Search SAM.gov for matching opportunities ──
    const searchResults = await step.run('search-sam-gov', async () => {
      const result = await comprehensiveOpportunitySearch({
        naicsCodes: parsedProfile.naics_codes,
        keywords: parsedProfile.keywords,
        setAsideCodes: parsedProfile.set_aside_codes,
        state: parsedProfile.location?.state,
        limit: 100,
      });

      return {
        opportunities: result.opportunities.map(normalizeSamOpportunity),
        totalSearched: result.totalSearched,
      };
    });

    if (searchResults.opportunities.length === 0) {
      // Save results even if empty — the parsed profile is still valuable
      await step.run('save-empty-results', async () => {
        const finderReport: OpportunityFinderReport = {
          parsed_profile: parsedProfile,
          total_opportunities_searched: searchResults.totalSearched,
          total_matches: 0,
          scored_opportunities: [],
          search_summary: 'No active opportunities found matching the company profile. Try broadening your search or check back later as new opportunities are posted daily.',
          search_parameters: {
            naics_codes: parsedProfile.naics_codes,
            set_aside_codes: parsedProfile.set_aside_codes,
            keywords_used: parsedProfile.keywords,
            date_range: { from: '3 months ago', to: 'today' },
          },
        };

        await supabase
          .from('opportunity_analyses')
          .update({
            status: 'complete',
            summary: 'No matching opportunities found.',
            finder_report: finderReport as any,
            updated_at: new Date().toISOString(),
          })
          .eq('id', analysisId);
      });

      return { status: 'complete', matches: 0 };
    }

    // ── Step 4: AI scores and ranks opportunities ──
    const scoredResults = await step.run('score-opportunities', async () => {
      // Process in batches of 25 to stay within token limits
      const batchSize = 25;
      const allScored: ScoredOpportunity[] = [];

      for (let i = 0; i < searchResults.opportunities.length; i += batchSize) {
        const batch = searchResults.opportunities.slice(i, i + batchSize);

        const { systemPrompt, userPrompt } = assembleOpportunityScorerPrompt({
          companyProfile: parsedProfile,
          opportunities: batch,
        });

        const response = await anthropic.messages.create({
          model: MODEL,
          max_tokens: 8192,
          temperature: 0.1,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        });

        const text =
          response.content[0].type === 'text' ? response.content[0].text : '';

        const parsed = parseClaudeJSON<{
          scored_opportunities: Array<{
            notice_id: string;
            relevance_score: number;
            match_reasons: string[];
            naics_match: boolean;
            set_aside_match: boolean;
            capability_alignment: string;
            risk_factors: string[];
            recommended_action: string;
            pursuit_priority: string;
          }>;
          search_summary: string;
        }>(text);

        // Merge AI scores back with full opportunity data
        for (const scored of parsed.scored_opportunities || []) {
          const fullOpp = batch.find((o) => o.notice_id === scored.notice_id);
          if (fullOpp) {
            allScored.push({
              opportunity: fullOpp,
              relevance_score: scored.relevance_score,
              match_reasons: scored.match_reasons,
              naics_match: scored.naics_match,
              set_aside_match: scored.set_aside_match,
              capability_alignment: scored.capability_alignment,
              risk_factors: scored.risk_factors,
              recommended_action: scored.recommended_action as ScoredOpportunity['recommended_action'],
              pursuit_priority: scored.pursuit_priority as ScoredOpportunity['pursuit_priority'],
            });
          }
        }
      }

      // Sort by score descending
      allScored.sort((a, b) => b.relevance_score - a.relevance_score);

      return allScored;
    });

    // ── Step 5: Save complete results ──
    await step.run('save-results', async () => {
      const pursueCount = scoredResults.filter((s) => s.recommended_action === 'pursue').length;
      const evaluateCount = scoredResults.filter((s) => s.recommended_action === 'evaluate').length;

      const finderReport: OpportunityFinderReport = {
        parsed_profile: parsedProfile,
        total_opportunities_searched: searchResults.totalSearched,
        total_matches: scoredResults.length,
        scored_opportunities: scoredResults,
        search_summary: `Found ${scoredResults.length} matching opportunities. ${pursueCount} recommended to pursue, ${evaluateCount} to evaluate further.`,
        search_parameters: {
          naics_codes: parsedProfile.naics_codes,
          set_aside_codes: parsedProfile.set_aside_codes,
          keywords_used: parsedProfile.keywords,
          date_range: { from: '3 months ago', to: 'today' },
        },
      };

      const topScore = scoredResults[0]?.relevance_score || 0;

      await supabase
        .from('opportunity_analyses')
        .update({
          status: 'complete',
          overall_score: topScore,
          summary: finderReport.search_summary,
          finder_report: finderReport as any,
          updated_at: new Date().toISOString(),
        })
        .eq('id', analysisId);
    });

    return {
      status: 'complete',
      analysisId,
      matches: scoredResults.length,
    };
  }
);
