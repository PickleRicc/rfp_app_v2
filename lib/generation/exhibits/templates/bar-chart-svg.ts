import type { BarChartData, SvgRenderResult } from '../diagram-types';
import type { ProposalColorPalette } from '../../docx/colors';

const FONT = 'Arial, sans-serif';

function escapeXml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderBarChartSvg(
  data: BarChartData,
  palette: ProposalColorPalette
): SvgRenderResult {
  try {
    const series = data.series || [];
    if (series.length === 0) return placeholder('Bar Chart');

    const primary = palette.primary || '2563eb';
    const light = palette.primaryNodeFill || 'dbeafe';

    if (data.orientation === 'horizontal') {
      return renderHorizontal(series, primary, light, data.xLabel, data.yLabel);
    }
    return renderVertical(series, primary, light, data.xLabel, data.yLabel);
  } catch {
    return placeholder('Bar Chart');
  }
}

function renderHorizontal(
  series: BarChartData['series'],
  primary: string,
  light: string,
  xLabel?: string,
  yLabel?: string
): SvgRenderResult {
  const PAD_L = 160;
  const PAD_R = 60;
  const PAD_T = 20;
  const PAD_B = xLabel ? 44 : 24;
  const BAR_H = 28;
  const BAR_GAP = 12;
  const svgW = 600;
  const chartW = svgW - PAD_L - PAD_R;
  const svgH = PAD_T + PAD_B + series.length * (BAR_H + BAR_GAP) - BAR_GAP;

  const maxVal = Math.max(...series.map(s => s.value), 1);

  let out = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">`;
  out += `<rect width="${svgW}" height="${svgH}" fill="#ffffff"/>`;

  // Grid lines (4 lines)
  for (let i = 0; i <= 4; i++) {
    const gx = PAD_L + (chartW * i) / 4;
    out += `<line x1="${gx}" y1="${PAD_T}" x2="${gx}" y2="${svgH - PAD_B}"
      stroke="#e2e8f0" stroke-width="0.5"/>`;
    const val = Math.round((maxVal * i) / 4);
    out += `<text x="${gx}" y="${svgH - PAD_B + 14}" text-anchor="middle"
      font-family="${FONT}" font-size="9" fill="#94a3b8">${val}</text>`;
  }

  // Bars
  for (let i = 0; i < series.length; i++) {
    const s = series[i];
    const barW = Math.max(0, (s.value / maxVal) * chartW);
    const by = PAD_T + i * (BAR_H + BAR_GAP);
    const color = s.color || primary;

    out += `<rect x="${PAD_L}" y="${by}" width="${barW}" height="${BAR_H}"
      rx="3" fill="#${color}"/>`;
    out += `<text x="${PAD_L - 8}" y="${by + BAR_H / 2 + 4}" text-anchor="end"
      font-family="${FONT}" font-size="10" fill="#1e293b">${escapeXml(s.label)}</text>`;
    out += `<text x="${PAD_L + barW + 6}" y="${by + BAR_H / 2 + 4}"
      font-family="${FONT}" font-size="10" font-weight="600" fill="#1e293b">${s.value}</text>`;
  }

  // Axes
  out += `<line x1="${PAD_L}" y1="${PAD_T}" x2="${PAD_L}" y2="${svgH - PAD_B}"
    stroke="#64748b" stroke-width="1.5"/>`;
  out += `<line x1="${PAD_L}" y1="${svgH - PAD_B}" x2="${svgW - PAD_R}" y2="${svgH - PAD_B}"
    stroke="#64748b" stroke-width="1.5"/>`;

  if (xLabel) {
    out += `<text x="${PAD_L + chartW / 2}" y="${svgH - 6}" text-anchor="middle"
      font-family="${FONT}" font-size="10" fill="#64748b">${escapeXml(xLabel)}</text>`;
  }

  out += `</svg>`;
  return { svg: out, width: svgW, height: svgH };
}

function truncateLabel(label: string, max: number): string {
  if (label.length <= max) return label;
  return label.slice(0, max - 1) + '\u2026';
}

function renderVertical(
  series: BarChartData['series'],
  primary: string,
  light: string,
  xLabel?: string,
  yLabel?: string
): SvgRenderResult {
  const PAD_L = yLabel ? 52 : 36;
  const PAD_R = 20;
  const PAD_T = 20;
  const rotateLabels = series.length > 4;
  const PAD_B = rotateLabels ? 112 : 52; // Extra space for rotated labels
  const svgW = 600;
  const chartW = svgW - PAD_L - PAD_R;
  const chartH = 220;
  const svgH = PAD_T + chartH + PAD_B;

  // Bar width: cap at 80px, add more gap when fewer than 6 bars
  const barGap = series.length < 6 ? 24 : 10;
  const rawBarW = Math.floor(chartW / series.length) - barGap;
  const barW = Math.min(80, Math.max(20, rawBarW));
  const maxVal = Math.max(...series.map(s => s.value), 1);

  // Center bars within chart area
  const totalBarsWidth = series.length * barW + (series.length - 1) * barGap;
  const barAreaOffset = (chartW - totalBarsWidth) / 2;

  let out = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">`;
  out += `<rect width="${svgW}" height="${svgH}" fill="#ffffff"/>`;

  // Grid lines
  for (let i = 0; i <= 4; i++) {
    const gy = PAD_T + chartH - (chartH * i) / 4;
    out += `<line x1="${PAD_L}" y1="${gy}" x2="${svgW - PAD_R}" y2="${gy}"
      stroke="#e2e8f0" stroke-width="0.5"/>`;
    const val = Math.round((maxVal * i) / 4);
    out += `<text x="${PAD_L - 6}" y="${gy + 4}" text-anchor="end"
      font-family="${FONT}" font-size="9" fill="#94a3b8">${val}</text>`;
  }

  // Bars
  for (let i = 0; i < series.length; i++) {
    const s = series[i];
    const barH = (s.value / maxVal) * chartH;
    const bx = PAD_L + barAreaOffset + i * (barW + barGap);
    const by = PAD_T + chartH - barH;
    const color = s.color || primary;

    out += `<rect x="${bx}" y="${by}" width="${barW}" height="${barH}"
      rx="3" fill="#${color}"/>`;

    // X-axis labels
    const labelText = escapeXml(truncateLabel(s.label, 30));
    const labelX = bx + barW / 2;
    const labelY = PAD_T + chartH + 16;
    if (rotateLabels) {
      out += `<text x="${labelX}" y="${labelY}" text-anchor="end"
        font-family="${FONT}" font-size="9" fill="#1e293b"
        transform="rotate(-45, ${labelX}, ${labelY})">${labelText}</text>`;
    } else {
      out += `<text x="${labelX}" y="${labelY}" text-anchor="middle"
        font-family="${FONT}" font-size="9" fill="#1e293b">${labelText}</text>`;
    }

    // Value labels above bars
    out += `<text x="${bx + barW / 2}" y="${by - 4}" text-anchor="middle"
      font-family="${FONT}" font-size="9" font-weight="600" fill="#1e293b">${s.value}</text>`;
  }

  // Axes
  out += `<line x1="${PAD_L}" y1="${PAD_T}" x2="${PAD_L}" y2="${PAD_T + chartH}"
    stroke="#64748b" stroke-width="1.5"/>`;
  out += `<line x1="${PAD_L}" y1="${PAD_T + chartH}" x2="${svgW - PAD_R}" y2="${PAD_T + chartH}"
    stroke="#64748b" stroke-width="1.5"/>`;

  if (xLabel) {
    out += `<text x="${PAD_L + chartW / 2}" y="${svgH - 4}" text-anchor="middle"
      font-family="${FONT}" font-size="10" fill="#64748b">${escapeXml(xLabel)}</text>`;
  }
  if (yLabel) {
    out += `<text transform="rotate(-90)" x="${-(PAD_T + chartH / 2)}" y="14" text-anchor="middle"
      font-family="${FONT}" font-size="10" fill="#64748b">${escapeXml(yLabel)}</text>`;
  }

  out += `</svg>`;
  return { svg: out, width: svgW, height: svgH };
}

function placeholder(title: string): SvgRenderResult {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="280" viewBox="0 0 600 280">
  <rect width="600" height="280" rx="8" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1.5"/>
  <text x="300" y="145" text-anchor="middle" font-family="${FONT}" font-size="13" fill="#94a3b8">${escapeXml(title)}</text>
</svg>`;
  return { svg, width: 600, height: 280 };
}
