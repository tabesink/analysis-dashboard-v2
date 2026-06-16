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
  truncateAxisLabel,
  valueToPlotY,
} from '../lib/damage-plot-chart-layout';

type AbsoluteByEventPlotCardProps = {
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

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return '0%';
  if (value >= 10) return `${value.toFixed(0)}%`;
  return `${value.toFixed(1)}%`;
}

export function AbsoluteByEventPlotCard({
  spec,
  isLoading = false,
  error = null,
  className,
}: AbsoluteByEventPlotCardProps) {
  const isEmpty = Boolean(spec.emptyState) || spec.series.length === 0 || spec.xCategories.length === 0;
  const yMax = spec.yScale.domain[1] > 0 ? spec.yScale.domain[1] : 1;
  const tickCount = 5;
  const ticks = Array.from({ length: tickCount }, (_, index) => (yMax / (tickCount - 1)) * index);
  const legendItems = spec.series.map((series) => ({
    id: series.id,
    label: series.label,
    color: series.color,
  }));
  const padding = computeDamagePlotChartPadding({ categoryLabels: spec.xCategories });
  const labelFontSize = axisLabelFontSize(spec.xCategories.length);

  return (
    <PlotCardShell
      title={spec.title}
      subtitle={spec.subtitle}
      isLoading={isLoading}
      error={error}
      isEmpty={isEmpty}
      emptyTitle={spec.emptyState?.title ?? 'No event damage data'}
      emptyDescription={spec.emptyState?.description}
      className={cn(className ?? PLOT_CARD_BASE_CLASS)}
    >
      <div className={DAMAGE_PLOT_CHART_REGION_CLASS}>
        <svg
          viewBox={`0 0 ${DAMAGE_PLOT_VIEWBOX.width} ${DAMAGE_PLOT_VIEWBOX.height}`}
          preserveAspectRatio="xMidYMid meet"
          className="h-full max-h-full w-full max-w-full"
          role="img"
          aria-label={`${spec.title} stacked bar chart`}
          data-stacked-event-plot="true"
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

          {spec.xCategories.map((channel, categoryIndex) => {
            const bandWidth = categoryBandWidth(spec.xCategories.length, padding);
            const barWidth = Math.max(6, bandWidth * 0.58);
            const x = padding.left + categoryIndex * bandWidth + (bandWidth - barWidth) / 2;
            const labelAnchorY = DAMAGE_PLOT_VIEWBOX.height - padding.bottom + 2;
            let runningTotal = 0;

            return (
              <g key={channel}>
                {spec.series.map((series) => {
                  const value = series.values[categoryIndex] ?? 0;
                  const percentage = series.percentages?.[categoryIndex] ?? 0;
                  const segmentBottom = runningTotal;
                  runningTotal += value;
                  const yTop = valueToPlotY(runningTotal, yMax, padding);
                  const yBottom = valueToPlotY(segmentBottom, yMax, padding);
                  const height = Math.max(0, yBottom - yTop);
                  if (height <= 0) return null;
                  const showPercentLabel = height >= 12 && barWidth >= 12;

                  return (
                    <g
                      key={`${series.id}-${channel}`}
                    >
                      <rect
                        x={x}
                        y={yTop}
                        width={barWidth}
                        height={Math.max(height, 1)}
                        fill={series.color}
                        opacity={0.92}
                        role="img"
                        aria-label={`${series.label} contribution for ${channel}: ${formatValue(value)} (${formatPercent(percentage)})`}
                        data-stacked-bar-id={`${series.id}-${categoryIndex}`}
                        data-stacked-bar-percent={formatPercent(percentage)}
                      >
                        <title>
                          {[
                            `Channel: ${channel}`,
                            `Event: ${series.label}`,
                            `Value: ${formatValue(value)}`,
                            `Share: ${formatPercent(percentage)}`,
                          ].join('\n')}
                        </title>
                      </rect>
                      {showPercentLabel ? (
                        <text
                          x={x + barWidth / 2}
                          y={yTop + height / 2 + 3}
                          textAnchor="middle"
                          fontSize={8}
                          fontWeight={600}
                          fill="white"
                          pointerEvents="none"
                        >
                          {formatPercent(percentage)}
                        </text>
                      ) : null}
                    </g>
                  );
                })}
                <text
                  x={x + barWidth / 2}
                  y={labelAnchorY}
                  textAnchor="end"
                  fontSize={labelFontSize}
                  fontWeight={500}
                  fill={DAMAGE_PLOT_SVG_COLORS.axisText}
                  transform={`rotate(-90, ${x + barWidth / 2}, ${labelAnchorY})`}
                >
                  {truncateAxisLabel(channel)}
                  <title>{channel}</title>
                </text>
              </g>
            );
          })}
        </svg>

        <PlotLegendOverlay items={legendItems} />

        {spec.warnings[0] ? (
          <p className="pointer-events-none absolute left-1 top-1 max-w-[70%] truncate rounded-md bg-amber-100/90 px-1.5 py-0.5 text-[9px] text-amber-800 shadow-sm">
            {spec.warnings[0]}
          </p>
        ) : null}
      </div>
    </PlotCardShell>
  );
}
