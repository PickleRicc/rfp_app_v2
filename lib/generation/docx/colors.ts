/**
 * Proposal Color Palette — Color Derivation Utility
 *
 * Derives a full proposal color palette from a company's primary/secondary hex colors.
 * Used by styles.ts, markdown-parser.ts, and generator.ts to replace hardcoded blues
 * with company-specific branding.
 *
 * When no colors are provided, falls back to the existing blue palette (backward compatible).
 */

// ===== TYPES =====

/** Full color palette used across DOCX generation */
export interface ProposalColorPalette {
  /** Primary brand color — headings, borders, accents (e.g., '2563eb') */
  primary: string;
  /** Darker variant — H2, secondary headings (e.g., '1e40af') */
  primaryDark: string;
  /** Light tint — callout/quote backgrounds (e.g., 'F0F9FF') */
  primaryLight: string;
  /** Node fill — diagrams, subtle fills (e.g., 'dbeafe') */
  primaryNodeFill: string;
  /** Table header background — uses primary */
  tableHeaderBg: string;
  /** Table header text — typically white */
  tableHeaderText: string;
}

// ===== DEFAULT PALETTE =====

/** Existing blue palette — backward-compatible default */
export const DEFAULT_PALETTE: ProposalColorPalette = {
  primary: '2563eb',
  primaryDark: '1e40af',
  primaryLight: 'F0F9FF',
  primaryNodeFill: 'dbeafe',
  tableHeaderBg: '2563eb',
  tableHeaderText: 'FFFFFF',
};

// ===== HEX HELPERS =====

/**
 * Parse a hex color string to RGB components.
 * Accepts with or without '#' prefix, 3 or 6 char hex.
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  let clean = hex.replace(/^#/, '');
  if (clean.length === 3) {
    clean = clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2];
  }
  if (clean.length !== 6) return null;

  const num = parseInt(clean, 16);
  if (isNaN(num)) return null;

  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

/** Convert RGB components back to 6-char hex (no '#' prefix) */
function rgbToHex(r: number, g: number, b: number): string {
  return [r, g, b]
    .map(c => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Darken a hex color by mixing toward black.
 * @param hex - 6-char hex color (no '#')
 * @param amount - 0..1 fraction to darken (0.2 = 20% darker)
 */
export function darkenHex(hex: string, amount: number = 0.2): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return rgbToHex(
    rgb.r * (1 - amount),
    rgb.g * (1 - amount),
    rgb.b * (1 - amount)
  );
}

/**
 * Lighten a hex color by mixing toward white.
 * @param hex - 6-char hex color (no '#')
 * @param amount - 0..1 fraction toward white (0.9 = 90% toward white)
 */
export function lightenHex(hex: string, amount: number = 0.9): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return rgbToHex(
    rgb.r + (255 - rgb.r) * amount,
    rgb.g + (255 - rgb.g) * amount,
    rgb.b + (255 - rgb.b) * amount
  );
}

// ===== PALETTE BUILDER =====

/**
 * Build a full ProposalColorPalette from optional company colors.
 * Derives dark/light/fill variants from the primary color.
 * Falls back to DEFAULT_PALETTE when no color is provided.
 *
 * @param primaryColor - Company primary hex color (with or without '#'), e.g., '#2563eb' or '2563eb'
 * @param _secondaryColor - Reserved for future use (secondary accent color)
 */
export function buildColorPalette(
  primaryColor?: string,
  _secondaryColor?: string
): ProposalColorPalette {
  if (!primaryColor) {
    return DEFAULT_PALETTE;
  }

  const clean = primaryColor.replace(/^#/, '');
  const rgb = hexToRgb(clean);
  if (!rgb) {
    return DEFAULT_PALETTE;
  }

  return {
    primary: clean,
    primaryDark: darkenHex(clean, 0.2),
    primaryLight: lightenHex(clean, 0.9),
    primaryNodeFill: lightenHex(clean, 0.8),
    tableHeaderBg: clean,
    tableHeaderText: 'FFFFFF',
  };
}
