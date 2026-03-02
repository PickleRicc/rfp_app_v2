/**
 * Touchup Package Scorer — Cross-Volume Consistency
 *
 * Triggered by: 'proposal.touchup.score-package'
 * Payload: { solicitationId, companyId, draftId, touchupId }
 *
 * Fetches ALL volume content_markdown for a proposal, plus authoritative
 * key_personnel and site_staffing from data_call_responses, and asks Claude
 * to check cross-volume consistency across 7 dimensions.
 *
 * Results stored in touchup_analyses.package_consistency and package_score.
 */

import { inngest } from '../client';
import { getServerClient } from '@/lib/supabase/client';
import { anthropic, MODEL } from '@/lib/anthropic/client';
import { parseClaudeJSON } from '@/lib/anthropic/json-extractor';
import { logPipelineEvent } from '@/lib/logging/pipeline-logger';
import type { PackageConsistencyResult } from '@/lib/supabase/touchup-types';
import type { DataCallResponse } from '@/lib/supabase/tier2-types';

function buildPackageScoringPrompt(
  volumes: { name: string; markdown: string }[],
  keyPersonnel: unknown[],
  siteStaffing: unknown[],
  complianceVerification: unknown,
  technicalApproach: unknown,
): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = `You are a government proposal cross-volume consistency auditor. Your task is to check whether ALL volumes of a multi-volume proposal are internally consistent with each other and with the authoritative source data.

You check these 7 dimensions:
1. PERSONNEL NAMES — The same key personnel names must appear for the same roles in every volume. The "Authoritative Key Personnel" list is the single source of truth.
2. USER COUNT — The total user population must be identical in every volume that mentions it.
3. FTE COUNT AND SITE ALLOCATIONS — Total FTE count and per-site allocations must be consistent across all volumes.
4. LABOR CATEGORIES — Same labor category titles, qualification descriptions, and FTE counts across volumes.
5. SPRS SCORE, CAGE, CMMI, TEAMING % — These numeric/identifier values must be identical everywhere.
6. CDRL MAPPINGS — Deliverable references must be consistent between Technical, PWS, and QASP volumes.
7. SITE NAMES AND LOCATIONS — Identical site names and location descriptions in every volume.

SEVERITY TIERS:
- FATAL: Inconsistency that would cause rejection (different key personnel names across volumes)
- DEFICIENCY: Inconsistency that evaluators would notice (-15 to -25 points)
- WEAKNESS: Minor inconsistency that might confuse evaluators (-5 to -10 points)
- ENHANCEMENT: Opportunity to improve consistency (no evaluation impact)

Output ONLY valid JSON. No markdown wrapping.`;

  const volumeBlocks = volumes.map(v =>
    `=== ${v.name} ===\n${v.markdown.slice(0, 15000)}`
  ).join('\n\n');

  const userPrompt = `Check cross-volume consistency for this proposal package.

=== AUTHORITATIVE SOURCE DATA ===
Key Personnel: ${JSON.stringify(keyPersonnel, null, 1)}
Site Staffing: ${JSON.stringify(siteStaffing, null, 1)}
Compliance Verification: ${JSON.stringify(complianceVerification, null, 1)}
Technical Approach: ${JSON.stringify(technicalApproach, null, 1)}

=== PROPOSAL VOLUMES (${volumes.length} total) ===
${volumeBlocks}

=== REQUIRED OUTPUT FORMAT ===
{
  "overall_consistent": <true | false>,
  "cross_volume_score": <0-100>,
  "checks": [
    {
      "check_type": "<personnel_names | user_count | fte_count | labor_categories | sprs_score | cdrl_mappings | site_names>",
      "status": "<consistent | inconsistent>",
      "details": "<specific description of what matches or mismatches>",
      "volumes_affected": ["<volume names>"],
      "severity_tier": "<fatal | deficiency | weakness | enhancement>"
    }
  ]
}`;

  return { systemPrompt, userPrompt };
}

export const touchupPackageScorer = inngest.createFunction(
  { id: 'touchup-package-scorer' },
  { event: 'proposal.touchup.score-package' },
  async ({ event, step }) => {
    const { solicitationId, companyId, touchupId } = event.data as {
      solicitationId: string;
      companyId: string;
      draftId: string;
      touchupId: string;
    };

    const fetchResult = await step.run('fetch-all-volumes', async () => {
      const supabase = getServerClient();

      const { data: touchupVolumes } = await supabase
        .from('touchup_volumes')
        .select('volume_name, content_markdown, original_volume_id, status')
        .eq('touchup_id', touchupId)
        .neq('volume_order', 999)
        .order('volume_order', { ascending: true });

      if (!touchupVolumes || touchupVolumes.length === 0) {
        throw new Error('No touchup volumes found');
      }

      const volumes: { name: string; markdown: string }[] = [];
      for (const tv of touchupVolumes) {
        let md = tv.content_markdown as string | null;
        if (!md) {
          const { data: draftVol } = await supabase
            .from('draft_volumes')
            .select('content_markdown')
            .eq('id', tv.original_volume_id)
            .single();
          md = draftVol?.content_markdown as string | null;
        }
        if (md) {
          volumes.push({ name: tv.volume_name as string, markdown: md });
        }
      }

      const { data: dataCall } = await supabase
        .from('data_call_responses')
        .select('key_personnel, site_staffing, compliance_verification, technical_approach')
        .eq('solicitation_id', solicitationId)
        .eq('company_id', companyId)
        .single();

      return {
        volumes,
        keyPersonnel: (dataCall as DataCallResponse)?.key_personnel || [],
        siteStaffing: (dataCall as DataCallResponse)?.site_staffing || [],
        complianceVerification: (dataCall as DataCallResponse)?.compliance_verification || {},
        technicalApproach: (dataCall as DataCallResponse)?.technical_approach || {},
      };
    });

    const result = await step.run('score-package-consistency', async () => {
      const supabase = getServerClient();

      const { systemPrompt, userPrompt } = buildPackageScoringPrompt(
        fetchResult.volumes,
        fetchResult.keyPersonnel,
        fetchResult.siteStaffing,
        fetchResult.complianceVerification,
        fetchResult.technicalApproach,
      );

      const stream = anthropic.messages.stream({
        model: MODEL,
        max_tokens: 8192,
        temperature: 0.1,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });
      const response = await stream.finalMessage();

      const responseText = response.content
        .filter(b => b.type === 'text')
        .map(b => (b as { type: 'text'; text: string }).text)
        .join('\n');

      const consistency = parseClaudeJSON<PackageConsistencyResult>(responseText);

      await supabase.from('touchup_analyses').update({
        package_consistency: consistency as unknown as Record<string, unknown>,
        package_score: consistency.cross_volume_score,
        updated_at: new Date().toISOString(),
      }).eq('id', touchupId);

      await logPipelineEvent(solicitationId, 'touchup-score-package', 'completed', {
        output_summary: {
          overall_consistent: consistency.overall_consistent,
          cross_volume_score: consistency.cross_volume_score,
          checks_count: consistency.checks.length,
          inconsistencies: consistency.checks.filter(c => c.status === 'inconsistent').length,
        },
      });

      return consistency;
    });

    return {
      touchupId,
      packageScore: result.cross_volume_score,
      consistent: result.overall_consistent,
    };
  }
);
