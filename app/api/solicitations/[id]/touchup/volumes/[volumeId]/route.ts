/**
 * GET /api/solicitations/[id]/touchup/volumes/[volumeId]
 * Downloads the touchup DOCX file for a specific touchup volume.
 *
 * Query params:
 *   ?version=N  — Download a specific historical version's DOCX
 *                 (from touchup_volume_versions). Omit for latest.
 *
 * Validates company ownership via touchup_volumes -> touchup_analyses join,
 * verifies the volume is completed with a file_path, and serves the DOCX.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';
import { requireStaffOrResponse } from '@/lib/auth';

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
      return NextResponse.json({ error: 'X-Company-Id header is required' }, { status: 400 });
    }

    const supabase = getServerClient();

    const { data: volume, error: volumeError } = await supabase
      .from('touchup_volumes')
      .select(`
        id, volume_name, status, file_path, touchup_id,
        touchup_analyses!inner ( id, solicitation_id, company_id )
      `)
      .eq('id', volumeId)
      .maybeSingle();

    if (volumeError) {
      console.error('Fetch touchup_volumes error:', volumeError);
      return NextResponse.json({ error: 'Failed to fetch volume record' }, { status: 500 });
    }

    if (!volume) {
      return NextResponse.json({ error: 'Volume not found' }, { status: 404 });
    }

    const parent = volume.touchup_analyses as unknown as {
      id: string; solicitation_id: string; company_id: string;
    };

    if (parent.company_id !== companyId || parent.solicitation_id !== solicitationId) {
      return NextResponse.json({ error: 'Volume not found' }, { status: 404 });
    }

    // Check for historical version download
    const versionParam = request.nextUrl.searchParams.get('version');
    let filePath: string | null = null;
    let filenameLabel = 'Touchup';

    if (versionParam) {
      const versionNum = parseInt(versionParam, 10);
      if (isNaN(versionNum) || versionNum < 1) {
        return NextResponse.json({ error: 'Invalid version number' }, { status: 400 });
      }

      const { data: versionRow } = await supabase
        .from('touchup_volume_versions')
        .select('file_path, version_number')
        .eq('touchup_volume_id', volumeId)
        .eq('version_number', versionNum)
        .maybeSingle();

      if (!versionRow?.file_path) {
        return NextResponse.json({ error: `No DOCX available for version ${versionNum}` }, { status: 404 });
      }

      filePath = versionRow.file_path;
      filenameLabel = `Touchup_v${versionNum}`;
    } else {
      if (volume.status !== 'completed' || !volume.file_path) {
        return NextResponse.json({ error: 'Volume not ready for download' }, { status: 404 });
      }
      filePath = volume.file_path;
    }

    const { data: fileData, error: storageError } = await supabase.storage
      .from('proposal-drafts')
      .download(filePath!);

    if (storageError || !fileData) {
      console.error('Storage download error:', storageError);
      return NextResponse.json({ error: 'Failed to download volume file' }, { status: 500 });
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const safeFilename = (volume.volume_name as string)
      .replace(/[^a-zA-Z0-9 _\-]/g, '')
      .trim()
      .replace(/\s+/g, '_');

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filenameLabel}_${safeFilename}.docx"`,
        'Content-Length': String(arrayBuffer.byteLength),
      },
    });
  } catch (error) {
    console.error('Touchup volume download error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
