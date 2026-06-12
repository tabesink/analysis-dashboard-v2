'use client';

import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { DAMAGE_CHANNELS } from '../lib/damage-channel-axis';
import {
  DAMAGE_PLOT_TYPE_OPTIONS,
  type DamagePlotOverlayState,
  type DamagePlotScaleMode,
  type DamagePlotType,
  type DamagePlotValueMode,
} from '../lib/damage-plot-overlay-types';

type DamagePlotOverlayControlsProps = {
  state: DamagePlotOverlayState;
  versions: string[];
  referenceEventCount: number;
  targetEventCount: number;
  isCapped?: boolean;
  cappedTotal?: number;
  cappedShown?: number;
  onPlotTypeChange: (plotType: DamagePlotType) => void;
  onValueModeChange: (valueMode: DamagePlotValueMode) => void;
  onChannelToggle: (channelKey: string) => void;
  onVersionChange: (version: string) => void;
  onDamageScaleModeChange: (mode: DamagePlotScaleMode) => void;
  className?: string;
};

function SegmentedToggle<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div className="space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="inline-flex w-full items-center rounded-md border p-0.5">
        {options.map((option) => (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant={value === option.value ? 'secondary' : 'ghost'}
            className="h-6 flex-1 px-2 text-[11px]"
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

export function DamagePlotOverlayControls({
  state,
  versions,
  referenceEventCount,
  targetEventCount,
  isCapped = false,
  cappedTotal = 0,
  cappedShown = 0,
  onPlotTypeChange,
  onValueModeChange,
  onChannelToggle,
  onVersionChange,
  onDamageScaleModeChange,
  className,
}: DamagePlotOverlayControlsProps) {
  const selectedChannelSet = useMemo(
    () => new Set(state.selectedChannelKeys),
    [state.selectedChannelKeys],
  );
  const effectiveVersion =
    state.version && versions.includes(state.version) ? state.version : versions[0];

  return (
    <div
      className={cn(
        'absolute inset-y-0 left-0 z-10 flex w-60 flex-col bg-muted/40 p-3',
        className,
      )}
    >
      <div className="flex min-h-0 flex-1 flex-col space-y-3">
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Plot type</span>
          <div role="radiogroup" aria-label="Plot type" className="flex flex-col gap-0.5">
            {DAMAGE_PLOT_TYPE_OPTIONS.map((option) => {
              const selected = state.plotType === option.value;
              return (
                <label
                  key={option.value}
                  role="radio"
                  aria-checked={selected}
                  className={cn(
                    'flex cursor-pointer items-start gap-2 rounded-md px-1.5 py-1.5 transition-colors hover:bg-muted/50',
                    selected && 'bg-muted/60',
                  )}
                  onClick={() => onPlotTypeChange(option.value)}
                >
                  <Checkbox
                    checked={selected}
                    tabIndex={-1}
                    className="pointer-events-none mt-0.5 size-3.5 rounded-[3px] border-border/70 bg-background data-[state=checked]:bg-primary/90 data-[state=checked]:border-primary/90 [&_svg]:size-3"
                    aria-hidden
                  />
                  <span className="text-[11px] leading-snug">{option.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        <SegmentedToggle
          label="Value mode"
          value={state.valueMode}
          onChange={onValueModeChange}
          options={[
            { value: 'absolute', label: 'Absolute' },
            { value: 'normalized', label: 'Normalized' },
          ]}
        />

        <div className="flex min-h-0 flex-1 flex-col space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">Channels</span>
            <span className="text-[10px] text-muted-foreground">
              {state.selectedChannelKeys.length}/{DAMAGE_CHANNELS.length}
            </span>
          </div>
          <div className="flex min-h-0 flex-1 flex-wrap content-start gap-1 overflow-y-auto">
            {DAMAGE_CHANNELS.map((channel) => {
              const selected = selectedChannelSet.has(channel.key);
              return (
                <Button
                  key={channel.key}
                  type="button"
                  size="sm"
                  variant={selected ? 'secondary' : 'outline'}
                  className="h-6 px-2 text-[10px]"
                  onClick={() => onChannelToggle(channel.key)}
                  aria-pressed={selected}
                >
                  {channel.shortLabel}
                </Button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Version slice</label>
          <Select
            value={effectiveVersion ?? ''}
            onValueChange={onVersionChange}
            disabled={versions.length === 0}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select version" />
            </SelectTrigger>
            <SelectContent>
              {versions.map((version) => (
                <SelectItem key={version} value={version} className="text-xs">
                  {version}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <SegmentedToggle
          label="Damage scale"
          value={state.damageScaleMode}
          onChange={onDamageScaleModeChange}
          options={[
            { value: 'linear', label: 'Normal' },
            { value: 'log', label: 'Log' },
          ]}
        />

        {isCapped ? (
          <p className="text-xs text-amber-700">
            Showing {cappedShown} of {cappedTotal} cells. Narrow the selection for this MVP.
          </p>
        ) : null}

        <p className="mt-auto pt-1 text-[10px] text-muted-foreground">
          Ref: {referenceEventCount} evt · Tgt: {targetEventCount} evt
        </p>
      </div>
    </div>
  );
}
