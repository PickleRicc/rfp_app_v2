/**
 * GET /api/solicitations/[id]/draft
 * Returns the strategy confirmation summary assembled from three data sources
 * (Tier 1 company profile, Tier 2 data call response, compliance extractions)
 * plus the current draft status and per-volume generation states.
 * Response shape: DraftGetResponse = { strategy, draft, volumes }
 *
 * POST /api/solicitations/[id]/draft
 * Triggers proposal draft generation. Validates that the data call is completed,
 * upserts the proposal_drafts row, deletes old draft_volumes, creates new pending
 * volume rows from Section L extraction, and sends the Inngest generation event.
 * Response shape: { draft, volumes, message }
 *
 * Both endpoints require:
 * - requireStaffOrResponse() auth
 * - X-Company-Id header
 * - Solicitation must belong to the requesting company
 *
 * Per CONTEXT.md decisions:
 * - "Confirm & Generate starts generation immediately"
 * - "Regenerate Draft button replaces the old draft (no versioning)"
 * - "User cannot edit on Strategy Confirmation screen"
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';
import { requireStaffOrResponse } from '@/lib/auth';
import { inngest } from '@/lib/inngest/client';
import { generateDataCallSchema } from '@/lib/ingestion/data-call-generator';
import { validateBlockingFields } from '@/lib/validation/blocking-validators';
import type {
  ProposalDraft,
  DraftVolume,
  StrategyConfirmation,
  StrategyVolume,
  StrategyEvalFactor,
  StrategyPersonnel,
} from '@/lib/supabase/draft-types';
import type { KeyPersonnelEntry } from '@/lib/supabase/tier2-types';
import type {
  SectionLFields,
  SectionMFields,
  ComplianceExtractionsByCategory,
  ExtractionCategory,
} from '@/lib/supabase/compliance-types';
import { detectContractStyle } from '@/lib/generation/draft/prompt-assembler';

// ===== HELPERS =====

/**
 * Assemble StrategyConfirmation from three data sources.
 * Queries: company_profiles, data_call_responses, compliance_extractions
 * Returns null if the data call response does not exist.
 */
async function assembleStrategyConfirmation(
  solicitationId: string,
  companyId: string
): Promise<StrategyConfirmation> {
  const supabase = getServerClient();

  // --- Tier 1: company_profiles ---
  const { data: company } = await supabase
    .from('company_profiles')
    .select(
      'company_name, legal_name, uei_number, cage_code, enterprise_win_themes, key_differentiators_summary'
    )
    .eq('id', companyId)
    .maybeSingle();

  // --- Tier 2: data_call_responses ---
  const { data: dataCall } = await supabase
    .from('data_call_responses')
    .select('opportunity_details, past_performance, key_personnel')
    .eq('solicitation_id', solicitationId)
    .eq('company_id', companyId)
    .maybeSingle();

  // --- Extractions: Section L (volume_structure) ---
  const { data: sectionLRows } = await supabase
    .from('compliance_extractions')
    .select('field_name, field_value')
    .eq('solicitation_id', solicitationId)
    .eq('category', 'section_l')
    .eq('field_name', 'volume_structure');

  // --- Extractions: Section M (evaluation_factors) ---
  const { data: sectionMRows } = await supabase
    .from('compliance_extractions')
    .select('field_name, field_value')
    .eq('solicitation_id', solicitationId)
    .eq('category', 'section_m')
    .eq('field_name', 'evaluation_factors');

  // --- Extractions: operational_context (agency, sites, users) ---
  const { data: opCtxRows } = await supabase
    .from('compliance_extractions')
    .select('field_name, field_value')
    .eq('solicitation_id', solicitationId)
    .eq('category', 'operational_context');

  // --- Extractions: technology_reqs (platforms count) ---
  const { data: techReqRows } = await supabase
    .from('compliance_extractions')
    .select('field_name, field_value')
    .eq('solicitation_id', solicitationId)
    .eq('category', 'technology_reqs');

  // --- Extractions: sow_pws (service areas, document type) ---
  const { data: sowPwsRows } = await supabase
    .from('compliance_extractions')
    .select('field_name, field_value')
    .eq('solicitation_id', solicitationId)
    .eq('category', 'sow_pws');

  // --- Parse Section L volume_structure ---
  let volumeStructure: StrategyVolume[] = [];
  if (sectionLRows && sectionLRows.length > 0) {
    const sectionLValue = sectionLRows[0].field_value as SectionLFields['volume_structure'];
    if (sectionLValue?.volumes) {
      volumeStructure = sectionLValue.volumes.map(v => ({
        name: v.name,
        page_limit: v.page_limit ?? null,
      }));
    }
  }

  // --- Parse Section M evaluation_factors ---
  let evaluationFactors: StrategyEvalFactor[] = [];
  if (sectionMRows && sectionMRows.length > 0) {
    const sectionMValue = sectionMRows[0].field_value as SectionMFields['evaluation_factors'];
    if (Array.isArray(sectionMValue)) {
      evaluationFactors = sectionMValue.map(f => ({
        name: f.name,
        weight: f.weight_description ?? null,
      }));
    }
  }

  // --- Parse Tier 2 key_personnel ---
  const keyPersonnel: StrategyPersonnel[] = [];
  if (dataCall?.key_personnel && Array.isArray(dataCall.key_personnel)) {
    for (const entry of dataCall.key_personnel as KeyPersonnelEntry[]) {
      keyPersonnel.push({ role: entry.role, name: entry.name });
    }
  }

  // --- Parse Tier 2 opportunity_details ---
  const oppDetails = (dataCall?.opportunity_details ?? {}) as {
    prime_or_sub?: 'prime' | 'sub' | 'teaming' | null;
    teaming_partners?: string[];
    contract_type?: string | null;
    naics_code?: string | null;
    set_aside?: string | null;
  };

  // --- Past performance count ---
  const pastPerformanceCount = Array.isArray(dataCall?.past_performance)
    ? (dataCall.past_performance as unknown[]).length
    : 0;

  // --- Parse enriched extraction data ---
  const opCtxMap = new Map<string, unknown>();
  for (const row of opCtxRows || []) {
    opCtxMap.set(row.field_name, row.field_value);
  }

  const sowPwsMap = new Map<string, unknown>();
  for (const row of sowPwsRows || []) {
    sowPwsMap.set(row.field_name, row.field_value);
  }

  // Count technology platforms (required + infrastructure)
  const requiredPlatforms = (techReqRows || []).find(r => r.field_name === 'required_platforms');
  const infraPlatforms = (techReqRows || []).find(r => r.field_name === 'infrastructure_platforms');
  const technologyCount =
    (Array.isArray(requiredPlatforms?.field_value) ? requiredPlatforms.field_value.length : 0) +
    (Array.isArray(infraPlatforms?.field_value) ? infraPlatforms.field_value.length : 0);

  // Count sites from operational_context
  const sitesValue = opCtxMap.get('sites');
  const siteCount = Array.isArray(sitesValue) ? sitesValue.length : 0;

  // Service area count from sow_pws
  const serviceAreaCount = Number(sowPwsMap.get('total_service_areas') || 0);

  // Auto-detect contract style using extraction data
  // Build minimal ComplianceExtractionsByCategory for detectContractStyle
  const allCategories: ExtractionCategory[] = [
    'section_l', 'section_m', 'admin_data', 'rating_scales',
    'sow_pws', 'cost_price', 'past_performance', 'key_personnel',
    'security_reqs', 'operational_context', 'technology_reqs',
  ];
  const extractionsByCategory = {} as ComplianceExtractionsByCategory;
  for (const cat of allCategories) {
    extractionsByCategory[cat] = [];
  }

  // Populate sow_pws, operational_context, technology_reqs for style detection
  for (const row of sowPwsRows || []) {
    extractionsByCategory.sow_pws.push({
      id: '', solicitation_id: solicitationId, category: 'sow_pws',
      field_name: row.field_name, field_label: row.field_name,
      field_value: row.field_value, confidence: 'high',
      is_user_override: false, extraction_status: 'completed',
      created_at: '', updated_at: '',
    });
  }
  for (const row of opCtxRows || []) {
    extractionsByCategory.operational_context.push({
      id: '', solicitation_id: solicitationId, category: 'operational_context',
      field_name: row.field_name, field_label: row.field_name,
      field_value: row.field_value, confidence: 'high',
      is_user_override: false, extraction_status: 'completed',
      created_at: '', updated_at: '',
    });
  }
  for (const row of techReqRows || []) {
    extractionsByCategory.technology_reqs.push({
      id: '', solicitation_id: solicitationId, category: 'technology_reqs',
      field_name: row.field_name, field_label: row.field_name,
      field_value: row.field_value, confidence: 'high',
      is_user_override: false, extraction_status: 'completed',
      created_at: '', updated_at: '',
    });
  }

  const detectedContractStyle = detectContractStyle(extractionsByCategory);

  return {
    // Tier 1
    company_name:               company?.company_name ?? '',
    legal_name:                 company?.legal_name ?? '',
    uei_number:                 company?.uei_number ?? '',
    cage_code:                  company?.cage_code ?? '',
    enterprise_win_themes:      Array.isArray(company?.enterprise_win_themes) ? company.enterprise_win_themes as string[] : [],
    key_differentiators_summary: (company?.key_differentiators_summary as string | null) ?? null,

    // Tier 2 opportunity details
    prime_or_sub:               oppDetails.prime_or_sub ?? null,
    teaming_partners:           Array.isArray(oppDetails.teaming_partners) ? oppDetails.teaming_partners : [],
    contract_type:              oppDetails.contract_type ?? null,
    naics_code:                 oppDetails.naics_code ?? null,
    set_aside:                  oppDetails.set_aside ?? null,

    // Tier 2 key personnel
    key_personnel:              keyPersonnel,

    // Tier 2 past performance
    past_performance_count:     pastPerformanceCount,

    // Extractions
    volume_structure:           volumeStructure,
    evaluation_factors:         evaluationFactors,

    // Enriched extraction data
    agency_name:                (opCtxMap.get('agency_name') as string) ?? null,
    contract_scope_summary:     (opCtxMap.get('contract_scope_summary') as string) ?? null,
    user_count:                 (opCtxMap.get('user_count') as string) ?? null,
    site_count:                 siteCount,
    service_area_count:         serviceAreaCount,
    requires_contractor_pws:    Boolean(sowPwsMap.get('requires_contractor_pws')),
    document_type:              (sowPwsMap.get('document_type') as string) ?? null,
    detected_contract_style:    detectedContractStyle,
    technology_count:           technologyCount,
  };
}

// ===== GET =====

/**
 * GET /api/solicitations/[id]/draft
 *
 * Assembles the strategy confirmation from all three data sources and returns
 * current draft status and volume states.
 *
 * If no draft has been triggered yet: draft is null, volumes is empty.
 */
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
      .select('id, solicitation_number, status')
      .eq('id', solicitationId)
      .eq('company_id', companyId)
      .maybeSingle();

    if (!solicitation) {
      return NextResponse.json(
        { error: 'Solicitation not found' },
        { status: 404 }
      );
    }

    // Assemble strategy confirmation from all three data sources
    const strategy = await assembleStrategyConfirmation(solicitationId, companyId);

    // Fetch existing draft (if any)
    const { data: draft, error: draftError } = await supabase
      .from('proposal_drafts')
      .select('*')
      .eq('solicitation_id', solicitationId)
      .eq('company_id', companyId)
      .maybeSingle();

    if (draftError) {
      console.error('Fetch proposal_drafts error:', draftError);
      return NextResponse.json(
        { error: 'Failed to fetch draft status' },
        { status: 500 }
      );
    }

    // Fetch volumes ordered by volume_order
    let volumes: DraftVolume[] = [];
    if (draft?.id) {
      const { data: volumesData, error: volumesError } = await supabase
        .from('draft_volumes')
        .select('*')
        .eq('draft_id', draft.id)
        .order('volume_order', { ascending: true });

      if (volumesError) {
        console.error('Fetch draft_volumes error:', volumesError);
        // Non-fatal — return empty volumes rather than failing the request
        volumes = [];
      } else {
        volumes = (volumesData ?? []) as DraftVolume[];
      }
    }

    return NextResponse.json({
      strategy,
      draft: (draft as ProposalDraft | null) ?? null,
      volumes,
    });
  } catch (error) {
    console.error('Draft GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ===== POST =====

/**
 * POST /api/solicitations/[id]/draft
 *
 * Triggers proposal draft generation.
 *
 * Validates:
 * 1. Solicitation ownership
 * 2. Data call response must be status='completed'
 *
 * Then:
 * 3. Upserts proposal_drafts row (pending, strategy_confirmed_at=now)
 * 4. Deletes existing draft_volumes (regeneration overwrites old draft)
 * 5. Creates pending draft_volumes from Section L volume_structure
 * 6. Sends Inngest event: proposal.draft.generate
 */
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
      return NextResponse.json(
        { error: 'X-Company-Id header is required' },
        { status: 400 }
      );
    }

    // Parse optional body for graphicsProfile
    let graphicsProfile: 'minimal' | 'standard' = 'minimal';
    try {
      const body = await request.json().catch(() => ({}));
      if (body.graphicsProfile === 'standard') {
        graphicsProfile = 'standard';
      }
    } catch {
      // No body or invalid JSON — use default
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

    // Validate: data call must be completed before generating draft
    const { data: dataCall } = await supabase
      .from('data_call_responses')
      .select('id, status')
      .eq('solicitation_id', solicitationId)
      .eq('company_id', companyId)
      .maybeSingle();

    if (!dataCall || dataCall.status !== 'completed') {
      return NextResponse.json(
        { error: 'Data call must be completed before generating draft' },
        { status: 400 }
      );
    }

    // Pre-draft compliance gate: re-validate all blocking fields.
    // Handles edge case where extractions were re-run after data call completion
    // (e.g., new amendment added), which may introduce new blocking requirements.
    const { data: fullDataCall } = await supabase
      .from('data_call_responses')
      .select('opportunity_details, past_performance, key_personnel, technical_approach, compliance_verification, service_area_approaches, site_staffing, technology_selections')
      .eq('solicitation_id', solicitationId)
      .eq('company_id', companyId)
      .maybeSingle();

    if (fullDataCall) {
      const schema = await generateDataCallSchema(solicitationId, companyId);
      const blockingErrors = validateBlockingFields(schema, fullDataCall as Record<string, unknown>);

      if (blockingErrors.length > 0) {
        return NextResponse.json(
          {
            error: 'Cannot generate draft: compliance-blocking fields need attention',
            code: 'BLOCKING_FIELDS_INVALID',
            blocking_errors: blockingErrors,
          },
          { status: 422 }
        );
      }
    }

    // Fetch Section L volume_structure for creating draft_volumes
    const { data: sectionLRows } = await supabase
      .from('compliance_extractions')
      .select('field_value')
      .eq('solicitation_id', solicitationId)
      .eq('category', 'section_l')
      .eq('field_name', 'volume_structure');

    let volumeStructure: Array<{ name: string; page_limit: number | null }> = [];
    if (sectionLRows && sectionLRows.length > 0) {
      const sectionLValue = sectionLRows[0].field_value as SectionLFields['volume_structure'];
      if (sectionLValue?.volumes) {
        volumeStructure = sectionLValue.volumes.map(v => ({
          name: v.name,
          page_limit: v.page_limit ?? null,
        }));
      }
    }

    // If no volumes extracted from Section L, use default structure
    if (volumeStructure.length === 0) {
      volumeStructure = [
        { name: 'Technical Approach', page_limit: null },
        { name: 'Management',          page_limit: null },
        { name: 'Past Performance',    page_limit: null },
        { name: 'Cost/Price',          page_limit: null },
      ];
    }

    const now = new Date().toISOString();

    // Upsert proposal_drafts row (regeneration resets existing row)
    const { data: draft, error: draftError } = await supabase
      .from('proposal_drafts')
      .upsert(
        {
          solicitation_id:       solicitationId,
          company_id:            companyId,
          status:                'pending',
          strategy_confirmed_at: now,
          generation_started_at: null,
          generation_completed_at: null,
          error_message:         null,
          updated_at:            now,
        },
        { onConflict: 'solicitation_id,company_id', ignoreDuplicates: false }
      )
      .select('*')
      .single();

    if (draftError || !draft) {
      console.error('Upsert proposal_drafts error:', draftError);
      return NextResponse.json(
        { error: 'Failed to create draft record' },
        { status: 500 }
      );
    }

    // Delete existing draft_volumes (regeneration overwrites per CONTEXT.md decision)
    const { error: deleteError } = await supabase
      .from('draft_volumes')
      .delete()
      .eq('draft_id', draft.id);

    if (deleteError) {
      console.error('Delete draft_volumes error:', deleteError);
      return NextResponse.json(
        { error: 'Failed to reset draft volumes' },
        { status: 500 }
      );
    }

    // Create pending draft_volumes from Section L volume_structure
    const volumeInserts = volumeStructure.map((vol, index) => ({
      draft_id:     draft.id,
      volume_name:  vol.name,
      volume_order: index + 1,
      status:       'pending' as const,
      page_limit:   vol.page_limit,
      created_at:   now,
      updated_at:   now,
    }));

    const { data: volumes, error: insertError } = await supabase
      .from('draft_volumes')
      .insert(volumeInserts)
      .select('*');

    if (insertError) {
      console.error('Insert draft_volumes error:', insertError);
      return NextResponse.json(
        { error: 'Failed to create draft volume records' },
        { status: 500 }
      );
    }

    // Send Inngest event to trigger generation pipeline
    await inngest.send({
      name: 'proposal.draft.generate',
      data: {
        solicitationId,
        companyId,
        draftId: draft.id,
        graphicsProfile,
      },
    });

    return NextResponse.json({
      draft: draft as ProposalDraft,
      volumes: (volumes ?? []) as DraftVolume[],
      message: 'Draft generation started',
    });
  } catch (error) {
    console.error('Draft POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
