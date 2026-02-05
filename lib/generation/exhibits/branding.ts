/**
 * Diagram branding configuration
 *
 * Provides Mermaid theme settings matching company colors for consistent
 * proposal styling across all diagrams.
 */

/**
 * Default color scheme for diagrams
 * Uses blue theme matching existing proposal styles
 */
export const DEFAULT_DIAGRAM_COLORS = {
  primary: '#2563eb',       // Blue-600 (matches proposal heading color)
  primaryText: '#ffffff',   // White text on primary
  secondary: '#f0f9ff',     // Blue-50 (light fill)
  secondaryText: '#1e3a5f', // Dark blue text
  border: '#1e40af',        // Blue-800
  background: '#ffffff',    // White background
  lineColor: '#64748b',     // Slate-500
};

/**
 * Company profile with optional branding colors
 */
export interface CompanyProfile {
  primary_color?: string;
  secondary_color?: string;
}

/**
 * Generates Mermaid theme configuration directive
 *
 * @param colors - Optional color overrides (partial or complete)
 * @returns Mermaid theme directive string ready to prepend to diagram code
 *
 * @example
 * ```typescript
 * const theme = getDiagramTheme();
 * const mermaidCode = `${theme}\ngraph TD\n  A-->B`;
 * ```
 */
export function getDiagramTheme(
  colors?: Partial<typeof DEFAULT_DIAGRAM_COLORS>
): string {
  const finalColors = {
    ...DEFAULT_DIAGRAM_COLORS,
    ...colors,
  };

  // Build Mermaid theme variables
  // See: https://mermaid.js.org/config/theming.html
  const themeVariables = {
    // Primary colors (used for main nodes, highlights)
    primaryColor: finalColors.primary,
    primaryTextColor: finalColors.primaryText,
    primaryBorderColor: finalColors.border,

    // Secondary colors (used for alternate nodes)
    secondaryColor: finalColors.secondary,
    secondaryTextColor: finalColors.secondaryText,
    secondaryBorderColor: finalColors.border,

    // Tertiary colors (for additional variations)
    tertiaryColor: finalColors.secondary,
    tertiaryTextColor: finalColors.secondaryText,
    tertiaryBorderColor: finalColors.border,

    // Background
    mainBkg: finalColors.background,

    // Lines and edges
    lineColor: finalColors.lineColor,
    edgeLabelBackground: finalColors.background,

    // Text
    textColor: finalColors.secondaryText,
    fontSize: '16px',
  };

  // Convert to Mermaid init directive format
  const themeConfig = {
    theme: 'base',
    themeVariables,
  };

  return `%%{init: ${JSON.stringify(themeConfig)}}%%`;
}

/**
 * Extracts diagram colors from company profile
 *
 * Falls back to defaults if company profile doesn't have colors defined.
 * Useful for future company-specific branding customization.
 *
 * @param companyProfile - Optional company profile with branding colors
 * @returns Color scheme object (defaults if profile lacks colors)
 *
 * @example
 * ```typescript
 * const profile = { primary_color: '#ff0000', secondary_color: '#0000ff' };
 * const colors = getCompanyDiagramColors(profile);
 * const theme = getDiagramTheme(colors);
 * ```
 */
export function getCompanyDiagramColors(
  companyProfile?: CompanyProfile
): typeof DEFAULT_DIAGRAM_COLORS {
  // If no profile or no colors, use defaults
  if (!companyProfile?.primary_color && !companyProfile?.secondary_color) {
    return DEFAULT_DIAGRAM_COLORS;
  }

  // Build color scheme from company profile
  const customColors = { ...DEFAULT_DIAGRAM_COLORS };

  if (companyProfile.primary_color) {
    customColors.primary = companyProfile.primary_color;
    customColors.border = companyProfile.primary_color;
  }

  if (companyProfile.secondary_color) {
    customColors.secondary = companyProfile.secondary_color;
  }

  return customColors;
}
