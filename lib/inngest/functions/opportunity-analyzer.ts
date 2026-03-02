import { inngest } from '@/lib/inngest/client';
import { getServerClient } from '@/lib/supabase/client';
import { anthropic, MODEL } from '@/lib/anthropic/client';
import { parseClaudeJSON } from '@/lib/anthropic/json-extractor';
import {
  assembleOpportunityAnalysisPrompt,
  type OpportunityAnalysisPromptData,
} from '@/lib/capture/analysis-prompt';
import type { OpportunityReport, FitRating } from '@/lib/supabase/capture-types';

export const opportunityAnalyzer = inngest.createFunction(
  {
    id: 'opportunity-confirmation-analyzer',
    name: 'Opportunity Confirmation Analyzer',
    retries: 1,
  },
  { event: 'opportunity.confirmation.analyze' },
  async ({ event, step }) => {
    const { analysisId, mode, companyId } = event.data as {
      analysisId: string;
      mode: 'raw' | 'database';
      companyId: string | null;
    };

    const supabase = getServerClient();

    // Step 1: Gather all data
    const allData = await step.run('fetch-analysis-data', async () => {
      const { data: analysis } = await supabase
        .from('opportunity_analyses')
        .select('*')
        .eq('id', analysisId)
        .single();

      if (!analysis) throw new Error('Analysis not found');

      const { data: documents } = await supabase
        .from('opportunity_documents')
        .select('*')
        .eq('analysis_id', analysisId);

      const rfpDocs = (documents || [])
        .filter((d) => d.document_type !== 'past_performance')
        .filter((d) => d.extracted_text);

      const ppDocs = (documents || [])
        .filter((d) => d.document_type === 'past_performance')
        .filter((d) => d.extracted_text);

      let databasePP: any[] = [];
      let companyName: string | undefined;
      let companyOverview: string | undefined;

      if (mode === 'database' && companyId) {
        const { data: company } = await supabase
          .from('company_profiles')
          .select('company_name, corporate_overview, elevator_pitch')
          .eq('id', companyId)
          .single();

        if (company) {
          companyName = company.company_name;
          companyOverview = company.corporate_overview || company.elevator_pitch;
        }

        const { data: pastPerformance } = await supabase
          .from('past_performance')
          .select('*')
          .eq('company_id', companyId);

        databasePP = pastPerformance || [];
      }

      return {
        analysis,
        rfpDocs: rfpDocs.map((d) => ({
          filename: d.filename,
          document_type: d.document_type,
          text: d.extracted_text!,
        })),
        ppDocs: ppDocs.map((d) => ({
          filename: d.filename,
          text: d.extracted_text!,
        })),
        databasePP,
        companyName,
        companyOverview,
      };
    });

    if (allData.rfpDocs.length === 0) {
      await step.run('mark-failed-no-rfp', async () => {
        await supabase
          .from('opportunity_analyses')
          .update({
            status: 'failed',
            summary: 'No RFP documents with extracted text found. Please re-upload documents.',
            updated_at: new Date().toISOString(),
          })
          .eq('id', analysisId);
      });
      return { status: 'failed', reason: 'no-rfp-text' };
    }

    // Step 2: Run AI analysis
    const report = await step.run('analyze-opportunity', async () => {
      const promptData: OpportunityAnalysisPromptData = {
        mode,
        rfpDocuments: allData.rfpDocs,
        pastPerformanceDocuments: mode === 'raw' ? allData.ppDocs : undefined,
        databasePastPerformance: mode === 'database' ? allData.databasePP : undefined,
        companyName: allData.companyName,
        companyOverview: allData.companyOverview,
      };

      const { systemPrompt, userPrompt } =
        assembleOpportunityAnalysisPrompt(promptData);

      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 16384,
        temperature: 0.1,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });

      const text =
        response.content[0].type === 'text' ? response.content[0].text : '';

      const parsed = parseClaudeJSON<OpportunityReport>(text);
      return parsed;
    });

    // Step 3: Save results
    await step.run('save-results', async () => {
      const fitRating: FitRating = report.fit_rating || 'weak_fit';
      const score = typeof report.score === 'number' ? report.score : 0;

      await supabase
        .from('opportunity_analyses')
        .update({
          status: 'complete',
          overall_fit_rating: fitRating,
          overall_score: score,
          summary: report.executive_summary || '',
          report: report as any,
          updated_at: new Date().toISOString(),
        })
        .eq('id', analysisId);
    });

    return { status: 'complete', analysisId };
  }
);
