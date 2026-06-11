export const FIXED_CHANNEL_MAP_PLOTS = [
  'bj_xy_force_plot',
  'bj_xz_force_plot',
  'shock_xy_force_plot',
  'shock_xz_force_plot',
  'bushing_f_xy_force_plot',
  'bushing_f_xz_force_plot',
  'bushing_r_xy_force_plot',
  'bushing_r_xz_force_plot',
] as const;

export type ChannelMapPlotKey = (typeof FIXED_CHANNEL_MAP_PLOTS)[number];

export type ChannelMapDraft = Record<string, { x_col: string; y_col: string }>;

export const DEFAULT_CHANNEL_MAP_DRAFT: ChannelMapDraft = Object.fromEntries(
  FIXED_CHANNEL_MAP_PLOTS.map((plotKey) => [plotKey, { x_col: '', y_col: '' }]),
);

export const CHANNEL_MAP_DATA_ROW_COUNT = 8;
export const CHANNEL_MAP_PADDING_ROW_COUNT =
  CHANNEL_MAP_DATA_ROW_COUNT - FIXED_CHANNEL_MAP_PLOTS.length;
export const CHANNEL_MAP_PREVIEW_FALLBACK_COLUMN_COUNT = 26;
/** Tailwind grid template: plot title column + x/y index inputs */
export const CHANNEL_MAP_PLOT_TABLE_GRID_COLS =
  'grid-cols-[minmax(10rem,auto)_44px_44px]';
