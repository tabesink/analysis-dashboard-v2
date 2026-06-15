export const DAMAGE_PLOT_TYPE_OPTIONS = [
  { value: 'cumulative_by_channel', label: 'Cumulative by channel' },
  { value: 'target_delta_vs_reference', label: 'Target Δ vs Reference by channel' },
  { value: 'reference_absolute_by_event', label: 'Reference absolute damage by event' },
  { value: 'target_absolute_by_event', label: 'Target absolute damage by event' },
] as const;

export type DamagePlotType = (typeof DAMAGE_PLOT_TYPE_OPTIONS)[number]['value'];

export type DamagePlotValueMode = 'absolute' | 'normalized';

export type DamagePlotScaleMode = 'linear' | 'log';

export type DamagePlotOverlayState = {
  plotType: DamagePlotType;
  valueMode: DamagePlotValueMode;
  selectedChannelKeys: string[];
  version: string | undefined;
  damageScaleMode: DamagePlotScaleMode;
};
