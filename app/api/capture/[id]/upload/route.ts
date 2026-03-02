import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';
import { requireStaffOrResponse } from '@/lib/auth';
import type { OpportunityDocumentType } from '@/lib/supabase/capture-types';

const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
];

const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.doc', '.txt'];
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

/**
 * POST /api/capture/[id]/upload
 * Upload documents for an opportunity analysis.
 * FormData: files[], document_type (rfp | past_performance | etc.)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffOrResponse();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id: analysisId } = await params;
    const supabase = getServerClient();

    const { data: analysis } = await supabase
      .from('opportunity_analyses')
      .select('id, mode, company_id')
      .eq('id', analysisId)
      .eq('created_by', auth.userId!)
      .single();

    if (!analysis) {
      return NextResponse.json(
        { error: 'Analysis not found' },
        { status: 404 }
      );
    }

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const documentType = (formData.get('document_type') as string) || 'other';

    if (!files.length) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    const uploaded: Array<{ id: string; filename: string }> = [];
    const errors: string[] = [];

    for (const file of files) {
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();

      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        errors.push(`${file.name}: unsupported file type`);
        continue;
      }

      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: exceeds 20MB limit`);
        continue;
      }

      const storagePath = `${analysisId}/${documentType}/${file.name}`;

      const { error: storageError } = await supabase.storage
        .from('capture-documents')
        .upload(storagePath, file, {
          contentType: file.type,
          upsert: true,
        });

      if (storageError) {
        console.error(`Storage upload error for ${file.name}:`, storageError);
        errors.push(`${file.name}: upload failed`);
        continue;
      }

      let extractedText: string | null = null;

      if (ext === '.pdf' && process.env.PDF_SERVICE_URL) {
        try {
          const pdfFormData = new FormData();
          pdfFormData.append('file', file);
          const pdfRes = await fetch(
            `${process.env.PDF_SERVICE_URL}/extract-text`,
            { method: 'POST', body: pdfFormData }
          );
          if (pdfRes.ok) {
            const pdfData = await pdfRes.json();
            extractedText = pdfData.text || null;
          }
        } catch (pdfErr) {
          console.error(`PDF extraction error for ${file.name}:`, pdfErr);
        }
      } else if (ext === '.txt') {
        extractedText = await file.text();
      }

      const { data: doc, error: insertError } = await supabase
        .from('opportunity_documents')
        .insert({
          analysis_id: analysisId,
          filename: file.name,
          file_path: storagePath,
          file_size: file.size,
          document_type: documentType as OpportunityDocumentType,
          extracted_text: extractedText,
          processing_status: extractedText ? 'ready' : 'pending',
        })
        .select('id, filename')
        .single();

      if (insertError) {
        console.error(`Insert error for ${file.name}:`, insertError);
        errors.push(`${file.name}: failed to save record`);
        continue;
      }

      uploaded.push({ id: doc.id, filename: doc.filename });
    }

    if (uploaded.length > 0) {
      await supabase
        .from('opportunity_analyses')
        .update({ status: 'uploading', updated_at: new Date().toISOString() })
        .eq('id', analysisId);
    }

    return NextResponse.json({
      uploaded,
      errors,
      total: files.length,
      success_count: uploaded.length,
    });
  } catch (error) {
    console.error('Capture upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
