'use client';

import { cn } from '@/lib/utils';
import {
  PLOT_LEGEND_OVERLAY_CONTAINER_CLASS,
  PLOT_LEGEND_OVERLAY_ITEM_CLASS,
  PLOT_LEGEND_OVERLAY_LIST_CLASS,
  PLOT_LEGEND_OVERLAY_PANEL_CLASS,
  PLOT_LEGEND_OVERLAY_SWATCH_CLASS,
} from './plot-card-styles';

export type PlotLegendOverlayItem = {
  id: string;
  label: string;
  color: string;
};

type PlotLegendOverlayProps = {
  items: readonly PlotLegendOverlayItem[];
  className?: string;
};

export function PlotLegendOverlay({ items, className }: PlotLegendOverlayProps) {
  if (items.length === 0) return null;

  return (
    <div className={cn(PLOT_LEGEND_OVERLAY_CONTAINER_CLASS, className)} data-plot-legend-overlay="true">
      <div className={PLOT_LEGEND_OVERLAY_PANEL_CLASS}>
        <ul className={PLOT_LEGEND_OVERLAY_LIST_CLASS}>
          {items.map((item) => (
            <li key={item.id} className={PLOT_LEGEND_OVERLAY_ITEM_CLASS}>
              <span
                className={PLOT_LEGEND_OVERLAY_SWATCH_CLASS}
                style={{ backgroundColor: item.color }}
                aria-hidden="true"
              />
              <span className="max-w-28 truncate" title={item.label}>
                {item.label}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
