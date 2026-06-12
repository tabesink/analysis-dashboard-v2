export const DAMAGE_PLOT_TYPE_OPTIONS = [
  { value: 'cumulative_by_program_version', label: 'Cumulative by program/version' },
  { value: 'absolute_by_event', label: 'Absolute by event' },
  { value: 'cumulative_by_channel', label: 'Cumulative by channel' },
  { value: 'target_delta_vs_reference', label: 'Target Δ vs Reference by channel' },
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
