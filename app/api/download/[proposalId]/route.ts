/**
 * Package Download API Endpoint
 *
 * GET /api/download/[proposalId]
 * Returns ZIP package following Framework Part 9.1 structure
 * using pre-generated DOCX/PDF files from proposal_volumes.
 *
 * proposalId = rfp_responses.id
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase/client';
import { readFile } from 'fs/promises';
import archiver from 'archiver';

export const maxDuration = 300; // 5 minutes for large packages

// Volume display names for Framework Part 9.1 structure
const VOLUME_NAMES: Record<string, string> = {
  technical: 'Volume_I_Technical',
  management: 'Volume_II_Management',
  past_performance: 'Volume_III_PastPerformance',
  price: 'Volume_IV_Price',
};

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

    const supabase = getServerClient();

    // Get response record (proposalId is rfp_responses.id)
    const { data: response, error: responseError } = await supabase
      .from('rfp_responses')
      .select('id, document_id, compliance_matrix_url')
      .eq('id', proposalId)
      .single();

    if (responseError || !response) {
      return NextResponse.json(
        { error: 'Proposal not found' },
        { status: 404 }
      );
    }

    // Get document info for solicitation number
    const { data: document } = await supabase
      .from('documents')
      .select('filename, metadata')
      .eq('id', response.document_id)
      .single();

    const solicitationNumber = document?.metadata?.solicitation_number || 'Proposal';

    // Get all volumes
    const { data: volumes, error: volumesError } = await supabase
      .from('proposal_volumes')
      .select('*')
      .eq('response_id', response.id)
      .order('volume_number');

    if (volumesError) {
      return NextResponse.json(
        { error: volumesError.message },
        { status: 500 }
      );
    }

    if (!volumes || volumes.length === 0) {
      return NextResponse.json(
        { error: 'No volumes found for this proposal' },
        { status: 404 }
      );
    }

    // Build ZIP with Framework Part 9.1 structure
    const rootFolder = `Proposal_${solicitationNumber.replace(/[^a-zA-Z0-9-_]/g, '_')}`;
    const archive = archiver('zip', { zlib: { level: 9 } });

    // Handle archiver errors
    archive.on('warning', (err) => {
      console.warn('Archiver warning:', err);
    });
    archive.on('error', (err) => {
      throw err;
    });

    // Add DOCX volumes to root
    for (const volume of volumes) {
      if (volume.docx_url) {
        try {
          const fileBuffer = await readFile(volume.docx_url);
          const volumeName = VOLUME_NAMES[volume.volume_type] || volume.volume_type;
          archive.append(fileBuffer, { name: `${rootFolder}/${volumeName}.docx` });
        } catch (error) {
          console.error(`Error adding DOCX for ${volume.volume_type}:`, error);
        }
      }

      // Add PDFs to Final_Submission/
      if (volume.pdf_url) {
        try {
          const pdfBuffer = await readFile(volume.pdf_url);
          const volumeName = VOLUME_NAMES[volume.volume_type] || volume.volume_type;
          archive.append(pdfBuffer, { name: `${rootFolder}/Final_Submission/${volumeName}.pdf` });
        } catch (error) {
          console.error(`Error adding PDF for ${volume.volume_type}:`, error);
        }
      }
    }

    // Add compliance matrix as appendix
    if (response.compliance_matrix_url) {
      try {
        const matrixBuffer = await readFile(response.compliance_matrix_url);
        archive.append(matrixBuffer, {
          name: `${rootFolder}/Appendix_B_Compliance_Matrix.xlsx`
        });
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
    const filename = `${rootFolder}.zip`;
    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': zipBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json(
      { error: 'Failed to generate package' },
      { status: 500 }
    );
  }
}
