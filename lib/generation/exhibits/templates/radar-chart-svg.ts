import type { RadarChartData, SvgRenderResult } from '../diagram-types';
import type { ProposalColorPalette } from '../../docx/colors';

const FONT = 'Arial, sans-serif';

function escapeXml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function hexWithAlpha(hex: string, alpha: number): string {
  // Returns rgba() for SVG fill-opacity approach — just return the hex and use opacity attribute
  return `#${hex}`;
}

export function renderRadarChartSvg(
  data: RadarChartData,
  palette: ProposalColorPalette
): SvgRenderResult {
  try {
    const axes = data.axes || [];
    const series = data.series || [];
    if (axes.length < 3 || series.length === 0) return placeholder('Capability Radar');

    const primary = palette.primary || '2563eb';
    const light = palette.primaryNodeFill || 'dbeafe';

    const CX = 280;
    const CY = 260;
    const R = 180;
    const LABEL_PAD = 28;
    const svgW = 560;
    const svgH = 520;
    const n = axes.length;
    const levels = 5;

    // Angle for each axis (start from top, go clockwise)
    const angle = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;

    let out = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">`;
    out += `<rect width="${svgW}" height="${svgH}" fill="#ffffff"/>`;

    // Grid polygons (concentric)
    for (let l = levels; l >= 1; l--) {
      const r = (R * l) / levels;
      const pts = axes.map((_, i) => {
        const a = angle(i);
        return `${CX + r * Math.cos(a)},${CY + r * Math.sin(a)}`;
      }).join(' ');
      out += `<polygon points="${pts}" fill="${l % 2 === 0 ? '#f8fafc' : '#ffffff'}" stroke="#e2e8f0" stroke-width="1"/>`;
    }

    // Axis lines
    for (let i = 0; i < n; i++) {
      const a = angle(i);
      out += `<line x1="${CX}" y1="${CY}" x2="${CX + R * Math.cos(a)}" y2="${CY + R * Math.sin(a)}"
        stroke="#e2e8f0" stroke-width="1"/>`;
    }

    // Axis labels
    for (let i = 0; i < n; i++) {
      const a = angle(i);
      const lx = CX + (R + LABEL_PAD) * Math.cos(a);
      const ly = CY + (R + LABEL_PAD) * Math.sin(a);
      const anchor = Math.cos(a) > 0.1 ? 'start' : Math.cos(a) < -0.1 ? 'end' : 'middle';
      out += `<text x="${lx}" y="${ly + 4}" text-anchor="${anchor}"
        font-family="${FONT}" font-size="11" font-weight="600" fill="#1e293b">${escapeXml(axes[i])}</text>`;
    }

    // Series fills and strokes — cycle through colors for multiple series
    const seriesColors = [primary, '0f766e', 'c2410c', '6d28d9'];
    for (let s = 0; s < series.length; s++) {
      const sr = series[s];
      const color = seriesColors[s % seriesColors.length];
      const pts = axes.map((_, i) => {
        const val = Math.min(100, Math.max(0, sr.values[i] || 0));
        const r = (R * val) / 100;
        const a = angle(i);
        return `${CX + r * Math.cos(a)},${CY + r * Math.sin(a)}`;
      }).join(' ');
      out += `<polygon points="${pts}" fill="#${color}" fill-opacity="0.15" stroke="#${color}" stroke-width="2"/>`;
      // Dots at each axis
      for (let i = 0; i < axes.length; i++) {
        const val = Math.min(100, Math.max(0, sr.values[i] || 0));
        const r = (R * val) / 100;
        const a = angle(i);
        out += `<circle cx="${CX + r * Math.cos(a)}" cy="${CY + r * Math.sin(a)}" r="4"
          fill="#${color}" stroke="#ffffff" stroke-width="1.5"/>`;
      }
    }

    // Legend (if multiple series)
    if (series.length > 1) {
      let ly = svgH - 20 * series.length - 8;
      for (let s = 0; s < series.length; s++) {
        const color = seriesColors[s % seriesColors.length];
        out += `<circle cx="20" cy="${ly + s * 20}" r="6" fill="#${color}"/>`;
        out += `<text x="30" y="${ly + s * 20 + 4}" font-family="${FONT}" font-size="10" fill="#1e293b">${escapeXml(series[s].name)}</text>`;
      }
    }

    out += `</svg>`;
    return { svg: out, width: svgW, height: svgH };
  } catch {
    return placeholder('Capability Radar');
  }
}

function placeholder(title: string): SvgRenderResult {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="560" height="520" viewBox="0 0 560 520">
  <rect width="560" height="520" rx="8" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1.5"/>
  <text x="280" y="265" text-anchor="middle" font-family="${FONT}" font-size="13" fill="#94a3b8">${escapeXml(title)}</text>
</svg>`;
  return { svg, width: 560, height: 520 };
}
