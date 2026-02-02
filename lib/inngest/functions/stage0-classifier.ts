import { inngest } from '../client';
import { anthropic, MODEL } from '@/lib/anthropic/client';
import { getServerClient } from '@/lib/supabase/client';

// Helper function to extract JSON from markdown code blocks
function extractJSON(text: string): string {
  // Remove markdown code blocks if present
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    return jsonMatch[1].trim();
  }
  // If no code blocks, return trimmed text
  return text.trim();
}

export const documentClassifier = inngest.createFunction(
  { id: 'stage-0-document-classifier' },
  { event: 'document.uploaded' },
  async ({ event, step }) => {
    const { documentId, fileContent } = event.data;

    // Log start and update document status
    await step.run('log-start', async () => {
      const supabase = getServerClient();
      
      // Update document to processing
      await supabase
        .from('documents')
        .update({ status: 'processing' })
        .eq('id', documentId);
      
      // Log the start
      await supabase.from('processing_logs').insert({
        document_id: documentId,
        stage: 'stage-0-classifier',
        status: 'started',
        metadata: {},
      });
    });

    // Classify document
    const classification = await step.run('classify-document', async () => {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: `Analyze this government contracting document and classify it.

IMPORTANT: Classify as "rfp" if the document contains ANY of these:
- RFP (Request for Proposal)
- RFQ (Request for Quote)
- Solicitation
- PWS (Performance Work Statement)
- SOW (Statement of Work)
- Section L (Instructions to Offerors)
- Section M (Evaluation Criteria)
- Call Order
- Task Order solicitation
- Amendment to solicitation

Classify as "proposal" if it's a company's response/bid to an RFP.
Classify as "contract" only if it's an awarded contract or agreement.
Classify as "other" if none of the above apply.

Document content (first 10000 chars):
${fileContent.substring(0, 10000)}

Format your response as JSON:
{
  "type": "rfp|proposal|contract|other",
  "confidence": "high|medium|low",
  "reasoning": "brief explanation"
}`,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type');
      }

      // Extract JSON from potential markdown code blocks
      const jsonText = extractJSON(content.text);
      return JSON.parse(jsonText);
    });

    // Update document type
    await step.run('update-document-type', async () => {
      const supabase = getServerClient();
      await supabase
        .from('documents')
        .update({ document_type: classification.type })
        .eq('id', documentId);
    });

    // Log completion
    await step.run('log-completion', async () => {
      const supabase = getServerClient();
      await supabase.from('processing_logs').insert({
        document_id: documentId,
        stage: 'stage-0-classifier',
        status: 'completed',
        metadata: classification,
      });
    });

    // Trigger next stage based on document type
    // Analyze RFPs and documents that look like solicitations
    const shouldAnalyze = 
      classification.type === 'rfp' || 
      fileContent.toLowerCase().includes('performance work statement') ||
      fileContent.toLowerCase().includes('statement of work') ||
      fileContent.toLowerCase().includes('section l') ||
      fileContent.toLowerCase().includes('section m') ||
      fileContent.toLowerCase().includes('solicitation');
    
    if (shouldAnalyze) {
      // Treat as RFP for analysis purposes
      await step.sendEvent('trigger-stage-1', {
        name: 'document.classified',
        data: {
          documentId,
          documentType: 'rfp',
          fileContent,
        },
      });
    } else {
      // Mark as completed if not a solicitation (no further processing)
      await step.run('mark-non-rfp-complete', async () => {
        const supabase = getServerClient();
        await supabase
          .from('documents')
          .update({ status: 'completed' })
          .eq('id', documentId);
      });
    }

    return { classification };
  }
);
