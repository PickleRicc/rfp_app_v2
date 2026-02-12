import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

// Paths to configuration files (relative to project root)
// Use process.cwd() for Next.js compatibility since __filename may not work with bundling
function getConfigPaths() {
  const projectRoot = process.cwd();
  return {
    mermaid: path.join(projectRoot, 'lib', 'generation', 'exhibits', 'mermaid.config.json'),
    puppeteer: path.join(projectRoot, 'lib', 'generation', 'exhibits', 'puppeteer.config.json'),
  };
}

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

  console.log(`🎨 Rendering Mermaid diagram: ${outputFilename}`);
  console.log(`   Input path: ${tempInputPath}`);
  console.log(`   Output path: ${outputPath}`);
  console.log(`   Mermaid code length: ${mermaidCode.length} chars`);

  try {
    // Write Mermaid code to temp file
    await fs.writeFile(tempInputPath, mermaidCode, 'utf-8');
    console.log(`   ✓ Wrote mermaid code to temp file`);

    // Check if config files exist
    const configPaths = getConfigPaths();
    let configArgs = '';
    try {
      await fs.access(configPaths.mermaid);
      configArgs += ` -c "${configPaths.mermaid}"`;
      console.log(`   ✓ Using mermaid config: ${configPaths.mermaid}`);
    } catch {
      console.log(`   ⚠ No mermaid config file found at ${configPaths.mermaid}`);
    }

    try {
      await fs.access(configPaths.puppeteer);
      configArgs += ` -p "${configPaths.puppeteer}"`;
      console.log(`   ✓ Using puppeteer config: ${configPaths.puppeteer}`);
    } catch {
      console.log(`   ⚠ No puppeteer config file found at ${configPaths.puppeteer}`);
    }

    // Build mermaid-cli command
    // Using npx mmdc with proper flags:
    // -i: input file
    // -o: output file
    // -b: background color
    // -w: width
    // -c: mermaid config file (for theme and styling)
    // -p: puppeteer config file (for browser settings)
    // -s: scale (for higher resolution)
    const command = `npx mmdc -i "${tempInputPath}" -o "${outputPath}" -b ${backgroundColor} -w ${width} -s 2${configArgs}`;
    
    console.log(`   Running command: ${command}`);

    // Execute rendering
    const { stdout, stderr } = await execAsync(command, {
      cwd: process.cwd(),
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large diagrams
      timeout: 60000, // 60 second timeout
    });

    if (stdout) console.log(`   stdout: ${stdout}`);
    if (stderr) console.log(`   stderr: ${stderr}`);

    // Check if output file was created
    try {
      await fs.access(outputPath);
      const stats = await fs.stat(outputPath);
      console.log(`   ✓ Output file created: ${stats.size} bytes`);
      
      // Warn if file is suspiciously small (might be empty/broken)
      if (stats.size < 1000) {
        console.warn(`   ⚠ Output file is very small (${stats.size} bytes) - diagram may be empty`);
      }
    } catch (error) {
      throw new Error(`Rendering failed: Output file not created. stderr: ${stderr}`);
    }

    return outputPath;
  } catch (error) {
    // Provide descriptive error message
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`   ❌ Failed to render diagram: ${errorMessage}`);
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
