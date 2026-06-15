/** Shared plot card shell classes — matches Dashboard SVGPlotCard grid cards. */
export const PLOT_CARD_BASE_CLASS =
  'relative aspect-4/3 overflow-hidden rounded-lg border border-border/50 bg-card shadow-sm';

/** Gap between plot cards in grid layouts. */
export const PLOT_GRID_GAP_CLASS = 'gap-3';

/** Default dashboard grid column class (see DEFAULT_GRID_COLUMNS = 3). */
export const PLOT_GRID_COLUMNS_CLASS = 'grid-cols-3';

/** Grid wrapper for damage comparison 2D cards — two rows × two columns, fills viewport. */
export const DAMAGE_PLOT_2D_GRID_CLASS = `grid h-full min-h-0 flex-1 grid-cols-2 grid-rows-2 ${PLOT_GRID_GAP_CLASS}`;

/** Card shell for damage 2D plots — height follows grid cell, no fixed aspect ratio. */
export const DAMAGE_PLOT_2D_CARD_CLASS =
  'relative h-full min-h-0 w-full gap-0 overflow-hidden rounded-lg border border-border/60 bg-card py-0 shadow-sm transition-shadow hover:shadow-md';

/** Inner region for damage plot SVGs — centers charts inside compact grid cards. */
export const DAMAGE_PLOT_CHART_REGION_CLASS =
  'absolute inset-x-2 top-2 bottom-8 flex items-center justify-center overflow-hidden rounded-md';
