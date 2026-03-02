import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';
import { inngest } from '@/lib/inngest/client';
import { requireStaffOrResponse } from '@/lib/auth';
import { PDFParse } from 'pdf-parse';

export async function POST(request: NextRequest) {
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
    // Enforce that the company's Tier 1 Enterprise Intake must be complete before
    // allowing any RFP document uploads. The tier1_complete flag is a pre-computed
    // boolean set by the profile PUT handler after every save — single-column check
    // avoids expensive completeness recalculation on every upload request.
    const supabaseForGate = getServerClient();
    const { data: gateData, error: gateError } = await supabaseForGate
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
            'Tier 1 Enterprise Intake must be completed before uploading RFP documents. Please complete your company profile at /company/profile.',
          code: 'TIER1_INCOMPLETE',
        },
        { status: 403 }
      );
    }
    // === END TIER 1 GATE CHECK ===

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Extract text from file
    let fileContent = '';
    
    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      let extracted = false;

      if (process.env.PDF_SERVICE_URL) {
        try {
          const pdfFormData = new FormData();
          pdfFormData.append('file', file);
          const response = await fetch(`${process.env.PDF_SERVICE_URL}/extract-text`, {
            method: 'POST',
            body: pdfFormData,
          });
          if (response.ok) {
            const result = await response.json();
            fileContent = result.text;
            extracted = true;
            console.log(`[pdf-extract] ${file.name}: ${result.pages} pages, ${result.character_count} chars`);
          }
        } catch (err) {
          console.warn(`[pdf-extract] Service error for ${file.name}, falling back to pdf-parse:`, err instanceof Error ? err.message : err);
        }
      }

      if (!extracted) {
        try {
          const buf = Buffer.from(await file.arrayBuffer());
          const parser = new PDFParse({ data: buf });
          const result = await parser.getText();
          fileContent = result.text;
          console.log(`[pdf-parse] ${file.name}: ${result.text.length} chars`);
        } catch (parseErr) {
          console.error(`[pdf-parse] Failed for ${file.name}:`, parseErr instanceof Error ? parseErr.message : parseErr);
          return NextResponse.json(
            { error: 'Failed to extract text from PDF' },
            { status: 422 }
          );
        }
      }
    } else {
      fileContent = await file.text();
    }

    // Create document record with company_id
    const supabase = getServerClient();
    const { data: document, error } = await supabase
      .from('documents')
      .insert({
        filename: file.name,
        file_path: `/uploads/${file.name}`, // Simplified - in production use proper storage
        status: 'pending',
        company_id: companyId,
      })
      .select()
      .single();

    if (error || !document) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to create document' }, { status: 500 });
    }

    // Trigger Inngest workflow
    await inngest.send({
      name: 'document.uploaded',
      data: {
        documentId: document.id,
        fileContent,
      },
    });

    return NextResponse.json({
      success: true,
      document: {
        id: document.id,
        filename: document.filename,
        status: document.status,
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 }
    );
  }
}
