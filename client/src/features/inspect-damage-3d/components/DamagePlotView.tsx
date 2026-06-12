'use client';

import dynamic from 'next/dynamic';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { DamageComparisonViewModel } from '@/features/inspect-damage/lib/build-damage-comparison-view-model';
import type { DamageComparisonState } from '@/types/damage-comparison';
import { DAMAGE_CHANNELS } from '../lib/damage-channel-axis';
import { buildComparisonDamagePlotCells } from '../lib/build-comparison-damage-plot-cells';
import { computeDamagePlotLayout } from '../lib/damage-plot-layout';
import type {
  DamagePlotScaleMode,
  DamagePlotType,
} from '../lib/damage-plot-overlay-types';
import { DamagePlotColorLegend } from './DamagePlotColorLegend';
import { DamagePlotOverlayControls } from './DamagePlotOverlayControls';

const MAX_RENDERED_CELLS = 300;

type DamagePlotDisplayState = {
  plotType: DamagePlotType;
  version: string | undefined;
  damageScaleMode: DamagePlotScaleMode;
};

const DamagePlotCanvas = dynamic(() => import('./DamagePlotCanvas.client'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      Loading 3D canvas...
    </div>
  ),
});

type DamagePlotViewProps = {
  comparison: DamageComparisonState;
  comparisonViewModel: DamageComparisonViewModel;
  onUpdateComparison: (patch: Partial<DamageComparisonState>) => void;
  className?: string;
};

export function DamagePlotView({
  comparison,
  comparisonViewModel,
  onUpdateComparison,
  className,
}: DamagePlotViewProps) {
  const [displayState, setDisplayState] = useState<DamagePlotDisplayState>(() => ({
    plotType: 'cumulative_by_channel',
    version: undefined,
    damageScaleMode: 'linear',
  }));

  const plotData = useMemo(
    () =>
      buildComparisonDamagePlotCells({
        viewModel: comparisonViewModel,
        plotType: displayState.plotType,
        selectedChannelKeys: comparison.selected_channel_keys,
        version: displayState.version,
        channels: DAMAGE_CHANNELS,
      }),
    [
      comparison.selected_channel_keys,
      comparisonViewModel,
      displayState.plotType,
      displayState.version,
    ],
  );
  const { cells, channels, versions, effectiveVersion, emptyMessage } = plotData;
  const renderedCells = cells.slice(0, MAX_RENDERED_CELLS);
  const isCapped = cells.length > renderedCells.length;
  const displayCells = useMemo(
    () =>
      displayState.damageScaleMode === 'log'
        ? renderedCells.map((cell) => ({
            ...cell,
            damage: Math.log10(1 + cell.damage),
          }))
        : renderedCells,
    [displayState.damageScaleMode, renderedCells],
  );
  const layout = useMemo(
    () => computeDamagePlotLayout(displayCells, channels),
    [channels, displayCells],
  );

  const handleChannelToggle = useCallback((channelKey: string) => {
    const isSelected = comparison.selected_channel_keys.includes(channelKey);
    if (isSelected && comparison.selected_channel_keys.length <= 1) {
      toast.error('At least one channel must be selected');
      return;
    }
    const selected_channel_keys = isSelected
      ? comparison.selected_channel_keys.filter((key) => key !== channelKey)
      : [...comparison.selected_channel_keys, channelKey];
    onUpdateComparison({ selected_channel_keys });
  }, [comparison.selected_channel_keys, onUpdateComparison]);

  const overlayControls = (
    <DamagePlotOverlayControls
      state={{
        plotType: displayState.plotType,
        valueMode: comparison.value_mode,
        selectedChannelKeys: comparison.selected_channel_keys,
        version: effectiveVersion,
        damageScaleMode: displayState.damageScaleMode,
      }}
      versions={versions}
      referenceEventCount={comparisonViewModel.selectionSummary.referenceEventCount}
      targetEventCount={comparisonViewModel.selectionSummary.targetEventCount}
      isCapped={isCapped}
      cappedTotal={cells.length}
      cappedShown={renderedCells.length}
      onPlotTypeChange={(plotType) => setDisplayState((current) => ({ ...current, plotType }))}
      onValueModeChange={(value_mode) => onUpdateComparison({ value_mode })}
      onChannelToggle={handleChannelToggle}
      onVersionChange={(version) => setDisplayState((current) => ({ ...current, version }))}
      onDamageScaleModeChange={(damageScaleMode) =>
        setDisplayState((current) => ({ ...current, damageScaleMode }))
      }
    />
  );

  const legendScaleLabel =
    comparison.value_mode === 'normalized'
      ? displayState.damageScaleMode === 'log'
        ? 'Normalized log damage'
        : 'Normalized damage'
      : displayState.damageScaleMode === 'log'
        ? 'Log damage (log10(1 + x))'
        : 'Damage';

  const mainContent =
    renderedCells.length > 0 ? (
      <div className="absolute inset-0 pl-60">
        <DamagePlotCanvas layout={layout} />
      </div>
    ) : (
      <div className="flex h-full items-center justify-center p-6 pl-60 text-center text-sm text-muted-foreground">
        {comparisonViewModel.emptyState ? (
          <div>
            <h3 className="text-sm font-medium text-foreground">
              {comparisonViewModel.emptyState.title}
            </h3>
            <p className="mt-2 text-xs text-muted-foreground">
              {comparisonViewModel.emptyState.description}
            </p>
          </div>
        ) : (
          emptyMessage
        )}
      </div>
    );

  return (
    <div className={cn('flex h-full min-h-0 flex-1 flex-col p-4', className)}>
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-md border bg-card">
        {mainContent}

        {overlayControls}

        {renderedCells.length > 0 ? (
          <div className="pointer-events-none absolute right-3 top-3 z-10 p-2">
            <DamagePlotColorLegend
              minDamage={layout.minDamage}
              maxDamage={layout.maxDamage}
              scaleLabel={legendScaleLabel}
            />
            <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
              {displayState.damageScaleMode === 'log' ? 'Log damage range' : 'Damage range'}:{' '}
              {layout.minDamage.toExponential(2)} to {layout.maxDamage.toExponential(2)}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
