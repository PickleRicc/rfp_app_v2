import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';
import { inngest } from '@/lib/inngest/client';
import { requireStaffOrResponse } from '@/lib/auth';

// PDF service URL - configurable via environment variable
const PDF_SERVICE_URL = process.env.PDF_SERVICE_URL || 'http://localhost:8000';

// Allowed MIME types and extensions for solicitation document uploads
const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.txt'];
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/plain',
];

function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  return lastDot !== -1 ? filename.slice(lastDot).toLowerCase() : '';
}

function isAllowedFile(file: File): boolean {
  const ext = getFileExtension(file.name);
  return ALLOWED_EXTENSIONS.includes(ext) || ALLOWED_MIME_TYPES.includes(file.type);
}

async function extractTextFromFile(file: File): Promise<string> {
  const ext = getFileExtension(file.name);

  if (ext === '.pdf' || file.type === 'application/pdf') {
    // Use Python microservice for PDF extraction
    try {
      const pdfFormData = new FormData();
      pdfFormData.append('file', file);

      const response = await fetch(`${PDF_SERVICE_URL}/extract-text`, {
        method: 'POST',
        body: pdfFormData,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: response.statusText }));
        throw new Error(`PDF service error: ${error.detail || response.statusText}`);
      }

      const result = await response.json();
      console.log(`Extracted ${result.pages} pages, ${result.character_count} characters from ${file.name}`);
      return result.text;
    } catch (pdfError) {
      console.error(`PDF extraction failed for ${file.name}:`, pdfError);
      // Fall back to raw text — AI can still work with partial content
      return await file.text();
    }
  }

  // DOCX, XLSX, TXT: read as text (basic extraction)
  // DOCX/XLSX give XML content which AI can work with
  return await file.text();
}

/**
 * POST /api/solicitations/[id]/upload
 *
 * Bulk file upload for solicitation packages. Accepts multiple files in a single
 * request, extracts text from each, creates solicitation_document records, and
 * triggers AI classification via Inngest.
 *
 * Auth: requireStaffOrResponse() + X-Company-Id header
 * Body: multipart/form-data with "files" field (multiple) and optional "solicitation_number_detected"
 *
 * Returns: { success, documents: [{id, filename, status}...], errors: [{filename, error}...] }
 * Per-file failures are reported in errors[] but processing continues for valid files.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireStaffOrResponse();
  if (auth instanceof NextResponse) return auth;

  try {
    const companyId = request.headers.get('X-Company-Id');

    if (!companyId) {
      return NextResponse.json(
        { error: 'No company selected. Please select a company before uploading.' },
        { status: 400 }
      );
    }

    // === TIER 1 GATE CHECK ===
    const supabase = getServerClient();
    const { data: gateData, error: gateError } = await supabase
      .from('company_profiles')
      .select('tier1_complete')
      .eq('id', companyId)
      .single();

    if (gateError) {
      if (gateError.code === 'PGRST116') {
        return NextResponse.json(
          {
            error:
              'Company profile not found. Please create your company profile at /company/profile before uploading.',
            code: 'PROFILE_NOT_FOUND',
          },
          { status: 403 }
        );
      }
      console.error('Upload gate check error:', gateError);
      return NextResponse.json(
        { error: 'Failed to verify Tier 1 completion status' },
        { status: 500 }
      );
    }

    if (!gateData?.tier1_complete) {
      return NextResponse.json(
        {
          error:
            'Tier 1 Enterprise Intake must be completed before uploading solicitation documents. Please complete your company profile at /company/profile.',
          code: 'TIER1_INCOMPLETE',
        },
        { status: 403 }
      );
    }
    // === END TIER 1 GATE CHECK ===

    const { id: solicitationId } = params;

    // Verify the solicitation exists and belongs to the requesting company
    const { data: solicitation, error: solError } = await supabase
      .from('solicitations')
      .select('id, status')
      .eq('id', solicitationId)
      .eq('company_id', companyId)
      .single();

    if (solError || !solicitation) {
      return NextResponse.json(
        { error: 'Solicitation not found or access denied' },
        { status: 404 }
      );
    }

    // Parse the multipart form data
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    const documents: { id: string; filename: string; status: string }[] = [];
    const errors: { filename: string; error: string }[] = [];

    let sortOrder = 0;

    for (const file of files) {
      // Validate file type
      if (!isAllowedFile(file)) {
        errors.push({
          filename: file.name,
          error: `File type not allowed. Accepted types: ${ALLOWED_EXTENSIONS.join(', ')}`,
        });
        continue;
      }

      try {
        sortOrder++;

        // Create the document record immediately with extracting status
        const { data: docRecord, error: insertError } = await supabase
          .from('solicitation_documents')
          .insert({
            solicitation_id: solicitationId,
            filename: file.name,
            file_path: `/uploads/solicitations/${solicitationId}/${file.name}`,
            file_size: file.size,
            mime_type: file.type || 'application/octet-stream',
            processing_status: 'extracting',
            sort_order: sortOrder,
          })
          .select('id, filename, processing_status')
          .single();

        if (insertError || !docRecord) {
          console.error(`Failed to create document record for ${file.name}:`, insertError);
          errors.push({
            filename: file.name,
            error: 'Failed to create document record',
          });
          continue;
        }

        // Extract text content from file
        const extractedText = await extractTextFromFile(file);

        // Update the record with extracted text
        await supabase
          .from('solicitation_documents')
          .update({ extracted_text: extractedText })
          .eq('id', docRecord.id);

        // Trigger Inngest classification event
        await inngest.send({
          name: 'solicitation.document.uploaded',
          data: {
            solicitationId,
            documentId: docRecord.id,
            extractedText,
          },
        });

        documents.push({
          id: docRecord.id,
          filename: docRecord.filename,
          status: docRecord.processing_status,
        });
      } catch (fileError) {
        console.error(`Error processing file ${file.name}:`, fileError);
        errors.push({
          filename: file.name,
          error: fileError instanceof Error ? fileError.message : 'Processing failed',
        });
      }
    }

    // Update solicitation document_count and move to classifying status
    if (documents.length > 0) {
      await supabase
        .from('solicitations')
        .update({
          document_count: documents.length,
          status: 'classifying',
          updated_at: new Date().toISOString(),
        })
        .eq('id', solicitationId);
    }

    return NextResponse.json({
      success: true,
      documents,
      errors,
    });
  } catch (error) {
    console.error('Solicitation upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
