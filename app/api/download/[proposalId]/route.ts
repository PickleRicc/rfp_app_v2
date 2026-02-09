/**
 * Package Download API Endpoint
 *
 * GET /api/download/[proposalId]
 * Returns ZIP package for proposal using pre-generated PDFs from storage.
 */

import { NextRequest, NextResponse } from 'next/server';
import { buildPackage, PackageManifest, VolumeFile } from '@/lib/generation/pipeline';
import { getServerClient } from '@/lib/supabase/client';

export const maxDuration = 300; // 5 minutes for large packages (Vercel config)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ proposalId: string }> }
) {
  try {
    const { proposalId } = await params;

    if (!proposalId) {
      return NextResponse.json(
        { error: 'Proposal ID is required' },
        { status: 400 }
      );
    }

    // Get proposal data from database
    const supabase = getServerClient();
    const { data: proposal, error: fetchError } = await supabase
      .from('proposals')
      .select('*')
      .eq('id', proposalId)
      .single();

    if (fetchError || !proposal) {
      return NextResponse.json(
        { error: 'Proposal not found' },
        { status: 404 }
      );
    }

    // Build manifest from proposal data
    // NOTE: PDFs are pre-generated and stored in proposal.volumes[X].pdf
    const manifest: PackageManifest = {
      solicitationNumber: proposal.solicitation_number || 'UNKNOWN',
      volumes: [],
      graphics: []
    };

    // Add volumes from proposal (includes pre-generated PDFs)
    if (proposal.volumes) {
      for (const [name, content] of Object.entries(proposal.volumes)) {
        if (content && typeof content === 'object') {
          const volumeData = content as {
            docx?: string;      // Base64 encoded DOCX
            pdf?: string;       // Base64 encoded PDF (pre-generated)
            pdfError?: string;  // Error if PDF generation failed
          };

          // Skip if no DOCX data
          if (!volumeData.docx) continue;

          const volumeFile: VolumeFile = {
            name,
            docxBuffer: Buffer.from(volumeData.docx, 'base64'),
            pdfBuffer: volumeData.pdf
              ? Buffer.from(volumeData.pdf, 'base64')
              : undefined,
            pdfError: volumeData.pdfError,
            type: name.includes('Appendix') ? 'appendix' : 'volume'
          };

          manifest.volumes.push(volumeFile);
        }
      }
    }

    // Add graphics if stored
    if (proposal.graphics) {
      for (const [name, content] of Object.entries(proposal.graphics)) {
        if (content && typeof content === 'object' && 'buffer' in content) {
          manifest.graphics.push({
            name,
            buffer: Buffer.from((content as { buffer: string }).buffer, 'base64')
          });
        }
      }
    }

    // Build package (assembles pre-generated content, no PDF conversion here)
    const result = await buildPackage(manifest);

    if (!result.success || !result.zipBuffer) {
      return NextResponse.json(
        { error: result.error || 'Failed to build package' },
        { status: 500 }
      );
    }

    // Log any PDF generation errors (from proposal generation)
    if (result.pdfErrors && result.pdfErrors.length > 0) {
      console.warn('Some PDFs were not generated during proposal creation:', result.pdfErrors);
    }

    // Return ZIP file
    const filename = `${result.manifest.rootFolder}.zip`;

    // Convert Buffer to Uint8Array for NextResponse compatibility
    const uint8Array = new Uint8Array(result.zipBuffer);

    return new NextResponse(uint8Array, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': result.zipBuffer.length.toString()
      }
    });
  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json(
      { error: 'Failed to generate package' },
      { status: 500 }
    );
  }
}
