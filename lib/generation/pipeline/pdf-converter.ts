export interface PdfConversionResult {
  success: boolean;
  pdfBuffer?: Buffer;
  error?: string;
  conversionTimeMs?: number;
}

/**
 * Check if LibreOffice is available on the system
 * Currently disabled - LibreOffice on Windows prompts for printer connections
 */
export async function checkLibreOfficeAvailable(): Promise<boolean> {
  return false;
}

/**
 * Convert DOCX buffer to PDF
 * Currently disabled - LibreOffice on Windows prompts for printer connections.
 * DOCX files are generated and downloadable. PDF can be re-enabled when
 * a headless conversion solution is available.
 */
export async function convertToPdf(
  docxBuffer: Buffer,
  options?: { timeout?: number }
): Promise<PdfConversionResult> {
  return {
    success: false,
    error: 'PDF conversion disabled - DOCX files are available for download',
  };
}

/**
 * Convert DOCX file to PDF
 * Currently disabled.
 */
export async function convertDocxFileToPdf(
  docxPath: string,
  pdfOutputPath: string
): Promise<PdfConversionResult> {
  return {
    success: false,
    error: 'PDF conversion disabled - DOCX files are available for download',
  };
}
