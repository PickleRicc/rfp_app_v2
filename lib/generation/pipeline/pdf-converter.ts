import { convert } from 'libreoffice-convert';
import { promisify } from 'util';
import { exec } from 'child_process';
import { writeFile, readFile } from 'fs/promises';

const libreConvert = promisify(convert);
const execAsync = promisify(exec);

export interface PdfConversionResult {
  success: boolean;
  pdfBuffer?: Buffer;
  error?: string;
  conversionTimeMs?: number;
}

/**
 * Check if LibreOffice is available on the system
 * Per research: zombie process pitfall - check availability before attempting
 */
export async function checkLibreOfficeAvailable(): Promise<boolean> {
  try {
    // Try soffice (Linux/Mac) or check common Windows paths
    await execAsync('soffice --version');
    return true;
  } catch {
    // Try Windows-specific paths
    try {
      await execAsync('"C:\\Program Files\\LibreOffice\\program\\soffice.exe" --version');
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Convert DOCX buffer to PDF
 * Uses LibreOffice headless CLI via libreoffice-convert wrapper
 */
export async function convertToPdf(
  docxBuffer: Buffer,
  options?: { timeout?: number }
): Promise<PdfConversionResult> {
  const startTime = Date.now();
  const timeout = options?.timeout || 30000; // 30 second default per research

  // Check LibreOffice availability first
  const available = await checkLibreOfficeAvailable();
  if (!available) {
    return {
      success: false,
      error: 'LibreOffice is not installed. Please install LibreOffice to enable PDF generation.'
    };
  }

  try {
    // Convert using libreoffice-convert wrapper
    // The wrapper handles process lifecycle to avoid zombies (research pitfall #1)
    const pdfBuffer = await Promise.race([
      libreConvert(docxBuffer, '.pdf', undefined),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Conversion timeout')), timeout)
      )
    ]);

    return {
      success: true,
      pdfBuffer: pdfBuffer as Buffer,
      conversionTimeMs: Date.now() - startTime
    };
  } catch (error) {
    return {
      success: false,
      error: `PDF conversion failed: ${error instanceof Error ? error.message : String(error)}`,
      conversionTimeMs: Date.now() - startTime
    };
  }
}

/**
 * Convert DOCX file to PDF, writing output to specified path
 * Convenience wrapper for file-based conversion
 */
export async function convertDocxFileToPdf(
  docxPath: string,
  pdfOutputPath: string
): Promise<PdfConversionResult> {
  try {
    const docxBuffer = await readFile(docxPath);
    const result = await convertToPdf(docxBuffer);

    if (result.success && result.pdfBuffer) {
      await writeFile(pdfOutputPath, result.pdfBuffer);
    }

    return result;
  } catch (error) {
    return {
      success: false,
      error: `File conversion failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}
