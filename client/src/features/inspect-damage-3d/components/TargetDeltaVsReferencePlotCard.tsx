'use client';

import { useMemo } from 'react';
import { PlotCardShell } from '@/components/charts/PlotCardShell';
import {
  DAMAGE_PLOT_CHART_REGION_CLASS,
  PLOT_CARD_BASE_CLASS,
} from '@/components/charts/plot-card-styles';
import { cn } from '@/lib/utils';
import type { Damage2DPlotSpec } from '../lib/build-damage-2d-plot-spec';
import {
  computeDeltaMetricDomain,
  computeDeltaMetricValue,
  getDeltaMetricLabel,
} from '../lib/delta-metric-mode';
import {
  axisLabelFontSize,
  categoryBandWidth,
  computeDamagePlotChartPadding,
  DAMAGE_PLOT_SVG_COLORS,
  DAMAGE_PLOT_VIEWBOX,
  domainValueToPlotY,
  truncateAxisLabel,
} from '../lib/damage-plot-chart-layout';

type TargetDeltaVsReferencePlotCardProps = {
  spec: Damage2DPlotSpec;
  isLoading?: boolean;
  error?: string | null;
  className?: string;
};

type DeltaMetricRow = {
  channel: string;
  referenceDamage: number;
  targetDamage: number;
  signedDelta: number;
  valueModeLabel: string;
  lowReference: boolean;
  metricValue: number | null;
  metricUnavailable: boolean;
};

function formatValue(value: number): string {
  if (!Number.isFinite(value)) return '0.00';
  if (Math.abs(value) >= 1000 || (Math.abs(value) > 0 && Math.abs(value) < 0.001)) {
    return value.toExponential(2);
  }
  return value.toFixed(2);
}

function formatRatioValue(value: number): string {
  return `${formatValue(value)}x`;
}

function buildBarHoverText(params: { row: DeltaMetricRow }): string {
  const metricLabel = getDeltaMetricLabel('ratio');
  const metricValueText = params.row.metricUnavailable
    ? `${metricLabel}: unavailable (low reference)`
    : `${metricLabel}: ${formatRatioValue(params.row.metricValue ?? 0)}`;
  return [
    `Channel: ${params.row.channel}`,
    `Reference damage: ${formatValue(params.row.referenceDamage)}`,
    `Target damage: ${formatValue(params.row.targetDamage)}`,
    metricValueText,
    `Value mode: ${params.row.valueModeLabel}`,
    params.row.lowReference ? 'Low reference: yes' : 'Low reference: no',
  ].join('\n');
}

export function TargetDeltaVsReferencePlotCard({
  spec,
  isLoading = false,
  error = null,
  className,
}: TargetDeltaVsReferencePlotCardProps) {
  const metricMode = 'ratio' as const;
  const deltaSeries = spec.series[0];
  const deltaRows = spec.deltaRows ?? [];
  const values = deltaSeries?.values ?? [];
  const metricRows = useMemo<DeltaMetricRow[]>(
    () =>
      spec.xCategories.map((channel, index) => {
        const row = deltaRows[index];
        const signedDelta = row?.signedDelta ?? values[index] ?? 0;
        const referenceDamage = row?.referenceDamage ?? 0;
        const targetDamage = row?.targetDamage ?? 0;
        const lowReference = row?.lowReference ?? false;
        const metricValue = computeDeltaMetricValue(
          {
            referenceDamage,
            targetDamage,
            signedDelta,
            lowReference,
          },
          metricMode,
        );
        return {
          channel,
          referenceDamage,
          targetDamage,
          signedDelta,
          valueModeLabel: row?.valueModeLabel ?? 'absolute',
          lowReference,
          metricValue,
          metricUnavailable: metricValue === null,
        };
      }),
    [deltaRows, metricMode, spec.xCategories, values],
  );
  const isEmpty = Boolean(spec.emptyState) || values.length === 0 || spec.xCategories.length === 0;
  const metricValues = metricRows.map((row) => (row.metricUnavailable ? null : (row.metricValue ?? 0)));
  const [minDomain, maxDomain] = computeDeltaMetricDomain(metricValues, metricMode);
  const baselineValue = 1;
  const padding = computeDamagePlotChartPadding({
    categoryLabels: spec.xCategories,
    hasTopControls: false,
  });
  const labelFontSize = axisLabelFontSize(spec.xCategories.length);
  const zeroY = domainValueToPlotY(baselineValue, minDomain, maxDomain, padding);
  const metricLabel = getDeltaMetricLabel(metricMode);
  const axisTickFormat = metricMode;
  const axisTicks = [minDomain, baselineValue, maxDomain];

  return (
    <PlotCardShell
      title={spec.title}
      subtitle={spec.subtitle}
      isLoading={isLoading}
      error={error}
      isEmpty={isEmpty}
      emptyTitle={spec.emptyState?.title ?? 'No target delta data'}
      emptyDescription={spec.emptyState?.description}
      className={cn(className ?? PLOT_CARD_BASE_CLASS)}
    >
      <div className={DAMAGE_PLOT_CHART_REGION_CLASS}>
        <svg
          viewBox={`0 0 ${DAMAGE_PLOT_VIEWBOX.width} ${DAMAGE_PLOT_VIEWBOX.height}`}
          preserveAspectRatio="xMidYMid meet"
          className="h-full max-h-full w-full max-w-full"
          role="img"
          aria-label="Target delta versus reference diverging bar chart"
          data-delta-axis-format={axisTickFormat}
        >
          <rect
            x={0}
            y={0}
            width={DAMAGE_PLOT_VIEWBOX.width}
            height={DAMAGE_PLOT_VIEWBOX.height}
            fill={DAMAGE_PLOT_SVG_COLORS.background}
          />
          {axisTicks.map((tick, tickIndex) => {
            const y = domainValueToPlotY(tick, minDomain, maxDomain, padding);
            return (
              <line
                key={`grid-${tickIndex}-${tick}`}
                x1={padding.left}
                x2={DAMAGE_PLOT_VIEWBOX.width - padding.right}
                y1={y}
                y2={y}
                stroke={DAMAGE_PLOT_SVG_COLORS.grid}
                strokeWidth={1}
              />
            );
          })}
          <line
            x1={padding.left}
            x2={DAMAGE_PLOT_VIEWBOX.width - padding.right}
            y1={zeroY}
            y2={zeroY}
            stroke={DAMAGE_PLOT_SVG_COLORS.centerLine}
            strokeWidth={1}
            data-delta-zero-baseline="true"
          />
          <text
            x={padding.left - 4}
            y={padding.top + 2}
            textAnchor="end"
            fontSize={8}
            fill={DAMAGE_PLOT_SVG_COLORS.axisText}
          >
            {formatRatioValue(maxDomain)}
          </text>
          <text
            x={padding.left - 4}
            y={DAMAGE_PLOT_VIEWBOX.height - padding.bottom}
            textAnchor="end"
            fontSize={8}
            fill={DAMAGE_PLOT_SVG_COLORS.axisText}
          >
            {formatRatioValue(minDomain)}
          </text>
          <text
            x={padding.left - 4}
            y={zeroY - 2}
            textAnchor="end"
            fontSize={8}
            fill={DAMAGE_PLOT_SVG_COLORS.axisText}
            data-delta-metric-label={metricMode}
          >
            {metricLabel}
          </text>

          {spec.xCategories.map((channel, categoryIndex) => {
            const bandWidth = categoryBandWidth(spec.xCategories.length, padding);
            const barWidth = Math.max(6, bandWidth * 0.58);
            const x = padding.left + categoryIndex * bandWidth + (bandWidth - barWidth) / 2;
            const labelAnchorY = DAMAGE_PLOT_VIEWBOX.height - padding.bottom + 2;
            const metricRow = metricRows[categoryIndex];
            const value = metricRow?.metricUnavailable ? baselineValue : (metricRow?.metricValue ?? 0);
            const valueY = domainValueToPlotY(value, minDomain, maxDomain, padding);
            const y = Math.min(valueY, zeroY);
            const height = Math.max(1, Math.abs(valueY - zeroY));
            const hoverText = buildBarHoverText({
              row:
                metricRow ?? {
                  channel,
                  referenceDamage: 0,
                  targetDamage: 0,
                  signedDelta: value,
                  valueModeLabel: 'absolute',
                  lowReference: false,
                  metricValue: value,
                  metricUnavailable: false,
                },
            });

            return (
              <g key={channel}>
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={height}
                  fill={metricRow?.metricUnavailable ? '#9ca3af' : (deltaSeries?.color ?? '#7c3aed')}
                  opacity={metricRow?.metricUnavailable ? 0.7 : 0.92}
                  rx={2}
                  role="img"
                  aria-label={
                    metricRow?.metricUnavailable
                      ? `${metricLabel} for ${channel}: unavailable`
                      : `${metricLabel} for ${channel}: ${formatRatioValue(value)}`
                  }
                  data-delta-bar-id={`${deltaSeries?.id ?? 'target_delta'}-${categoryIndex}`}
                >
                  <title>{hoverText}</title>
                </rect>
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

        <div className="pointer-events-none absolute bottom-8 right-1 max-w-[58%] rounded-md bg-white/85 px-1.5 py-0.5 ring-1 ring-gray-200/70 backdrop-blur-sm">
          <ul className="flex flex-wrap items-center justify-end gap-x-2 gap-y-0.5">
            {spec.legend.map((legendItem) => (
              <li key={legendItem.role} className="flex items-center gap-1 text-[9px] text-gray-700">
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: legendItem.color }}
                  aria-hidden="true"
                />
                <span className="truncate">{metricLabel}</span>
              </li>
            ))}
          </ul>
        </div>

        {spec.warnings[0] ? (
          <p className="pointer-events-none absolute left-1 top-7 max-w-[70%] truncate rounded-md bg-amber-100/90 px-1.5 py-0.5 text-[9px] text-amber-800 shadow-sm">
            {spec.warnings[0]}
          </p>
        ) : null}
      </div>
    </PlotCardShell>
  );
}
