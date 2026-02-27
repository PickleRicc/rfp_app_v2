/**
 * GET /api/solicitations/[id]/logs
 * Returns pipeline logs and summary for a solicitation.
 *
 * Query params:
 *   stage  - Filter by pipeline stage (e.g., 'extract-sow-pws-overview')
 *   status - Filter by status ('started', 'completed', 'failed', 'warning')
 *   limit  - Max entries to return (default: 200)
 *   offset - Pagination offset (default: 0)
 *
 * Response shape: PipelineLogsResponse = { logs, summary }
 *
 * Requires:
 * - requireStaffOrResponse() auth
 * - X-Company-Id header
 * - Solicitation must belong to the requesting company
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';
import { requireStaffOrResponse } from '@/lib/auth';
import type {
  PipelineLog,
  PipelineSummary,
} from '@/lib/supabase/pipeline-log-types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffOrResponse();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id: solicitationId } = await params;
    const companyId = request.headers.get('X-Company-Id');

    if (!companyId) {
      return NextResponse.json(
        { error: 'X-Company-Id header is required' },
        { status: 400 }
      );
    }

    const supabase = getServerClient();

    // Verify the solicitation belongs to the requesting company
    const { data: solicitation } = await supabase
      .from('solicitations')
      .select('id')
      .eq('id', solicitationId)
      .eq('company_id', companyId)
      .maybeSingle();

    if (!solicitation) {
      return NextResponse.json(
        { error: 'Solicitation not found' },
        { status: 404 }
      );
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const stageFilter = searchParams.get('stage');
    const statusFilter = searchParams.get('status');
    const limit = Math.min(Number(searchParams.get('limit')) || 200, 500);
    const offset = Number(searchParams.get('offset')) || 0;

    // Build filtered query for paginated logs
    let logsQuery = supabase
      .from('pipeline_logs')
      .select('*')
      .eq('solicitation_id', solicitationId)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (stageFilter) {
      logsQuery = logsQuery.eq('stage', stageFilter);
    }
    if (statusFilter) {
      logsQuery = logsQuery.eq('status', statusFilter);
    }

    const { data: logsData, error: logsError } = await logsQuery;

    if (logsError) {
      console.error('Fetch pipeline_logs error:', logsError);
      return NextResponse.json(
        { error: 'Failed to fetch pipeline logs' },
        { status: 500 }
      );
    }

    const logs = (logsData ?? []) as PipelineLog[];

    // Fetch ALL logs (unfiltered) for summary computation
    const { data: allLogsData } = await supabase
      .from('pipeline_logs')
      .select('stage, status, duration_ms, created_at')
      .eq('solicitation_id', solicitationId)
      .order('created_at', { ascending: true });

    const allLogs = allLogsData ?? [];

    // Compute summary
    const byStatus: Record<string, number> = {};
    const byStage: Record<string, { status: string; duration_ms: number | null }> = {};
    const startedStages = new Set<string>();
    const completedStages = new Set<string>();
    const failedStages = new Set<string>();

    let firstStarted: string | null = null;
    let lastCompleted: string | null = null;

    for (const log of allLogs) {
      // Count by status
      byStatus[log.status] = (byStatus[log.status] || 0) + 1;

      // Track latest status per stage
      byStage[log.stage] = {
        status: log.status,
        duration_ms: log.duration_ms ?? null,
      };

      // Track stage state sets
      if (log.status === 'started') {
        startedStages.add(log.stage);
        if (!firstStarted || log.created_at < firstStarted) {
          firstStarted = log.created_at;
        }
      }
      if (log.status === 'completed') {
        completedStages.add(log.stage);
        if (!lastCompleted || log.created_at > lastCompleted) {
          lastCompleted = log.created_at;
        }
      }
      if (log.status === 'failed') {
        failedStages.add(log.stage);
      }
    }

    // In-progress = started but NOT completed and NOT failed
    const inProgressStages = [...startedStages].filter(
      s => !completedStages.has(s) && !failedStages.has(s)
    );

    // Pipeline duration
    let pipelineDurationMs: number | null = null;
    if (firstStarted && lastCompleted) {
      pipelineDurationMs = new Date(lastCompleted).getTime() - new Date(firstStarted).getTime();
    }

    const summary: PipelineSummary = {
      total_events: allLogs.length,
      by_status: byStatus,
      by_stage: byStage,
      pipeline_duration_ms: pipelineDurationMs,
      stages_completed: [...completedStages],
      stages_failed: [...failedStages],
      stages_in_progress: inProgressStages,
    };

    return NextResponse.json({ logs, summary });
  } catch (error) {
    console.error('Pipeline logs GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
