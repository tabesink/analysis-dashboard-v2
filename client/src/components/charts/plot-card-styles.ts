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

/** Right-side overlay container for damage-plot legends. */
export const PLOT_LEGEND_OVERLAY_CONTAINER_CLASS =
  'pointer-events-none absolute right-1 top-1 bottom-8 z-10 max-w-[45%]';

/** Legend panel for damage plots (transparent, no border). */
export const PLOT_LEGEND_OVERLAY_PANEL_CLASS = 'h-full overflow-hidden bg-transparent px-1 py-0.5';

/** Vertical legend list, top-to-bottom, scrollable when dense. */
export const PLOT_LEGEND_OVERLAY_LIST_CLASS = 'flex max-h-full flex-col items-start gap-1 overflow-y-auto';

/** Larger legend row text for readability in dense cards. */
export const PLOT_LEGEND_OVERLAY_ITEM_CLASS = 'flex items-center gap-1.5 text-xs text-gray-700';

/** Legend color swatch. */
export const PLOT_LEGEND_OVERLAY_SWATCH_CLASS = 'inline-block h-2 w-2 shrink-0 rounded-full';
