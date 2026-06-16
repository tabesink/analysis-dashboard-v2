import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Damage2DPlotSpec } from '../lib/build-damage-2d-plot-spec';
import { AbsoluteByEventPlotCard } from './AbsoluteByEventPlotCard';

function buildSpec(overrides?: Partial<Damage2DPlotSpec>): Damage2DPlotSpec {
  return {
    plotType: 'reference_absolute_by_event',
    chartKind: 'stacked-bar',
    title: 'Damage by Event (Reference)',
    subtitle: '',
    xCategories: ['BJ X Force', 'BJ Y Force'],
    yScale: {
      mode: 'linear',
      domain: [0, 18],
      tickFormat: 'linear',
    },
    series: [
      { id: 'reference_event-0', label: 'mf4e3_100', color: '#2563eb', values: [7, 3], percentages: [58.3, 60] },
      { id: 'reference_event-1', label: 'mf4e3_101', color: '#60a5fa', values: [5, 2], percentages: [41.7, 40] },
      { id: 'reference_event-2', label: 'mf4e3_102', color: '#93c5fd', values: [2, 1], percentages: [16.7, 20] },
      { id: 'reference_event-3', label: 'mf4e3_103', color: '#1d4ed8', values: [1, 1], percentages: [8.3, 20] },
      { id: 'reference_event-4', label: 'mf4e3_104', color: '#38bdf8', values: [1, 0], percentages: [8.3, 0] },
      { id: 'reference_event-5', label: 'mf4e3_105', color: '#0ea5e9', values: [0, 1], percentages: [0, 20] },
    ],
    legend: [{ label: 'Reference', color: '#2563eb', role: 'reference' }],
    warnings: [],
    emptyState: null,
    ...overrides,
  };
}

describe('AbsoluteByEventPlotCard', () => {
  it('renders right-side vertical legend overlay with all event labels', () => {
    const markup = renderToStaticMarkup(<AbsoluteByEventPlotCard spec={buildSpec()} />);

    expect(markup).toContain('data-plot-legend-overlay="true"');
    expect(markup).toContain('overflow-y-auto');
    expect(markup).toContain('text-xs text-gray-700');
    expect(markup).toContain('mf4e3_100');
    expect(markup).toContain('mf4e3_105');
    expect(markup).not.toContain('+1');
  });
});
