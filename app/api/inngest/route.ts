import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import { documentClassifier } from '@/lib/inngest/functions/stage0-classifier';
import { rfpIntelligenceAnalyzer } from '@/lib/inngest/functions/stage1-rfp-intelligence';
import { rfpResponseGenerator } from '@/lib/inngest/functions/stage2-response-generator';
import { solicitationDocumentClassifier } from '@/lib/inngest/functions/solicitation-classifier';
import { solicitationReconciler } from '@/lib/inngest/functions/solicitation-reconciler';
import { solicitationComplianceExtractor } from '@/lib/inngest/functions/solicitation-compliance-extractor';
import { proposalDraftGenerator } from '@/lib/inngest/functions/proposal-draft-generator';
import { touchupScorer } from '@/lib/inngest/functions/touchup-scorer';
import { touchupRewriter } from '@/lib/inngest/functions/touchup-rewriter';
import { touchupPackageScorer } from '@/lib/inngest/functions/touchup-package-scorer';
import { opportunityAnalyzer } from '@/lib/inngest/functions/opportunity-analyzer';
import { opportunityFinder } from '@/lib/inngest/functions/opportunity-finder';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    documentClassifier,
    rfpIntelligenceAnalyzer,
    rfpResponseGenerator,
    solicitationDocumentClassifier,
    solicitationReconciler,
    solicitationComplianceExtractor,
    proposalDraftGenerator,
    touchupScorer,
    touchupRewriter,
    touchupPackageScorer,
    opportunityAnalyzer,
    opportunityFinder,
  ],
});
