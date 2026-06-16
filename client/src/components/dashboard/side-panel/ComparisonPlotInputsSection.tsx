'use client';

import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DAMAGE_CHANNELS } from '@/features/inspect-damage-3d/lib/damage-channel-axis';
import type { DamageComparisonValueMode } from '@/types/damage-comparison';

type ComparisonPlotInputsSectionProps = {
  selectedChannelKeys: string[];
  valueMode: DamageComparisonValueMode;
  eventThreshold: number;
  onChannelToggle: (channelKey: string) => void;
  onValueModeChange: (valueMode: DamageComparisonValueMode) => void;
  onEventThresholdChange: (eventThreshold: number) => void;
};

export function ComparisonPlotInputsSection({
  selectedChannelKeys,
  valueMode,
  eventThreshold,
  onChannelToggle,
  onValueModeChange,
  onEventThresholdChange,
}: ComparisonPlotInputsSectionProps) {
  const selectedChannelSet = useMemo(
    () => new Set(selectedChannelKeys),
    [selectedChannelKeys],
  );

  return (
    <section className="space-y-3" aria-label="Plot Inputs">
      <div className="space-y-1">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-foreground/75">
          Plot Inputs
        </h3>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">Channels</span>
          <span className="text-[10px] text-muted-foreground">
            {selectedChannelKeys.length}/{DAMAGE_CHANNELS.length}
          </span>
        </div>
        <div className="flex flex-wrap gap-1">
          {DAMAGE_CHANNELS.map((channel) => {
            const selected = selectedChannelSet.has(channel.key);
            return (
              <Button
                key={channel.key}
                type="button"
                size="sm"
                variant={selected ? 'secondary' : 'outline'}
                className={cn(
                  'h-6 gap-1 px-2 text-[10px]',
                  !selected &&
                    'border-dashed border-muted-foreground/40 bg-transparent text-muted-foreground/90 opacity-80 line-through decoration-muted-foreground/70 decoration-1',
                )}
                onClick={() => onChannelToggle(channel.key)}
                aria-pressed={selected}
                aria-label={
                  selected
                    ? `Channel ${channel.shortLabel} enabled`
                    : `Channel ${channel.shortLabel} disabled`
                }
                data-channel-enabled={selected ? 'true' : 'false'}
              >
                {channel.shortLabel}
              </Button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">Value mode</span>
        <div className="inline-flex w-full items-center rounded-md border p-0.5">
          <Button
            type="button"
            size="sm"
            variant={valueMode === 'absolute' ? 'secondary' : 'ghost'}
            className={cn('h-6 flex-1 px-2 text-[11px]')}
            onClick={() => onValueModeChange('absolute')}
          >
            Absolute
          </Button>
          <Button
            type="button"
            size="sm"
            variant={valueMode === 'normalized' ? 'secondary' : 'ghost'}
            className={cn('h-6 flex-1 px-2 text-[11px]')}
            onClick={() => onValueModeChange('normalized')}
          >
            Normalized
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-foreground/75">
            Threshold Events
          </h3>
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {eventThreshold}
          </span>
        </div>
        <input
          type="range"
          min={1}
          max={5}
          step={1}
          value={eventThreshold}
          onChange={(event) => onEventThresholdChange(Number(event.currentTarget.value))}
          className="w-full accent-primary"
          aria-label="Threshold Events"
        />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>1</span>
          <span>5</span>
        </div>
      </div>
    </section>
  );
}
