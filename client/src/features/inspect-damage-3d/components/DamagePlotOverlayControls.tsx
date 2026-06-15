'use client';

import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  DAMAGE_PLOT_TYPE_OPTIONS,
  type DamagePlotOverlayState,
  type DamagePlotType,
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
  onVersionChange: (version: string) => void;
  className?: string;
};

export function DamagePlotOverlayControls({
  state,
  versions,
  referenceEventCount,
  targetEventCount,
  isCapped = false,
  cappedTotal = 0,
  cappedShown = 0,
  onPlotTypeChange,
  onVersionChange,
  className,
}: DamagePlotOverlayControlsProps) {
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
