/**
 * GET /api/solicitations/[id]/compliance
 * Returns compliance extractions grouped by category with extraction_status per row.
 * Response shape: { extractions: { section_l: [...], section_m: [...], admin_data: [...], rating_scales: [...], sow_pws: [...], cost_price: [...], past_performance: [...], key_personnel: [...], security_reqs: [...] } }
 *
 * PATCH /api/solicitations/[id]/compliance
 * Supports three operations:
 * 1. Edit a value:      { extraction_id, field_value } — sets is_user_override=true, preserves original_ai_value
 * 2. Re-extract:        { category, action: 're-extract' } — resets category to pending, sends Inngest event
 * 3. Revert override:   { extraction_id, action: 'revert' } — restores original_ai_value, clears override flag
 *
 * Both endpoints require:
 * - requireStaffOrResponse() auth
 * - X-Company-Id header
 * - Solicitation must belong to the requesting company
 *
 * Per user decision: "Each section updates independently as extraction completes"
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';
import { requireStaffOrResponse } from '@/lib/auth';
import { inngest } from '@/lib/inngest/client';
import type {
  ExtractionCategory,
  ComplianceExtraction,
  ComplianceExtractionsByCategory,
} from '@/lib/supabase/compliance-types';

// ===== GET =====

/**
 * GET /api/solicitations/[id]/compliance
 *
 * Returns all compliance extractions for the solicitation, grouped by category.
 * Includes extraction_status per row so the UI can show loading states for
 * categories still being processed by the Inngest pipeline.
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

    // Fetch all compliance extractions for this solicitation
    const { data: extractions, error } = await supabase
      .from('compliance_extractions')
      .select(
        `
        id,
        solicitation_id,
        source_document_id,
        category,
        field_name,
        field_label,
        field_value,
        confidence,
        is_user_override,
        original_ai_value,
        amendment_source_id,
        amendment_note,
        extraction_status,
        error_message,
        created_at,
        updated_at
      `
      )
      .eq('solicitation_id', solicitationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Fetch compliance extractions error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch compliance extractions' },
        { status: 500 }
      );
    }

    // Group results by category
    // All 9 extraction categories
    const grouped: ComplianceExtractionsByCategory = {
      section_l:        [],
      section_m:        [],
      admin_data:       [],
      rating_scales:    [],
      sow_pws:          [],
      cost_price:       [],
      past_performance: [],
      key_personnel:    [],
      security_reqs:    [],
    };

    for (const row of extractions || []) {
      const category = row.category as ExtractionCategory;
      if (grouped[category]) {
        grouped[category].push(row as ComplianceExtraction);
      }
    }

    return NextResponse.json({
      solicitation_id:     solicitationId,
      solicitation_number: solicitation.solicitation_number,
      solicitation_status: solicitation.status,
      extractions:         grouped,
      total_count:         (extractions || []).length,
    });
  } catch (error) {
    console.error('Compliance GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ===== PATCH =====

/**
 * PATCH /api/solicitations/[id]/compliance
 *
 * Handles three distinct operations based on request body shape:
 *
 * 1. Edit extraction value:
 *    Body: { extraction_id: string, field_value: unknown }
 *    - Sets is_user_override=true
 *    - Saves original AI value to original_ai_value (only on first override)
 *
 * 2. Re-extract a category:
 *    Body: { category: ExtractionCategory, action: 're-extract' }
 *    - Resets non-overridden extractions for category to extraction_status='pending'
 *    - Sends solicitation.compliance.re-extract Inngest event
 *
 * 3. Revert user override:
 *    Body: { extraction_id: string, action: 'revert' }
 *    - Restores original_ai_value to field_value
 *    - Clears is_user_override flag
 */
export async function PATCH(
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

    const body = await request.json() as {
      extraction_id?: string;
      field_value?: unknown;
      category?: ExtractionCategory;
      action?: 'extract-all' | 're-extract' | 'revert';
    };

    // ─── Operation 1: Edit a value ───────────────────────────────────────────
    if (body.extraction_id && body.action !== 're-extract' && body.action !== 'revert') {
      if (body.field_value === undefined) {
        return NextResponse.json(
          { error: 'field_value is required when editing an extraction' },
          { status: 400 }
        );
      }

      // Verify extraction belongs to this solicitation
      const { data: existing, error: fetchError } = await supabase
        .from('compliance_extractions')
        .select('id, field_value, is_user_override, original_ai_value')
        .eq('id', body.extraction_id)
        .eq('solicitation_id', solicitationId)
        .maybeSingle();

      if (fetchError || !existing) {
        return NextResponse.json(
          { error: 'Extraction not found or does not belong to this solicitation' },
          { status: 404 }
        );
      }

      // Only store original_ai_value on first override — don't overwrite if already set
      const originalAiValue = existing.is_user_override
        ? existing.original_ai_value
        : existing.field_value;

      const { data: updated, error: updateError } = await supabase
        .from('compliance_extractions')
        .update({
          field_value:      body.field_value,
          is_user_override: true,
          original_ai_value: originalAiValue,
          updated_at:       new Date().toISOString(),
        })
        .eq('id', body.extraction_id)
        .eq('solicitation_id', solicitationId)
        .select()
        .single();

      if (updateError || !updated) {
        console.error('Update extraction error:', updateError);
        return NextResponse.json(
          { error: 'Failed to update extraction value' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        extraction: updated,
        message:    'Extraction value updated — user override applied',
      });
    }

    // ─── Operation 2a: Extract all (initial extraction trigger) ──────────────
    if (body.action === 'extract-all') {
      await inngest.send({
        name: 'solicitation.reconciliation.complete',
        data: { solicitationId },
      });

      return NextResponse.json({
        message: 'Full compliance extraction triggered',
        note:    'All 9 categories will be extracted via Inngest pipeline',
      });
    }

    // ─── Operation 2b: Re-extract a category ─────────────────────────────────
    if (body.action === 're-extract') {
      const validCategories: ExtractionCategory[] = [
        'section_l', 'section_m', 'admin_data', 'rating_scales',
        'sow_pws', 'cost_price', 'past_performance', 'key_personnel', 'security_reqs',
      ];

      if (!body.category || !validCategories.includes(body.category)) {
        return NextResponse.json(
          { error: 'Valid category is required for re-extract action' },
          { status: 400 }
        );
      }

      // Reset non-overridden extractions in the category to 'pending'
      // Preserve user overrides — those rows are intentional user decisions
      const { error: resetError } = await supabase
        .from('compliance_extractions')
        .update({
          extraction_status: 'pending',
          error_message:     null,
          updated_at:        new Date().toISOString(),
        })
        .eq('solicitation_id', solicitationId)
        .eq('category', body.category)
        .eq('is_user_override', false);

      if (resetError) {
        console.error('Reset extraction category error:', resetError);
        return NextResponse.json(
          { error: 'Failed to reset extraction category' },
          { status: 500 }
        );
      }

      // Trigger extraction for just this category
      await inngest.send({
        name: 'solicitation.reconciliation.complete',
        data: { solicitationId, category: body.category },
      });

      return NextResponse.json({
        message:  `Re-extraction triggered for ${body.category}`,
        category: body.category,
        note:     'User-overridden values preserved — only AI-extracted values will be re-processed',
      });
    }

    // ─── Operation 3: Revert user override ───────────────────────────────────
    if (body.action === 'revert') {
      if (!body.extraction_id) {
        return NextResponse.json(
          { error: 'extraction_id is required for revert action' },
          { status: 400 }
        );
      }

      // Verify extraction belongs to this solicitation
      const { data: existing, error: fetchError } = await supabase
        .from('compliance_extractions')
        .select('id, is_user_override, original_ai_value')
        .eq('id', body.extraction_id)
        .eq('solicitation_id', solicitationId)
        .maybeSingle();

      if (fetchError || !existing) {
        return NextResponse.json(
          { error: 'Extraction not found or does not belong to this solicitation' },
          { status: 404 }
        );
      }

      if (!existing.is_user_override) {
        return NextResponse.json(
          { error: 'No user override exists for this extraction — nothing to revert' },
          { status: 400 }
        );
      }

      // Restore original AI value
      const { data: reverted, error: revertError } = await supabase
        .from('compliance_extractions')
        .update({
          field_value:       existing.original_ai_value,
          is_user_override:  false,
          original_ai_value: null,
          updated_at:        new Date().toISOString(),
        })
        .eq('id', body.extraction_id)
        .eq('solicitation_id', solicitationId)
        .select()
        .single();

      if (revertError || !reverted) {
        console.error('Revert extraction error:', revertError);
        return NextResponse.json(
          { error: 'Failed to revert extraction to AI value' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        extraction: reverted,
        message:    'User override reverted — original AI-extracted value restored',
      });
    }

    // Unknown operation
    return NextResponse.json(
      { error: 'Invalid request body — provide extraction_id + field_value, or action: re-extract | revert' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Compliance PATCH error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
