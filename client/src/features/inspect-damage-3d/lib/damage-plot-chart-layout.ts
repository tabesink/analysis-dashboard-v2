export const DAMAGE_PLOT_VIEWBOX = {
  width: 420,
  height: 260,
} as const;

export type DamagePlotChartPadding = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export const DAMAGE_PLOT_SVG_COLORS = {
  background: '#ffffff',
  grid: '#e5e7eb',
  centerLine: 'rgba(17, 24, 39, 0.68)',
  axisText: '#6b7280',
} as const;

const MIN_BOTTOM_PADDING = 40;
const MAX_BOTTOM_PADDING = 82;
const HORIZONTAL_PLOT_GUTTER = 44;

export function truncateAxisLabel(label: string, maxLength = 16): string {
  if (label.length <= maxLength) return label;
  return `${label.slice(0, maxLength - 1)}…`;
}

export function axisLabelFontSize(categoryCount: number): number {
  if (categoryCount > 10) return 8;
  if (categoryCount > 6) return 8.5;
  return 9;
}

export function computeDamagePlotChartPadding(params: {
  categoryLabels: readonly string[];
  hasTopControls?: boolean;
}): DamagePlotChartPadding {
  const longestLabelLength = Math.max(0, ...params.categoryLabels.map((label) => label.length));
  const truncatedLength = Math.min(longestLabelLength, 16);
  const labelDepth = Math.min(
    MAX_BOTTOM_PADDING - MIN_BOTTOM_PADDING,
    10 + truncatedLength * 3.2,
  );

  return {
    top: params.hasTopControls ? 24 : 14,
    right: HORIZONTAL_PLOT_GUTTER,
    bottom: MIN_BOTTOM_PADDING + labelDepth,
    left: HORIZONTAL_PLOT_GUTTER,
  };
}

export function plotAreaHeight(padding: DamagePlotChartPadding): number {
  return DAMAGE_PLOT_VIEWBOX.height - padding.top - padding.bottom;
}

export function plotAreaWidth(padding: DamagePlotChartPadding): number {
  return DAMAGE_PLOT_VIEWBOX.width - padding.left - padding.right;
}

export function categoryBandWidth(
  categoryCount: number,
  padding: DamagePlotChartPadding,
): number {
  if (categoryCount <= 0) return plotAreaWidth(padding);
  return plotAreaWidth(padding) / categoryCount;
}

export function valueToPlotY(
  value: number,
  maxValue: number,
  padding: DamagePlotChartPadding,
): number {
  const plotHeight = plotAreaHeight(padding);
  const ratio = maxValue <= 0 ? 0 : value / maxValue;
  return DAMAGE_PLOT_VIEWBOX.height - padding.bottom - ratio * plotHeight;
}

export function domainValueToPlotY(
  value: number,
  minDomain: number,
  maxDomain: number,
  padding: DamagePlotChartPadding,
): number {
  const plotHeight = plotAreaHeight(padding);
  const span = maxDomain - minDomain || 1;
  const ratio = (value - minDomain) / span;
  return DAMAGE_PLOT_VIEWBOX.height - padding.bottom - ratio * plotHeight;
}
