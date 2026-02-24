import { inngest } from '../client';
import { anthropic, MODEL } from '@/lib/anthropic/client';
import { getServerClient } from '@/lib/supabase/client';
import type { SolicitationDocumentType, ClassificationConfidence } from '@/lib/supabase/solicitation-types';
import { DOCUMENT_TYPE_LABELS } from '@/lib/supabase/solicitation-types';

// Helper function to extract JSON from markdown code blocks
function extractJSON(text: string): string {
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    return jsonMatch[1].trim();
  }
  return text.trim();
}

interface ClassificationResult {
  document_type: SolicitationDocumentType;
  document_type_label: string;
  amendment_number?: string;
  effective_date?: string;
  solicitation_number_detected?: string;
  confidence: ClassificationConfidence;
  reasoning: string;
}

/**
 * Inngest function: Solicitation Document Classifier
 *
 * Listens for 'solicitation.document.uploaded' events and classifies each
 * document into one of the 11 government solicitation document types using
 * Anthropic's Claude model.
 *
 * Steps:
 * 1. log-start: Update processing status to 'extracting', log start
 * 2. classify-document: Call Claude with extracted text (first 15000 chars)
 * 3. update-classification: Write classification results to DB
 * 4. log-completion: Log completion to processing_logs
 * 5. check-all-classified: If all docs classified, trigger reconciliation
 */
export const solicitationDocumentClassifier = inngest.createFunction(
  { id: 'solicitation-document-classifier' },
  { event: 'solicitation.document.uploaded' },
  async ({ event, step }) => {
    const { solicitationId, documentId, extractedText } = event.data;

    // Step 1: Log start and update processing status
    await step.run('log-start', async () => {
      const supabase = getServerClient();

      await supabase
        .from('solicitation_documents')
        .update({ processing_status: 'extracting' })
        .eq('id', documentId);

      await supabase.from('processing_logs').insert({
        document_id: documentId,
        stage: 'solicitation-document-classifier',
        status: 'started',
        metadata: { solicitation_id: solicitationId },
      });
    });

    // Step 2: Classify the document using Claude
    const classification = await step.run('classify-document', async () => {
      const textSample = (extractedText || '').substring(0, 15000);

      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: `You are a government contracting expert. Analyze this solicitation document and classify it into exactly one of these 11 document types:

1. base_rfp — The primary Request for Proposals / Request for Quote solicitation document (Section L, Section M, Instructions to Offerors)
2. soo_sow_pws — Statement of Objectives, Statement of Work, or Performance Work Statement
3. amendment — A formal amendment to the solicitation (e.g., Amendment 0001, Amendment 0002)
4. qa_response — Official Questions and Answers or Q&A response document
5. pricing_template — Cost/price volume templates, CLIN pricing sheets, Excel pricing workbooks
6. dd254 — Department of Defense Contract Security Classification Specification (DD Form 254)
7. clauses — General provisions and clauses, FAR/DFARS clauses document
8. cdrls — Contract Data Requirements List (CDRL), DD Form 1423 exhibit
9. wage_determination — Department of Labor Wage Determination document
10. provisions — Section I or standalone provisions document (contract terms)
11. other_unclassified — Does not fit any of the above categories

Also extract:
- amendment_number: Only if classified as 'amendment', extract the amendment identifier (e.g., "Amendment 0001", "Amendment 0003"). Return null if not an amendment.
- effective_date: The document issue date or effective date if visible (e.g., "2024-01-15"). Return null if not found.
- solicitation_number_detected: The solicitation/RFP number if visible in the document (e.g., "W911NF-24-R-0001", "FA8621-24-R-0003"). Return null if not found.
- confidence: "high" if classification is clear and unambiguous, "medium" if likely but not certain, "low" if uncertain or the document is ambiguous/short
- reasoning: Brief 1-2 sentence explanation of why you chose this classification

Document content (first 15000 chars):
${textSample}

Respond with ONLY valid JSON in this exact format:
{
  "document_type": "one_of_the_11_types",
  "amendment_number": "Amendment 0001" | null,
  "effective_date": "YYYY-MM-DD" | null,
  "solicitation_number_detected": "W911NF-24-R-0001" | null,
  "confidence": "high" | "medium" | "low",
  "reasoning": "brief explanation"
}`,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude');
      }

      const jsonText = extractJSON(content.text);
      const parsed = JSON.parse(jsonText) as ClassificationResult;

      // Ensure document_type_label is set correctly
      const docType = parsed.document_type as SolicitationDocumentType;
      const label = DOCUMENT_TYPE_LABELS[docType] || 'Other/Unclassified';

      return {
        document_type: docType,
        document_type_label: label,
        amendment_number: parsed.amendment_number || null,
        effective_date: parsed.effective_date || null,
        solicitation_number_detected: parsed.solicitation_number_detected || null,
        confidence: parsed.confidence as ClassificationConfidence,
        reasoning: parsed.reasoning,
      };
    });

    // Step 3: Update the document record with classification results
    await step.run('update-classification', async () => {
      const supabase = getServerClient();

      const updatePayload: Record<string, string | null> = {
        document_type: classification.document_type,
        document_type_label: classification.document_type_label,
        classification_confidence: classification.confidence,
        classification_reasoning: classification.reasoning,
        processing_status: 'classified',
        updated_at: new Date().toISOString(),
      };

      if (classification.amendment_number) {
        updatePayload.amendment_number = classification.amendment_number;
      }
      if (classification.effective_date) {
        updatePayload.effective_date = classification.effective_date;
      }

      await supabase
        .from('solicitation_documents')
        .update(updatePayload)
        .eq('id', documentId);
    });

    // Step 4: Log completion
    await step.run('log-completion', async () => {
      const supabase = getServerClient();

      await supabase.from('processing_logs').insert({
        document_id: documentId,
        stage: 'solicitation-document-classifier',
        status: 'completed',
        metadata: {
          solicitation_id: solicitationId,
          document_type: classification.document_type,
          confidence: classification.confidence,
          solicitation_number_detected: classification.solicitation_number_detected,
        },
      });
    });

    // Step 5: Check if all documents in the solicitation are classified
    // If yes, trigger reconciliation event (Plan 03)
    await step.run('check-all-classified', async () => {
      const supabase = getServerClient();

      // Query all documents for this solicitation
      const { data: allDocs } = await supabase
        .from('solicitation_documents')
        .select('id, processing_status')
        .eq('solicitation_id', solicitationId);

      if (!allDocs || allDocs.length === 0) return;

      const allClassified = allDocs.every(
        (doc) => doc.processing_status === 'classified' || doc.processing_status === 'failed'
      );

      if (allClassified) {
        // Update solicitation status to reconciling
        await supabase
          .from('solicitations')
          .update({
            status: 'reconciling',
            updated_at: new Date().toISOString(),
          })
          .eq('id', solicitationId);

        // Trigger reconciliation event (consumed by Plan 03)
        await inngest.send({
          name: 'solicitation.classification.complete',
          data: { solicitationId },
        });
      }
    });

    return { classification };
  }
);
