'use client';

import { memo } from 'react';
import { Button } from '@/components/ui/button';
import { Link, Unlink } from 'lucide-react';
import { SVGPlot } from './SVGPlot';
import { PlotCardShell } from './PlotCardShell';
import { PLOT_CARD_BASE_CLASS } from './plot-card-styles';
import { usePlotSettingsStore } from '@/stores/plot-settings-store';
import { useRenderStore } from '@/stores/render-store';
import { cn } from '@/lib/utils';
import type { Curve, PlotConfig, ColorConfig, AxisLimits } from './types';

interface SVGPlotCardProps {
  plotKey: string;
  title: string;
  curves: Curve[];
  config: PlotConfig;
  colorConfig: ColorConfig;
  isLoading?: boolean;
  error?: string | null;
  onClick?: () => void;
  actionButtons?: React.ReactNode;
  /** Global axis limits (used when synced) */
  globalAxisLimits?: AxisLimits | null;
  /** Local axis limits for this specific plot (used when unsynced) */
  localAxisLimits?: AxisLimits;
}

/**
 * Card wrapper for SVG plots.
 * 
 * Single Responsibility: Handles card chrome (title, loading, error states).
 * Delegates actual rendering to SVGPlot.
 */
export const SVGPlotCard = memo(function SVGPlotCard({
  plotKey,
  title,
  curves,
  config,
  colorConfig,
  isLoading = false,
  error = null,
  onClick,
  actionButtons,
  globalAxisLimits,
  localAxisLimits,
}: SVGPlotCardProps) {
  const synced = usePlotSettingsStore((s) => s.syncState[plotKey] ?? true);
  const toggleSync = usePlotSettingsStore((s) => s.toggleSync);
  const isRendering = useRenderStore((s) => s.isRendering);
  const interactiveCardClass = cn(
    PLOT_CARD_BASE_CLASS,
    'group cursor-pointer',
    isRendering
      ? 'transition-colors duration-150'
      : 'hover:shadow-md hover:border-primary/25 transition-all duration-200'
  );

  // Determine which axis limits to use based on sync state
  const axisLimits = synced && globalAxisLimits ? globalAxisLimits : localAxisLimits;

  // Loading state
  if (isLoading) {
    return (
      <PlotCardShell
        title={title}
        isLoading
        className={PLOT_CARD_BASE_CLASS}
      />
    );
  }

  // Error state
  if (error) {
    return (
      <PlotCardShell
        title={title}
        error={error}
        className={cn(PLOT_CARD_BASE_CLASS, 'border-destructive/20')}
      />
    );
  }

  // Empty state - show plot with empty axes
  if (curves.length === 0) {
    return (
      <PlotCardShell
        title={title}
        className={interactiveCardClass}
        onClick={onClick}
      >
        <div className="absolute inset-0">
          <SVGPlot
            curves={[]}
            config={config}
            colorConfig={colorConfig}
            renderMode="grid"
          />
        </div>
      </PlotCardShell>
    );
  }

  // Normal render
  return (
    <PlotCardShell
      title={title}
      className={interactiveCardClass}
      onClick={onClick}
      labelPrefix={
        !synced ? (
          <div
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
            title="Axes unsynced from global"
          />
        ) : undefined
      }
      actionSlot={
        <>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'h-5 w-5 rounded-md hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity duration-150',
              synced ? 'text-primary' : 'text-muted-foreground',
            )}
            onClick={(e) => {
              e.stopPropagation();
              toggleSync(plotKey);
            }}
            title={synced ? 'Synced axes (click to unsync)' : 'Unsynced axes (click to sync)'}
          >
            {synced ? <Link className="h-3 w-3" /> : <Unlink className="h-3 w-3" />}
          </Button>
          <div className="opacity-0 transition-opacity duration-150 group-hover:opacity-100">
            {actionButtons}
          </div>
        </>
      }
    >
      <div className="absolute inset-0">
        <SVGPlot
          curves={curves}
          config={config}
          colorConfig={colorConfig}
          renderMode="grid"
          axisLimits={axisLimits}
        />
      </div>
    </PlotCardShell>
  );
});
