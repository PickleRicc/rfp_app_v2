/**
 * POST /api/solicitations/[id]/data-call/upload
 * Uploads a file for a specific data call response field and creates a data_call_files record.
 * Accepts multipart/form-data with: file (File), section (string), field_key (string).
 * Response shape: { file: DataCallFile }
 *
 * DELETE /api/solicitations/[id]/data-call/upload
 * Removes a file from Supabase storage and deletes the data_call_files record.
 * Body: { file_id: string }
 * Response shape: { success: true }
 *
 * Both endpoints require:
 * - requireStaffOrResponse() auth
 * - X-Company-Id header
 * - Solicitation must belong to the requesting company
 * - The data_call_response must belong to the same company
 *
 * File constraints (per phase decision — sensible defaults for gov proposal context):
 * - Max size: 10MB
 * - Allowed types: PDF, DOCX, DOC, PNG, JPG, JPEG
 * - Storage bucket: 'data-call-files'
 * - Storage path: {company_id}/{solicitation_id}/{section}/{field_key}/{filename}
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';
import { requireStaffOrResponse } from '@/lib/auth';
import type { DataCallFile, DataCallFileSection } from '@/lib/supabase/tier2-types';

// ===== CONSTANTS =====

/** Maximum allowed file size: 10MB */
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

/** Allowed MIME types for data call file uploads */
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword',                                                        // .doc
  'image/png',
  'image/jpeg',
]);

/** Valid section values matching the data_call_files CHECK constraint */
const VALID_SECTIONS: DataCallFileSection[] = [
  'past_performance',
  'key_personnel',
  'compliance_verification',
];

// ===== POST =====

/**
 * POST /api/solicitations/[id]/data-call/upload
 *
 * Uploads a file and creates a data_call_files record linking it to the
 * correct data call response, section, and field_key.
 *
 * Ensures the data_call_response exists for this company — creates it if not
 * (an upsert with minimal data), so file uploads work even before the user
 * has saved their first form response.
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

    // Parse multipart/form-data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const section = formData.get('section') as string | null;
    const fieldKey = formData.get('field_key') as string | null;

    // Validate required fields
    if (!file) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 });
    }
    if (!section) {
      return NextResponse.json({ error: 'section is required' }, { status: 400 });
    }
    if (!fieldKey) {
      return NextResponse.json({ error: 'field_key is required' }, { status: 400 });
    }

    // Validate section value
    if (!VALID_SECTIONS.includes(section as DataCallFileSection)) {
      return NextResponse.json(
        { error: `Invalid section. Must be one of: ${VALID_SECTIONS.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: `File too large. Maximum size is 10MB (received ${(file.size / 1024 / 1024).toFixed(1)}MB)` },
        { status: 400 }
      );
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed types: PDF, DOCX, DOC, PNG, JPG, JPEG' },
        { status: 400 }
      );
    }

    // Ensure a data_call_responses record exists for this company + solicitation
    // (file upload may happen before the user saves any form data)
    const { data: existingResponse, error: responseError } = await supabase
      .from('data_call_responses')
      .select('id')
      .eq('solicitation_id', solicitationId)
      .eq('company_id', companyId)
      .maybeSingle();

    if (responseError) {
      console.error('Fetch data call response for upload error:', responseError);
      return NextResponse.json(
        { error: 'Failed to verify data call response' },
        { status: 500 }
      );
    }

    let dataCallResponseId: string;

    if (existingResponse?.id) {
      dataCallResponseId = existingResponse.id;
    } else {
      // Auto-create the data call response record so file uploads work
      // before the user has explicitly saved the form
      const { data: newResponse, error: createError } = await supabase
        .from('data_call_responses')
        .insert({
          solicitation_id: solicitationId,
          company_id:      companyId,
          status:          'in_progress',
        })
        .select('id')
        .single();

      if (createError || !newResponse) {
        console.error('Create data call response for upload error:', createError);
        return NextResponse.json(
          { error: 'Failed to initialize data call response' },
          { status: 500 }
        );
      }

      dataCallResponseId = newResponse.id;
    }

    // Sanitize filename — remove path traversal characters
    const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');

    // Storage path: {company_id}/{solicitation_id}/{section}/{field_key}/{filename}
    const storagePath = `${companyId}/${solicitationId}/${section}/${fieldKey}/${sanitizedFilename}`;

    // Upload to Supabase storage
    const fileBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from('data-call-files')
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert:      true, // Allow replacing if same path exists (re-upload scenario)
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload file to storage' },
        { status: 500 }
      );
    }

    // Extract text from PDFs via Python PDF service
    let extractedText: string | null = null;
    if (file.type === 'application/pdf') {
      try {
        const pdfServiceUrl = process.env.PDF_SERVICE_URL || 'http://localhost:8000';
        const pdfFormData = new FormData();
        pdfFormData.append('file', new Blob([fileBuffer], { type: file.type }), sanitizedFilename);

        const pdfResponse = await fetch(`${pdfServiceUrl}/extract-text`, {
          method: 'POST',
          body: pdfFormData,
        });

        if (pdfResponse.ok) {
          const pdfResult = await pdfResponse.json() as { text?: string };
          extractedText = pdfResult.text || null;
        } else {
          console.warn(`PDF extraction failed for ${sanitizedFilename}: ${pdfResponse.status}`);
        }
      } catch (pdfErr) {
        console.warn(`PDF extraction service unavailable for ${sanitizedFilename}:`, pdfErr);
      }
    }

    // Create the data_call_files database record
    const { data: fileRecord, error: insertError } = await supabase
      .from('data_call_files')
      .insert({
        data_call_response_id: dataCallResponseId,
        section:               section as DataCallFileSection,
        field_key:             fieldKey,
        filename:              sanitizedFilename,
        file_path:             storagePath,
        file_size:             file.size,
        mime_type:             file.type,
        extracted_text:        extractedText,
      })
      .select('*')
      .single();

    if (insertError || !fileRecord) {
      // Attempt to clean up the storage upload if DB insert fails
      await supabase.storage.from('data-call-files').remove([storagePath]);
      console.error('Insert data_call_files record error:', insertError);
      return NextResponse.json(
        { error: 'Failed to record file upload' },
        { status: 500 }
      );
    }

    return NextResponse.json({ file: fileRecord as DataCallFile }, { status: 201 });
  } catch (error) {
    console.error('Data call upload POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ===== DELETE =====

/**
 * DELETE /api/solicitations/[id]/data-call/upload
 *
 * Removes a file from both Supabase storage and the data_call_files table.
 * Verifies the file belongs to a data_call_response owned by the requesting company
 * before deleting.
 */
export async function DELETE(
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

    const body = await request.json() as { file_id?: string };

    if (!body.file_id) {
      return NextResponse.json(
        { error: 'file_id is required' },
        { status: 400 }
      );
    }

    // Fetch the file record and verify it belongs to this company's data call
    const { data: fileRecord, error: fetchError } = await supabase
      .from('data_call_files')
      .select(`
        id,
        file_path,
        data_call_response_id,
        data_call_responses!inner (
          company_id,
          solicitation_id
        )
      `)
      .eq('id', body.file_id)
      .maybeSingle();

    if (fetchError || !fileRecord) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // Verify ownership through the data_call_responses join
    const responseData = fileRecord.data_call_responses as unknown as {
      company_id: string;
      solicitation_id: string;
    };

    if (
      responseData.company_id !== companyId ||
      responseData.solicitation_id !== solicitationId
    ) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // Delete from Supabase storage first
    const { error: storageDeleteError } = await supabase.storage
      .from('data-call-files')
      .remove([fileRecord.file_path]);

    if (storageDeleteError) {
      // Log but don't fail — storage and DB can drift; prioritize DB cleanup
      console.error('Storage delete error (proceeding with DB delete):', storageDeleteError);
    }

    // Delete the database record
    const { error: dbDeleteError } = await supabase
      .from('data_call_files')
      .delete()
      .eq('id', body.file_id);

    if (dbDeleteError) {
      console.error('Delete data_call_files record error:', dbDeleteError);
      return NextResponse.json(
        { error: 'Failed to delete file record' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Data call upload DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
