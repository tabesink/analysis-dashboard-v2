'use client';

import { useMemo, useState } from 'react';
import { Columns2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ComparisonPlotInputsSection } from '@/components/dashboard/side-panel/ComparisonPlotInputsSection';
import { cn } from '@/lib/utils';
import type { DamageComparisonViewModel } from '@/features/inspect-damage/lib/build-damage-comparison-view-model';
import type { DamageComparisonState } from '@/types/damage-comparison';
import { buildDamage2DPlotSpec, computeSharedAbsoluteDamageYDomain } from '../lib/build-damage-2d-plot-spec';
import { DAMAGE_PLOT_TYPE_OPTIONS, type DamagePlotType } from '../lib/damage-plot-overlay-types';
import { DAMAGE_PLOT_2D_GRID_CLASS } from '@/components/charts/plot-card-styles';
import { Damage2DPlotCard } from './Damage2DPlotCard';

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
  const [eventThreshold, setEventThreshold] = useState(5);

  const handleChannelToggle = (channelKey: string) => {
    const isSelected = comparison.selected_channel_keys.includes(channelKey);
    if (isSelected && comparison.selected_channel_keys.length <= 1) {
      toast.error('At least one channel must be selected');
      return;
    }
    const selected_channel_keys = isSelected
      ? comparison.selected_channel_keys.filter((key) => key !== channelKey)
      : [...comparison.selected_channel_keys, channelKey];
    onUpdateComparison({ selected_channel_keys });
  };

  const plotSpecsByType = useMemo(() => {
    const specInputBase = {
      aggregates: comparisonViewModel.aggregates,
      selectedChannelKeys: comparison.selected_channel_keys,
      valueMode: comparison.value_mode,
      scaleMode: 'linear' as const,
      referenceEventIds: comparison.reference.selected_event_ids,
      targetEventIds: comparison.target.selected_event_ids,
      selectedEventIds: [] as string[],
      eventThreshold,
    };
    const sharedYDomain = computeSharedAbsoluteDamageYDomain(specInputBase);
    const sharedDomainPlotTypes = new Set<DamagePlotType>([
      'cumulative_by_channel',
      'reference_absolute_by_event',
      'target_absolute_by_event',
    ]);

    const specs = new Map<DamagePlotType, ReturnType<typeof buildDamage2DPlotSpec>>();
    for (const option of DAMAGE_PLOT_TYPE_OPTIONS) {
      specs.set(
        option.value,
        buildDamage2DPlotSpec({
          ...specInputBase,
          plotType: option.value,
          sharedYDomain: sharedDomainPlotTypes.has(option.value) ? sharedYDomain : undefined,
        }),
      );
    }
    return specs;
  }, [
    comparison.reference.selected_event_ids,
    comparison.selected_channel_keys,
    comparison.target.selected_event_ids,
    comparison.value_mode,
    comparisonViewModel.aggregates,
    eventThreshold,
  ]);

  return (
    <div className={cn('flex h-full min-h-0 flex-1 flex-col', className)}>
      <div className="shrink-0 flex items-center justify-between border-b px-4 py-3">
        <p className="text-sm font-medium">Damage Plots</p>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="min-w-[5.75rem] justify-center"
              aria-label="Customize plots"
            >
              <Columns2 className="size-4" />
              Customize
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-3" align="end">
            <ComparisonPlotInputsSection
              selectedChannelKeys={comparison.selected_channel_keys}
              valueMode={comparison.value_mode}
              eventThreshold={eventThreshold}
              onChannelToggle={handleChannelToggle}
              onValueModeChange={(value_mode) => onUpdateComparison({ value_mode })}
              onEventThresholdChange={setEventThreshold}
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3">
        <div className={DAMAGE_PLOT_2D_GRID_CLASS}>
          {DAMAGE_PLOT_TYPE_OPTIONS.map((option) => {
            const spec = plotSpecsByType.get(option.value);
            if (!spec) return null;

            return (
              <Damage2DPlotCard
                key={option.value}
                plotType={option.value}
                title={option.label}
                spec={spec}
                isFocused={false}
                onSelect={() => {}}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
