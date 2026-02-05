import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';
import { readFile } from 'fs/promises';
import archiver from 'archiver';
import { Readable } from 'stream';
import { requireStaffOrResponse } from '@/lib/auth';

/**
 * GET /api/proposals/[id]/download
 * Download all proposal volumes and compliance matrix as a ZIP file
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffOrResponse();
  if (auth instanceof NextResponse) return auth;
  try {
    const { id: documentId } = await params;
    const supabase = getServerClient();

    // Get response record
    const { data: response, error: responseError } = await supabase
      .from('rfp_responses')
      .select('id, compliance_matrix_url')
      .eq('document_id', documentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (responseError || !response) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    // Get all volumes
    const { data: volumes, error: volumesError } = await supabase
      .from('proposal_volumes')
      .select('*')
      .eq('response_id', response.id)
      .order('volume_number');

    if (volumesError) {
      return NextResponse.json({ error: volumesError.message }, { status: 500 });
    }

    if (responseError) {
      return NextResponse.json({ error: responseError.message }, { status: 500 });
    }

    // Create ZIP archive
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    // Add volumes to ZIP
    for (const volume of volumes || []) {
      if (volume.docx_url) {
        try {
          const fileBuffer = await readFile(volume.docx_url);
          const filename = `${volume.volume_type}-volume.docx`;
          archive.append(fileBuffer, { name: filename });
        } catch (error) {
          console.error(`Error adding volume ${volume.volume_type}:`, error);
        }
      }
    }

    // Add compliance matrix
    if (response?.compliance_matrix_url) {
      try {
        const matrixBuffer = await readFile(response.compliance_matrix_url);
        archive.append(matrixBuffer, { name: 'compliance-matrix.xlsx' });
      } catch (error) {
        console.error('Error adding compliance matrix:', error);
      }
    }

    // Finalize archive
    archive.finalize();

    // Convert archive stream to buffer
    const chunks: Buffer[] = [];
    for await (const chunk of archive) {
      chunks.push(Buffer.from(chunk));
    }
    const zipBuffer = Buffer.concat(chunks);

    // Return ZIP file
    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="proposal-${documentId}.zip"`,
      },
    });
  } catch (error: any) {
    console.error('Error creating ZIP:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
