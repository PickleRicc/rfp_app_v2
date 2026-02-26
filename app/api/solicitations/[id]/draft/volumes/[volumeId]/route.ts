/**
 * GET /api/solicitations/[id]/draft/volumes/[volumeId]
 * Serves the generated DOCX file for a specific draft volume.
 *
 * Validates company ownership via the draft_volumes → proposal_drafts join,
 * verifies the volume is completed with a file_path, downloads the DOCX
 * from Supabase storage, and returns it as a binary response.
 *
 * Requires:
 * - requireStaffOrResponse() auth
 * - X-Company-Id header
 * - Solicitation must belong to the requesting company (verified via draft join)
 *
 * Returns:
 * - 200 with binary DOCX content when volume is completed
 * - 404 when volume not found, not completed, or file_path is null
 * - 500 on storage download failure
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';
import { requireStaffOrResponse } from '@/lib/auth';

// ===== GET =====

/**
 * GET /api/solicitations/[id]/draft/volumes/[volumeId]
 *
 * Downloads the DOCX file for a completed draft volume.
 * The volume must belong to a draft owned by the requesting company.
 *
 * Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document
 * Content-Disposition: attachment; filename="{volume_name}.docx"
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; volumeId: string }> }
) {
  const auth = await requireStaffOrResponse();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id: solicitationId, volumeId } = await params;
    const companyId = request.headers.get('X-Company-Id');

    if (!companyId) {
      return NextResponse.json(
        { error: 'X-Company-Id header is required' },
        { status: 400 }
      );
    }

    const supabase = getServerClient();

    // Fetch the draft volume — join to proposal_drafts to verify company ownership
    // This prevents a user from downloading volumes belonging to another company's draft
    const { data: volume, error: volumeError } = await supabase
      .from('draft_volumes')
      .select(
        `
        id,
        volume_name,
        status,
        file_path,
        draft_id,
        proposal_drafts!inner (
          id,
          solicitation_id,
          company_id
        )
      `
      )
      .eq('id', volumeId)
      .maybeSingle();

    if (volumeError) {
      console.error('Fetch draft_volumes error:', volumeError);
      return NextResponse.json(
        { error: 'Failed to fetch volume record' },
        { status: 500 }
      );
    }

    if (!volume) {
      return NextResponse.json(
        { error: 'Volume not found' },
        { status: 404 }
      );
    }

    // Type assertion for joined data shape
    const draftParent = volume.proposal_drafts as unknown as {
      id: string;
      solicitation_id: string;
      company_id: string;
    };

    // Verify the draft belongs to the requesting company and solicitation
    if (
      draftParent.company_id !== companyId ||
      draftParent.solicitation_id !== solicitationId
    ) {
      return NextResponse.json(
        { error: 'Volume not found' },
        { status: 404 }
      );
    }

    // Only serve completed volumes with a file_path
    if (volume.status !== 'completed' || !volume.file_path) {
      return NextResponse.json(
        { error: 'Volume not ready for download' },
        { status: 404 }
      );
    }

    // Download DOCX from Supabase storage
    const { data: fileData, error: storageError } = await supabase.storage
      .from('proposal-drafts')
      .download(volume.file_path);

    if (storageError || !fileData) {
      console.error('Storage download error:', storageError);
      return NextResponse.json(
        { error: 'Failed to download volume file' },
        { status: 500 }
      );
    }

    // Convert Blob to ArrayBuffer for response
    const arrayBuffer = await fileData.arrayBuffer();

    // Sanitize volume_name for use as filename (remove characters invalid in filenames)
    const safeFilename = (volume.volume_name as string)
      .replace(/[^a-zA-Z0-9 _\-]/g, '')
      .trim()
      .replace(/\s+/g, '_');

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${safeFilename}.docx"`,
        'Content-Length': String(arrayBuffer.byteLength),
      },
    });
  } catch (error) {
    console.error('Volume download GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
