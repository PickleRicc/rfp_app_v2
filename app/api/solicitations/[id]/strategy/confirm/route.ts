/**
 * POST /api/solicitations/[id]/strategy/confirm
 *
 * Confirms the strategy (sets confirmed_at), then triggers draft generation —
 * same Inngest pipeline as the existing draft POST, but now passes strategy_id
 * in the event payload so the generator can load it.
 *
 * Body: StrategyConfirmRequest { graphics_profile?: 'minimal' | 'standard' }
 *
 * Requires:
 * - requireStaffOrResponse() auth
 * - X-Company-Id header
 * - Solicitation must belong to the requesting company
 * - data_call_responses.status === 'completed'
 * - solicitation_strategies row must exist (PUT /strategy first)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';
import { requireStaffOrResponse } from '@/lib/auth';
import { inngest } from '@/lib/inngest/client';
import { validateBlockingFields } from '@/lib/validation/blocking-validators';
import { generateDataCallSchema } from '@/lib/ingestion/data-call-generator';
import type { StrategyConfirmRequest } from '@/lib/supabase/strategy-types';
import type {
  ComplianceExtractionsByCategory,
  ExtractionCategory,
  SectionLFields,
} from '@/lib/supabase/compliance-types';

const ALL_EXTRACTION_CATEGORIES: ExtractionCategory[] = [
  'section_l', 'section_m', 'admin_data', 'rating_scales', 'sow_pws',
  'cost_price', 'past_performance', 'key_personnel', 'security_reqs',
  'operational_context', 'technology_reqs',
];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffOrResponse();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id: solicitationId } = await params;
    const companyId = request.headers.get('X-Company-Id');

    if (!companyId) {
      return NextResponse.json({ error: 'X-Company-Id header is required' }, { status: 400 });
    }

    const body = (await request.json()) as StrategyConfirmRequest;
    const graphicsProfile = body.graphics_profile ?? 'minimal';

    const supabase = getServerClient();

    // Verify solicitation belongs to company
    const { data: solicitation } = await supabase
      .from('solicitations')
      .select('id')
      .eq('id', solicitationId)
      .eq('company_id', companyId)
      .maybeSingle();

    if (!solicitation) {
      return NextResponse.json({ error: 'Solicitation not found' }, { status: 404 });
    }

    // Verify strategy exists
    const { data: strategy } = await supabase
      .from('solicitation_strategies')
      .select('id')
      .eq('solicitation_id', solicitationId)
      .eq('company_id', companyId)
      .maybeSingle();

    if (!strategy) {
      return NextResponse.json(
        { error: 'Strategy not found. Save strategy before confirming.' },
        { status: 400 }
      );
    }

    // Verify data call is completed
    const { data: dataCall } = await supabase
      .from('data_call_responses')
      .select('id, status, opportunity_details, past_performance, key_personnel, technical_approach, compliance_verification, service_area_approaches, site_staffing, technology_selections, form_schema')
      .eq('solicitation_id', solicitationId)
      .eq('company_id', companyId)
      .maybeSingle();

    if (!dataCall || dataCall.status !== 'completed') {
      return NextResponse.json(
        { error: 'Data call must be completed before generating a draft.' },
        { status: 400 }
      );
    }

    // Run blocking field validation gate
    const { data: extractionRows } = await supabase
      .from('compliance_extractions')
      .select('category, field_name, field_value')
      .eq('solicitation_id', solicitationId);

    const extractionsByCategory = {} as ComplianceExtractionsByCategory;
    for (const cat of ALL_EXTRACTION_CATEGORIES) {
      extractionsByCategory[cat] = [];
    }
    for (const row of extractionRows ?? []) {
      const cat = row.category as ExtractionCategory;
      if (extractionsByCategory[cat]) {
        extractionsByCategory[cat].push(row as never);
      }
    }

    const schema = dataCall.form_schema ?? await generateDataCallSchema(solicitationId, companyId);
    const blockingErrors = validateBlockingFields(schema, dataCall as Record<string, unknown>);

    if (blockingErrors.length > 0) {
      return NextResponse.json(
        { error: 'BLOCKING_FIELDS_INVALID', blocking_errors: blockingErrors },
        { status: 422 }
      );
    }

    // Parse Section L volume structure
    const sectionLRows = extractionsByCategory.section_l;
    const volumeStructureRow = sectionLRows.find(r => r.field_name === 'volume_structure');
    const volumeStructure = (volumeStructureRow?.field_value as SectionLFields['volume_structure'])?.volumes ?? [
      { name: 'Technical Approach', page_limit: null },
      { name: 'Management', page_limit: null },
      { name: 'Past Performance', page_limit: null },
      { name: 'Cost/Price', page_limit: null },
    ];

    // Upsert proposal_drafts row
    const { data: draft, error: draftError } = await supabase
      .from('proposal_drafts')
      .upsert(
        {
          solicitation_id: solicitationId,
          company_id: companyId,
          status: 'pending',
          strategy_confirmed_at: new Date().toISOString(),
          generation_started_at: null,
          generation_completed_at: null,
          error_message: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'solicitation_id,company_id' }
      )
      .select()
      .single();

    if (draftError || !draft) {
      console.error('Draft upsert error:', draftError);
      return NextResponse.json({ error: 'Failed to create draft record' }, { status: 500 });
    }

    // Delete old draft volumes (regeneration overwrites)
    await supabase.from('draft_volumes').delete().eq('draft_id', draft.id);

    // Insert new pending volume rows
    const volumeInserts = volumeStructure.map((v, i) => ({
      draft_id: draft.id,
      volume_name: v.name,
      volume_order: i + 1,
      status: 'pending',
      page_limit: v.page_limit ?? null,
    }));

    const { data: volumes, error: volError } = await supabase
      .from('draft_volumes')
      .insert(volumeInserts)
      .select();

    if (volError) {
      console.error('Volume insert error:', volError);
      return NextResponse.json({ error: 'Failed to create volume records' }, { status: 500 });
    }

    // Mark strategy as confirmed
    await supabase
      .from('solicitation_strategies')
      .update({ confirmed_at: new Date().toISOString() })
      .eq('id', strategy.id);

    // Fire Inngest generation event — includes strategy_id so generator can load it
    await inngest.send({
      name: 'proposal.draft.generate',
      data: {
        solicitationId,
        companyId,
        draftId: draft.id,
        strategyId: strategy.id,
        graphicsProfile,
      },
    });

    return NextResponse.json({
      draft,
      volumes: volumes ?? [],
      message: 'Draft generation started',
    });
  } catch (error) {
    console.error('Strategy confirm error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
