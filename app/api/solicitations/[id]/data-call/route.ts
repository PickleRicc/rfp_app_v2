/**
 * GET /api/solicitations/[id]/data-call
 * Returns the RFP-specific form schema (generated from compliance extractions),
 * the saved data call response (if any), and uploaded files for this solicitation.
 * Response shape: { schema: DataCallFormSchema, response: DataCallResponse | null, files: DataCallFile[] }
 *
 * PUT /api/solicitations/[id]/data-call
 * Upserts (save or update) a data call response for this solicitation + company.
 * Supports partial saves — all section fields are optional.
 * Body: { opportunity_details?, past_performance?, key_personnel?, technical_approach?, compliance_verification?, status? }
 * Response shape: { response: DataCallResponse }
 *
 * Both endpoints require:
 * - requireStaffOrResponse() auth
 * - X-Company-Id header
 * - Solicitation must belong to the requesting company
 *
 * Per phase decision: "Manual Save Progress button — no auto-save"
 * Per phase decision: "Allows saving partial/incomplete data without validation blocking"
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';
import { requireStaffOrResponse } from '@/lib/auth';
import { generateDataCallSchema } from '@/lib/ingestion/data-call-generator';
import { validateBlockingFields } from '@/lib/validation/blocking-validators';
import type {
  DataCallResponse,
  DataCallFile,
  DataCallSaveRequest,
} from '@/lib/supabase/tier2-types';

// ===== GET =====

/**
 * GET /api/solicitations/[id]/data-call
 *
 * Generates (or returns cached) form schema and loads any existing saved data.
 * The form schema is derived from Phase 7 compliance extractions, so it reflects
 * exactly what this specific RFP requires (dynamic reference counts, key personnel
 * positions, security requirements, required attachments).
 *
 * If the solicitation has no saved data call response yet, response is null.
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

    // Generate the RFP-specific form schema from compliance extractions
    // Pass companyId to enable Tier 1 company intake pre-fill (facility clearance, certs, NAICS)
    const schema = await generateDataCallSchema(solicitationId, companyId);

    // Fetch any existing saved data call response for this solicitation + company
    const { data: response, error: responseError } = await supabase
      .from('data_call_responses')
      .select('*')
      .eq('solicitation_id', solicitationId)
      .eq('company_id', companyId)
      .maybeSingle();

    if (responseError) {
      console.error('Fetch data call response error:', responseError);
      return NextResponse.json(
        { error: 'Failed to fetch saved data call response' },
        { status: 500 }
      );
    }

    // Fetch uploaded files for this data call response (if response exists)
    let files: DataCallFile[] = [];
    if (response?.id) {
      const { data: filesData, error: filesError } = await supabase
        .from('data_call_files')
        .select('*')
        .eq('data_call_response_id', response.id)
        .order('created_at', { ascending: true });

      if (filesError) {
        console.error('Fetch data call files error:', filesError);
        // Non-fatal — return empty files rather than failing the whole request
        files = [];
      } else {
        files = (filesData ?? []) as DataCallFile[];
      }
    }

    return NextResponse.json({
      schema,
      response: (response as DataCallResponse | null) ?? null,
      files,
    });
  } catch (error) {
    console.error('Data call GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ===== PUT =====

/**
 * PUT /api/solicitations/[id]/data-call
 *
 * Saves (upserts) a data call response for this solicitation + company.
 * Uses ON CONFLICT (solicitation_id, company_id) DO UPDATE so the same endpoint
 * handles both initial save and subsequent updates.
 *
 * All section fields are optional — partial saves are supported without validation.
 * When status = 'completed', completed_at is set to now().
 *
 * The form_schema is NOT updated on PUT — it is generated fresh on GET.
 * Use GET to refresh the schema after compliance extractions change.
 */
export async function PUT(
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

    const body = await request.json() as DataCallSaveRequest;

    // Build the upsert payload — only include fields present in the request body
    const now = new Date().toISOString();
    const upsertData: Record<string, unknown> = {
      solicitation_id: solicitationId,
      company_id:      companyId,
      updated_at:      now,
    };

    if (body.opportunity_details !== undefined) {
      upsertData.opportunity_details = body.opportunity_details;
    }
    if (body.past_performance !== undefined) {
      upsertData.past_performance = body.past_performance;
    }
    if (body.key_personnel !== undefined) {
      upsertData.key_personnel = body.key_personnel;
    }
    if (body.technical_approach !== undefined) {
      upsertData.technical_approach = body.technical_approach;
    }
    if (body.compliance_verification !== undefined) {
      upsertData.compliance_verification = body.compliance_verification;
    }
    if (body.service_area_approaches !== undefined) {
      upsertData.service_area_approaches = body.service_area_approaches;
    }
    if (body.site_staffing !== undefined) {
      upsertData.site_staffing = body.site_staffing;
    }
    if (body.technology_selections !== undefined) {
      upsertData.technology_selections = body.technology_selections;
    }
    if (body.status !== undefined) {
      upsertData.status = body.status;
      // Set completed_at when marking as completed
      if (body.status === 'completed') {
        // Server-side blocking field validation: verify all compliance-critical fields
        // are populated and valid before allowing the data call to be marked complete.
        const schema = await generateDataCallSchema(solicitationId, companyId);
        const blockingErrors = validateBlockingFields(schema, body as Record<string, unknown>);

        if (blockingErrors.length > 0) {
          return NextResponse.json(
            {
              error: 'Cannot complete data call: compliance-blocking fields are missing or invalid',
              blocking_errors: blockingErrors,
            },
            { status: 422 }
          );
        }

        upsertData.completed_at = now;
      }
    }

    // Upsert — insert on first save, update on subsequent saves
    const { data: updatedResponse, error: upsertError } = await supabase
      .from('data_call_responses')
      .upsert(upsertData, {
        onConflict:        'solicitation_id,company_id',
        ignoreDuplicates:  false,
      })
      .select('*')
      .single();

    if (upsertError || !updatedResponse) {
      console.error('Upsert data call response error:', upsertError);
      return NextResponse.json(
        { error: 'Failed to save data call response' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      response: updatedResponse as DataCallResponse,
      message: body.status === 'completed'
        ? 'Data call marked as completed'
        : 'Data call progress saved',
    });
  } catch (error) {
    console.error('Data call PUT error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
