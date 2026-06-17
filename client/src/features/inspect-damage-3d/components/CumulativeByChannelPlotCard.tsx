'use client';

import { PlotCardShell } from '@/components/charts/PlotCardShell';
import { PlotLegendOverlay } from '@/components/charts/PlotLegendOverlay';
import {
  DAMAGE_PLOT_CHART_REGION_CLASS,
  PLOT_CARD_BASE_CLASS,
} from '@/components/charts/plot-card-styles';
import { cn } from '@/lib/utils';
import type { Damage2DPlotSpec } from '../lib/build-damage-2d-plot-spec';
import {
  axisLabelFontSize,
  categoryBandWidth,
  computeDamagePlotChartPadding,
  DAMAGE_PLOT_SVG_COLORS,
  DAMAGE_PLOT_VIEWBOX,
  plotAreaHeight,
  truncateAxisLabel,
  valueToPlotY,
} from '../lib/damage-plot-chart-layout';

type CumulativeByChannelPlotCardProps = {
  spec: Damage2DPlotSpec;
  isLoading?: boolean;
  error?: string | null;
  className?: string;
};

function formatValue(value: number): string {
  if (!Number.isFinite(value)) return '0';
  if (Math.abs(value) >= 1000 || (Math.abs(value) > 0 && Math.abs(value) < 0.001)) {
    return value.toExponential(2);
  }
  if (Math.abs(value) < 1) {
    return value.toFixed(3);
  }
  return value.toFixed(2);
}

function formatTick(value: number): string {
  if (!Number.isFinite(value)) return '0';
  if (Math.abs(value) >= 1000) return value.toExponential(1);
  if (Math.abs(value) < 1) return value.toFixed(2);
  return value.toFixed(1);
}

function buildScaleContext(scaleMode: Damage2DPlotSpec['yScale']['mode']): string {
  return scaleMode === 'log' ? 'log10(1 + x)' : 'linear';
}

function buildBarHoverText(params: {
  channel: string;
  dataset: string;
  value: number;
  valueModeLabel: string;
  scaleMode: Damage2DPlotSpec['yScale']['mode'];
}): string {
  return [
    `Channel: ${params.channel}`,
    `Dataset: ${params.dataset}`,
    `Value: ${formatValue(params.value)}`,
    `Value mode: ${params.valueModeLabel}`,
    `Scale context: ${buildScaleContext(params.scaleMode)}`,
  ].join('\n');
}

export function CumulativeByChannelPlotCard({
  spec,
  isLoading = false,
  error = null,
  className,
}: CumulativeByChannelPlotCardProps) {
  const hasChartData =
    !spec.emptyState && spec.series.length > 0 && spec.xCategories.length > 0;
  const yMax = spec.yScale.domain[1] > 0 ? spec.yScale.domain[1] : 1;
  const tickCount = 5;
  const ticks = Array.from({ length: tickCount }, (_, index) => (yMax / (tickCount - 1)) * index);
  const barSeries = spec.series.filter((series) => series.values.length > 0);
  const valueModeLabel = spec.yScale.tickFormat === 'percent' ? 'normalized' : 'absolute';
  const legendItems = spec.legend.map((legendItem) => ({
    id: legendItem.role,
    label: legendItem.label,
    color: legendItem.color,
  }));
  const padding = computeDamagePlotChartPadding({ categoryLabels: spec.xCategories });
  const labelFontSize = axisLabelFontSize(spec.xCategories.length);
  const plotHeight = plotAreaHeight(padding);

  return (
    <PlotCardShell
      title={spec.title}
      subtitle={spec.subtitle}
      isLoading={isLoading}
      error={error}
      className={cn(className ?? PLOT_CARD_BASE_CLASS)}
    >
      <div className={DAMAGE_PLOT_CHART_REGION_CLASS}>
        <svg
          viewBox={`0 0 ${DAMAGE_PLOT_VIEWBOX.width} ${DAMAGE_PLOT_VIEWBOX.height}`}
          preserveAspectRatio="xMidYMid meet"
          className="h-full max-h-full w-full max-w-full"
          role="img"
          aria-label="Cumulative Damage by Channel grouped bar chart"
        >
          <rect
            x={0}
            y={0}
            width={DAMAGE_PLOT_VIEWBOX.width}
            height={DAMAGE_PLOT_VIEWBOX.height}
            fill={DAMAGE_PLOT_SVG_COLORS.background}
          />

          {ticks.map((tick) => {
            const y = valueToPlotY(tick, yMax, padding);
            return (
              <g key={`tick-${tick}`}>
                <line
                  x1={padding.left}
                  x2={DAMAGE_PLOT_VIEWBOX.width - padding.right}
                  y1={y}
                  y2={y}
                  stroke={DAMAGE_PLOT_SVG_COLORS.grid}
                  strokeWidth={1}
                />
                <text
                  x={padding.left - 4}
                  y={y + 3}
                  textAnchor="end"
                  fontSize={8}
                  fill={DAMAGE_PLOT_SVG_COLORS.axisText}
                >
                  {formatTick(tick)}
                </text>
              </g>
            );
          })}

          {hasChartData
            ? spec.xCategories.map((channel, categoryIndex) => {
            const bandWidth = categoryBandWidth(spec.xCategories.length, padding);
            const groupLeft = padding.left + categoryIndex * bandWidth;
            const innerGap = 3;
            const totalBars = Math.max(1, barSeries.length);
            const barWidth = (bandWidth - innerGap * (totalBars + 1)) / totalBars;
            const labelAnchorY = DAMAGE_PLOT_VIEWBOX.height - padding.bottom + 2;

            return (
              <g key={channel}>
                {barSeries.map((series, seriesIndex) => {
                  const value = series.values[categoryIndex] ?? 0;
                  const heightRatio = yMax === 0 ? 0 : value / yMax;
                  const barHeight = heightRatio * plotHeight;
                  const x = groupLeft + innerGap + seriesIndex * (barWidth + innerGap);
                  const y = DAMAGE_PLOT_VIEWBOX.height - padding.bottom - barHeight;
                  const hoverText = buildBarHoverText({
                    channel,
                    dataset: series.label,
                    value,
                    valueModeLabel,
                    scaleMode: spec.yScale.mode,
                  });

                  return (
                    <rect
                      key={`${series.id}-${channel}`}
                      x={x}
                      y={y}
                      width={barWidth}
                      height={Math.max(barHeight, 1)}
                      fill={series.color}
                      opacity={0.92}
                      rx={2}
                      role="img"
                      aria-label={`${series.label} value for ${channel}: ${formatValue(value)}`}
                      data-bar-id={`${series.id}-${categoryIndex}`}
                    >
                      <title>{hoverText}</title>
                    </rect>
                  );
                })}
                <text
                  x={groupLeft + bandWidth / 2}
                  y={labelAnchorY}
                  textAnchor="end"
                  fontSize={labelFontSize}
                  fontWeight={500}
                  fill={DAMAGE_PLOT_SVG_COLORS.axisText}
                  transform={`rotate(-90, ${groupLeft + bandWidth / 2}, ${labelAnchorY})`}
                >
                  {truncateAxisLabel(channel)}
                  <title>{channel}</title>
                </text>
              </g>
            );
          })
            : null}
        </svg>

        {hasChartData ? <PlotLegendOverlay items={legendItems} /> : null}

        {spec.warnings[0] ? (
          <p className="pointer-events-none absolute left-1 top-1 max-w-[70%] truncate rounded-md bg-amber-100/90 px-1.5 py-0.5 text-[9px] text-amber-800 shadow-sm">
            {spec.warnings[0]}
          </p>
        ) : null}
      </div>
    </PlotCardShell>
  );
}
