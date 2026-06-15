'use client';

import { PlotCardShell } from '@/components/charts/PlotCardShell';
import {
  DAMAGE_PLOT_2D_CARD_CLASS,
  PLOT_CARD_BASE_CLASS,
} from '@/components/charts/plot-card-styles';
import { cn } from '@/lib/utils';
import type { Damage2DPlotSpec } from '../lib/build-damage-2d-plot-spec';
import type { DamagePlotType } from '../lib/damage-plot-overlay-types';
import { AbsoluteByEventPlotCard } from './AbsoluteByEventPlotCard';
import { CumulativeByChannelPlotCard } from './CumulativeByChannelPlotCard';
import { TargetDeltaVsReferencePlotCard } from './TargetDeltaVsReferencePlotCard';

type Damage2DPlotCardProps = {
  plotType: DamagePlotType;
  title: string;
  spec: Damage2DPlotSpec;
  isFocused: boolean;
  onSelect: () => void;
  className?: string;
};

export function Damage2DPlotCard({
  plotType,
  title,
  spec,
  isFocused,
  onSelect,
  className,
}: Damage2DPlotCardProps) {
  const cardClassName = cn(
    'cursor-pointer transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-background',
    isFocused && 'ring-2 ring-primary ring-offset-1 ring-offset-background',
    className,
  );

  const cardMetadata = {
    'data-testid': 'damage-2d-plot-card',
    'data-plot-type': plotType,
    'data-focused': isFocused ? 'true' : 'false',
    'aria-label': `Focus ${title} 2D plot`,
  };

  const cardWrapperClassName = cn('h-full min-h-0', cardClassName);

  if (plotType === 'cumulative_by_channel') {
    return (
      <div
        {...cardMetadata}
        className={cardWrapperClassName}
        onClick={onSelect}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelect();
          }
        }}
        role="button"
        tabIndex={0}
        aria-pressed={isFocused}
      >
        <CumulativeByChannelPlotCard
          spec={spec}
          className={DAMAGE_PLOT_2D_CARD_CLASS}
        />
      </div>
    );
  }

  if (plotType === 'reference_absolute_by_event' || plotType === 'target_absolute_by_event') {
    return (
      <div
        {...cardMetadata}
        className={cardWrapperClassName}
        onClick={onSelect}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelect();
          }
        }}
        role="button"
        tabIndex={0}
        aria-pressed={isFocused}
      >
        <AbsoluteByEventPlotCard
          spec={spec}
          className={DAMAGE_PLOT_2D_CARD_CLASS}
        />
      </div>
    );
  }

  if (plotType === 'target_delta_vs_reference') {
    return (
      <div
        {...cardMetadata}
        className={cardWrapperClassName}
        onClick={onSelect}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelect();
          }
        }}
        role="button"
        tabIndex={0}
        aria-pressed={isFocused}
      >
        <TargetDeltaVsReferencePlotCard
          spec={spec}
          className={DAMAGE_PLOT_2D_CARD_CLASS}
        />
      </div>
    );
  }

  return (
    <div {...cardMetadata} onClick={onSelect} role="button" tabIndex={0} aria-pressed={isFocused}>
      <PlotCardShell
        title={title}
        subtitle={spec.subtitle}
        isEmpty={Boolean(spec.emptyState)}
        emptyTitle={spec.emptyState?.title ?? 'Plot type coming soon'}
        emptyDescription={spec.emptyState?.description}
        className={cn(PLOT_CARD_BASE_CLASS, cardClassName)}
      />
    </div>
  );
}
