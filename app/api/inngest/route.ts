import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import { documentClassifier } from '@/lib/inngest/functions/stage0-classifier';
import { rfpIntelligenceAnalyzer } from '@/lib/inngest/functions/stage1-rfp-intelligence';
import { rfpResponseGenerator } from '@/lib/inngest/functions/stage2-response-generator';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    documentClassifier,
    rfpIntelligenceAnalyzer,
    rfpResponseGenerator,
  ],
});
