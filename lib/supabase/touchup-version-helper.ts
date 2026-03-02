/**
 * Touchup Version Helper
 *
 * snapshotVersion() creates an immutable snapshot of the current touchup_volume
 * state before it gets overwritten by a new score or rewrite. Returns the new
 * version_number that the caller should use for this iteration.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export async function snapshotVersion(
  supabase: SupabaseClient,
  touchupVolumeId: string,
  action: 'scored' | 'rewritten',
  scoreVersion?: 'draft' | 'touchup'
): Promise<number> {
  const { data: vol, error } = await supabase
    .from('touchup_volumes')
    .select('*')
    .eq('id', touchupVolumeId)
    .single();

  if (error || !vol) {
    console.warn(`[snapshotVersion] Could not fetch touchup volume ${touchupVolumeId}:`, error?.message);
    return 1;
  }

  const hasScoreData = vol.compliance_score != null;
  const hasRewriteData = !!vol.content_markdown;

  if (!hasScoreData && !hasRewriteData) {
    return (vol.version_number as number) || 1;
  }

  const currentVersion = (vol.version_number as number) || 1;
  const snapshotAction = hasRewriteData ? 'rewritten' : 'scored';

  const { error: insertError } = await supabase
    .from('touchup_volume_versions')
    .insert({
      touchup_volume_id: touchupVolumeId,
      version_number: currentVersion,
      action: snapshotAction,
      score_version: scoreVersion ?? null,
      compliance_score: vol.compliance_score,
      gap_analysis: vol.gap_analysis,
      fabrication_flags: vol.fabrication_flags,
      placeholder_count: vol.placeholder_count,
      content_markdown: vol.content_markdown,
      file_path: vol.file_path,
      word_count: vol.word_count,
      page_estimate: vol.page_estimate,
      page_limit_status: vol.page_limit_status,
      human_input_count: vol.human_input_count,
      regression_reversions: vol.regression_reversions,
    });

  if (insertError) {
    console.error(`[snapshotVersion] Failed to insert version snapshot:`, insertError.message);
    return currentVersion;
  }

  const newVersion = currentVersion + 1;

  await supabase
    .from('touchup_volumes')
    .update({ version_number: newVersion })
    .eq('id', touchupVolumeId);

  console.log(`[snapshotVersion] Snapshotted v${currentVersion} for ${touchupVolumeId} (${snapshotAction}), now v${newVersion}`);

  return newVersion;
}
