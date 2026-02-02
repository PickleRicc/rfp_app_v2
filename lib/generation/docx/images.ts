/**
 * Logo Image Handling Utilities for DOCX Generation
 *
 * Provides functions to fetch logos from URLs and convert them to buffers
 * suitable for use with docx ImageRun elements. Handles errors gracefully
 * to allow document generation to continue even without logos.
 *
 * @module lib/generation/docx/images
 */

/**
 * Dimensions for logo placement in documents
 * Values are in EMUs (English Metric Units) / points for docx
 */
export interface LogoDimensions {
  /** Width in docx points (1 inch = 72 points) */
  width: number;
  /** Height in docx points (1 inch = 72 points) */
  height: number;
}

/**
 * Standard logo size for cover page
 * Approximately 2 inches wide x 1.33 inches tall (maintains 3:2 aspect ratio)
 */
export const COVER_LOGO_SIZE: LogoDimensions = {
  width: 144, // 2 inches * 72 points
  height: 96, // Maintains approximate 3:2 aspect ratio
};

/**
 * Standard logo size for document headers
 * Small size suitable for header placement without overwhelming content
 */
export const HEADER_LOGO_SIZE: LogoDimensions = {
  width: 50,
  height: 33,
};

/**
 * Calculate proportional height given a width and aspect ratio
 *
 * @param width - Desired width in points
 * @param aspectRatio - Width divided by height (e.g., 1.5 for 3:2)
 * @returns Calculated height in points
 *
 * @example
 * // For a logo with 16:9 aspect ratio, to fit in 200pt width:
 * const height = calculateProportionalHeight(200, 16/9); // ~112.5pt
 */
export function calculateProportionalHeight(
  width: number,
  aspectRatio: number
): number {
  if (aspectRatio <= 0) {
    throw new Error('Aspect ratio must be greater than 0');
  }
  return Math.round(width / aspectRatio);
}

/**
 * Calculate proportional width given a height and aspect ratio
 *
 * @param height - Desired height in points
 * @param aspectRatio - Width divided by height (e.g., 1.5 for 3:2)
 * @returns Calculated width in points
 *
 * @example
 * // For a logo with 16:9 aspect ratio, to fit in 100pt height:
 * const width = calculateProportionalWidth(100, 16/9); // ~178pt
 */
export function calculateProportionalWidth(
  height: number,
  aspectRatio: number
): number {
  if (aspectRatio <= 0) {
    throw new Error('Aspect ratio must be greater than 0');
  }
  return Math.round(height * aspectRatio);
}

/**
 * Fetch a logo from a URL and convert it to a Buffer for use in docx ImageRun
 *
 * Uses native Node.js fetch (available in Node 18+). Returns null on any failure
 * to allow document generation to continue with text-only headers/cover pages.
 *
 * @param logoUrl - Full URL to the logo image (PNG, JPEG, etc.)
 * @returns Buffer containing the image data, or null if fetch fails
 *
 * @example
 * ```typescript
 * import { fetchLogoAsBuffer, COVER_LOGO_SIZE } from './images';
 * import { ImageRun } from 'docx';
 *
 * const logoBuffer = await fetchLogoAsBuffer('https://example.com/logo.png');
 * if (logoBuffer) {
 *   new ImageRun({
 *     data: logoBuffer,
 *     transformation: {
 *       width: COVER_LOGO_SIZE.width,
 *       height: COVER_LOGO_SIZE.height,
 *     },
 *   });
 * }
 * ```
 */
export async function fetchLogoAsBuffer(
  logoUrl: string
): Promise<Buffer | null> {
  if (!logoUrl || typeof logoUrl !== 'string') {
    console.warn('fetchLogoAsBuffer: Invalid or empty logo URL provided');
    return null;
  }

  try {
    // Validate URL format
    const url = new URL(logoUrl);
    if (!['http:', 'https:'].includes(url.protocol)) {
      console.warn(
        `fetchLogoAsBuffer: Unsupported protocol ${url.protocol}, only http/https allowed`
      );
      return null;
    }

    const response = await fetch(logoUrl);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch logo: ${response.status} ${response.statusText}`
      );
    }

    // Verify content type is an image
    const contentType = response.headers.get('content-type');
    if (contentType && !contentType.startsWith('image/')) {
      console.warn(
        `fetchLogoAsBuffer: Response content-type is not an image: ${contentType}`
      );
      // Continue anyway - some servers don't set content-type correctly
    }

    const arrayBuffer = await response.arrayBuffer();

    if (arrayBuffer.byteLength === 0) {
      console.warn('fetchLogoAsBuffer: Received empty response body');
      return null;
    }

    return Buffer.from(arrayBuffer);
  } catch (error) {
    // Log warning but don't throw - allows document generation to continue
    console.warn('fetchLogoAsBuffer: Failed to fetch logo:', error);
    return null;
  }
}

/**
 * Check if a URL is a valid logo URL (basic validation)
 *
 * @param url - URL string to validate
 * @returns true if URL appears to be a valid http/https URL
 */
export function isValidLogoUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}
