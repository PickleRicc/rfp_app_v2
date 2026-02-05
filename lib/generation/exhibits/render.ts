import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

export interface RenderOptions {
  width?: number;
  backgroundColor?: string;
}

/**
 * Renders a Mermaid diagram to a PNG file
 *
 * @param mermaidCode - The Mermaid diagram code
 * @param outputFilename - Name for the output PNG file
 * @param options - Optional rendering settings (width, backgroundColor)
 * @returns Absolute path to the generated PNG file
 * @throws Error if rendering fails
 */
export async function renderMermaidToPng(
  mermaidCode: string,
  outputFilename: string,
  options?: RenderOptions
): Promise<string> {
  const width = options?.width || 800;
  const backgroundColor = options?.backgroundColor || 'white';

  // Generate unique temp filename using timestamp to avoid collisions
  const tempFilename = `mermaid-${Date.now()}-${Math.random().toString(36).substring(7)}.mmd`;
  const tempInputPath = path.join(os.tmpdir(), tempFilename);

  // Ensure output filename has .png extension
  const outputFile = outputFilename.endsWith('.png') ? outputFilename : `${outputFilename}.png`;
  const outputPath = path.resolve(outputFile);

  try {
    // Write Mermaid code to temp file
    await fs.writeFile(tempInputPath, mermaidCode, 'utf-8');

    // Build mermaid-cli command
    // Using npx mmdc with proper flags:
    // -i: input file
    // -o: output file
    // -b: background color
    // -w: width
    // Using 150 DPI for screen-optimized resolution (per CONTEXT.md decisions)
    const command = `npx mmdc -i "${tempInputPath}" -o "${outputPath}" -b ${backgroundColor} -w ${width}`;

    // Execute rendering
    const { stdout, stderr } = await execAsync(command, {
      cwd: process.cwd(),
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large diagrams
    });

    // Check if output file was created
    try {
      await fs.access(outputPath);
    } catch (error) {
      throw new Error(`Rendering failed: Output file not created. stderr: ${stderr}`);
    }

    return outputPath;
  } catch (error) {
    // Provide descriptive error message
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to render Mermaid diagram: ${errorMessage}`);
  } finally {
    // Clean up temp input file
    await cleanupTempFile(tempInputPath);
  }
}

/**
 * Safely removes a temporary file
 *
 * @param filePath - Path to the file to remove
 */
export async function cleanupTempFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    // Ignore errors if file doesn't exist or can't be deleted
    // (e.g., already cleaned up, permissions issues)
    console.warn(`Could not clean up temp file ${filePath}:`, error);
  }
}
