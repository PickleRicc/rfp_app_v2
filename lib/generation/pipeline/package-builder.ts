/**
 * Package Builder (Framework Part 9.1)
 *
 * Assembles proposal packages per Framework Part 9.1 PACKAGE_STRUCTURE.
 * Uses pre-generated PDFs from stage2-response-generator - NO on-demand conversion.
 */

import archiver from 'archiver';
import { generateChecklist } from './checklist-generator';
import { withTempDirectory } from './temp-files';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export interface VolumeFile {
  name: string;           // e.g., 'Volume_I_Technical.docx'
  docxBuffer: Buffer;     // DOCX content
  pdfBuffer?: Buffer;     // Pre-generated PDF (from stage2-response-generator)
  pdfError?: string;      // Error message if PDF generation failed
  type: 'volume' | 'appendix' | 'matrix';
}

export interface GraphicFile {
  name: string;           // e.g., 'OrgChart.png'
  buffer: Buffer;
}

export interface PackageManifest {
  solicitationNumber: string;
  volumes: VolumeFile[];
  graphics: GraphicFile[];
  // NOTE: generatePdfs removed - PDFs are pre-generated during proposal generation
}

export interface PackageBuildResult {
  success: boolean;
  zipBuffer?: Buffer;
  error?: string;
  manifest: {
    rootFolder: string;
    volumes: string[];
    appendices: string[];
    graphics: string[];
    finalSubmission: string[];
  };
  pdfErrors?: string[];  // List of volumes where PDF generation failed
}

/**
 * Build proposal package per Framework Part 9.1 PACKAGE_STRUCTURE:
 *
 * /Proposal_[Solicitation#]/
 *   ├── Volume_I_Technical.docx
 *   ├── Volume_II_Management.docx
 *   ├── Volume_III_PastPerformance.docx
 *   ├── Volume_IV_Price.xlsx
 *   ├── Appendix_A_Resumes.docx
 *   ├── Appendix_B_Compliance_Matrix.xlsx
 *   ├── Graphics/
 *   │   ├── OrgChart.png
 *   │   ├── TransitionTimeline.png
 *   │   └── ProcessDiagram.png
 *   └── Final_Submission/
 *       ├── [Pre-generated PDF versions]
 *       └── Submission_Checklist.xlsx
 *
 * NOTE: PDFs are pre-generated during proposal generation (stage2-response-generator).
 * This function assembles them into the package structure - no on-demand conversion.
 */
export async function buildPackage(
  manifest: PackageManifest
): Promise<PackageBuildResult> {
  const rootFolder = `Proposal_${sanitizeFilename(manifest.solicitationNumber)}`;
  const resultManifest = {
    rootFolder,
    volumes: [] as string[],
    appendices: [] as string[],
    graphics: [] as string[],
    finalSubmission: [] as string[]
  };
  const pdfErrors: string[] = [];

  try {
    return await withTempDirectory(async (tempDir) => {
      // Create directory structure
      const graphicsDir = path.join(tempDir, rootFolder, 'Graphics');
      const finalDir = path.join(tempDir, rootFolder, 'Final_Submission');
      await mkdir(graphicsDir, { recursive: true });
      await mkdir(finalDir, { recursive: true });

      // Write volume files to root
      for (const volume of manifest.volumes) {
        // Write DOCX to root folder
        const volumePath = path.join(tempDir, rootFolder, volume.name);
        await writeFile(volumePath, volume.docxBuffer);

        if (volume.type === 'volume') {
          resultManifest.volumes.push(volume.name);
        } else if (volume.type === 'appendix') {
          resultManifest.appendices.push(volume.name);
        }

        // Write pre-generated PDF to Final_Submission (if available)
        if (volume.pdfBuffer) {
          const pdfName = volume.name.replace(/\.docx$/i, '.pdf');
          const pdfPath = path.join(finalDir, pdfName);
          await writeFile(pdfPath, volume.pdfBuffer);
          resultManifest.finalSubmission.push(pdfName);
        } else if (volume.pdfError) {
          // Track PDF generation errors (from stage2-response-generator)
          pdfErrors.push(`${volume.name}: ${volume.pdfError}`);
        }
      }

      // Write graphics to Graphics/
      for (const graphic of manifest.graphics) {
        const graphicPath = path.join(graphicsDir, graphic.name);
        await writeFile(graphicPath, graphic.buffer);
        resultManifest.graphics.push(graphic.name);
      }

      // Generate checklist in Final_Submission/
      const checklistResult = await generateChecklist();
      if (checklistResult.success && checklistResult.buffer) {
        const checklistPath = path.join(finalDir, 'Submission_Checklist.xlsx');
        await writeFile(checklistPath, checklistResult.buffer);
        resultManifest.finalSubmission.push('Submission_Checklist.xlsx');
      }

      // Create ZIP archive
      const zipBuffer = await createZipArchive(tempDir, rootFolder);

      return {
        success: true,
        zipBuffer,
        manifest: resultManifest,
        pdfErrors: pdfErrors.length > 0 ? pdfErrors : undefined
      };
    });
  } catch (error) {
    return {
      success: false,
      error: `Package build failed: ${error instanceof Error ? error.message : String(error)}`,
      manifest: resultManifest,
      pdfErrors: pdfErrors.length > 0 ? pdfErrors : undefined
    };
  }
}

/**
 * Create ZIP archive from directory
 * Per research: handle both 'warning' and 'error' events explicitly
 */
async function createZipArchive(
  baseDir: string,
  folderName: string
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    });

    // Critical: handle both warning and error events (research pitfall #2)
    archive.on('warning', (err) => {
      if (err.code === 'ENOENT') {
        console.warn('Archive warning (file not found):', err.message);
      } else {
        reject(err);
      }
    });

    archive.on('error', (err) => {
      reject(err);
    });

    // Collect chunks
    archive.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    archive.on('end', () => {
      const buffer = Buffer.concat(chunks);
      // Verify non-empty archive (research pitfall #2)
      if (buffer.length === 0) {
        reject(new Error('Archive is empty'));
      } else {
        resolve(buffer);
      }
    });

    // Add directory contents
    archive.directory(path.join(baseDir, folderName), folderName);

    archive.finalize();
  });
}

/**
 * Sanitize filename for file system and ZIP
 */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '_') // Invalid chars
    .replace(/\s+/g, '_')          // Spaces to underscores
    .substring(0, 100);             // Limit length
}
