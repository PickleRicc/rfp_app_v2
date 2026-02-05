import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';
import { readFile } from 'fs/promises';
import { requireStaffOrResponse } from '@/lib/auth';

/**
 * GET /api/proposals/[id]/volumes
 * Download a specific volume or list all volumes
 * Query param: ?type=technical|management|past_performance|price
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaffOrResponse();
  if (auth instanceof NextResponse) return auth;
  try {
    const { id: documentId } = await params;
    const { searchParams } = new URL(request.url);
    const volumeType = searchParams.get('type');
    
    const supabase = getServerClient();

    // Get response record
    const { data: response, error: responseError } = await supabase
      .from('rfp_responses')
      .select('id')
      .eq('document_id', documentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (responseError || !response) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    // If type specified, download that specific volume
    if (volumeType) {
      const { data: volume, error: volumeError } = await supabase
        .from('proposal_volumes')
        .select('*')
        .eq('response_id', response.id)
        .eq('volume_type', volumeType)
        .single();

      if (volumeError || !volume || !volume.docx_url) {
        return NextResponse.json({ error: 'Volume not found' }, { status: 404 });
      }

      try {
        const fileBuffer = await readFile(volume.docx_url);
        const filename = `${volume.volume_type}-volume.docx`;

        return new NextResponse(fileBuffer, {
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'Content-Disposition': `attachment; filename="${filename}"`,
          },
        });
      } catch (error) {
        console.error('Error reading volume file:', error);
        return NextResponse.json({ error: 'File not found' }, { status: 404 });
      }
    }

    // Otherwise, list all volumes
    const { data: volumes, error } = await supabase
      .from('proposal_volumes')
      .select('*')
      .eq('response_id', response.id)
      .order('volume_number');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(volumes || []);
  } catch (error: any) {
    console.error('Volumes API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
