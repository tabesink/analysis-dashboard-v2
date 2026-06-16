import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Damage2DPlotSpec } from '../lib/build-damage-2d-plot-spec';
import { CumulativeByChannelPlotCard } from './CumulativeByChannelPlotCard';

function buildSpec(overrides?: Partial<Damage2DPlotSpec>): Damage2DPlotSpec {
  return {
    plotType: 'cumulative_by_channel',
    chartKind: 'grouped-bar',
    title: 'Cumulative Damage by Channel',
    subtitle: '',
    xCategories: ['BJ X Force', 'BJ Y Force'],
    yScale: {
      mode: 'linear',
      domain: [0, 30],
      tickFormat: 'linear',
    },
    series: [
      {
        id: 'reference',
        label: 'Reference',
        color: '#2563eb',
        values: [10, 4],
      },
      {
        id: 'target',
        label: 'Target',
        color: '#dc2626',
        values: [30, 8],
      },
    ],
    legend: [
      { label: 'Reference', color: '#2563eb', role: 'reference' },
      { label: 'Target', color: '#dc2626', role: 'target' },
    ],
    warnings: [],
    emptyState: null,
    ...overrides,
  };
}

describe('CumulativeByChannelPlotCard', () => {
  it('renders grouped bars, categories, and legend labels for reference and target', () => {
    const markup = renderToStaticMarkup(<CumulativeByChannelPlotCard spec={buildSpec()} />);

    expect(markup).toContain('Cumulative Damage by Channel');
    expect(markup).not.toContain('Absolute mode · Linear scale · 2 channels');
    expect(markup).toContain('Reference');
    expect(markup).toContain('Target');
    expect(markup).toContain('BJ X Force');
    expect(markup).toContain('BJ Y Force');
    expect(markup).toContain('data-bar-id="reference-0"');
    expect(markup).toContain('data-bar-id="target-1"');
    expect(markup).toContain('data-plot-legend-overlay="true"');
    expect(markup).toContain('text-xs text-gray-700');
    expect(markup).not.toContain('bg-white/85');
    expect(markup).not.toContain('ring-1');
  });

  it('includes hover tooltip text and accessible labels for bars', () => {
    const markup = renderToStaticMarkup(<CumulativeByChannelPlotCard spec={buildSpec()} />);

    expect(markup).toContain('aria-label="Reference value for BJ X Force: 10.00"');
    expect(markup).toContain('Channel: BJ X Force');
    expect(markup).toContain('Dataset: Reference');
    expect(markup).toContain('Value mode: absolute');
    expect(markup).toContain('Scale context: linear');
  });

  it('uses PlotCardShell empty state messaging when spec has empty data', () => {
    const markup = renderToStaticMarkup(
      <CumulativeByChannelPlotCard
        spec={buildSpec({
          xCategories: [],
          series: [],
          emptyState: {
            title: 'No cumulative channel totals',
            description: 'The selected channels do not have renderable cumulative totals.',
          },
        })}
      />,
    );

    expect(markup).toContain('No cumulative channel totals');
    expect(markup).toContain('The selected channels do not have renderable cumulative totals.');
    expect(markup).not.toContain('data-bar-id=');
  });

  it('renders loading and error card-shell states', () => {
    const loadingMarkup = renderToStaticMarkup(
      <CumulativeByChannelPlotCard spec={buildSpec()} isLoading />,
    );
    expect(loadingMarkup).toContain('Loading plot...');

    const errorMarkup = renderToStaticMarkup(
      <CumulativeByChannelPlotCard spec={buildSpec()} error="Failed to render grouped bars" />,
    );
    expect(errorMarkup).toContain('Failed to render grouped bars');
  });

  it('renders density warnings when the selected plot scope is truncated', () => {
    const markup = renderToStaticMarkup(
      <CumulativeByChannelPlotCard
        spec={buildSpec({
          warnings: ['Showing 40 of 96 channels to keep the chart readable.'],
        })}
      />,
    );

    expect(markup).toContain('Showing 40 of 96 channels to keep the chart readable.');
  });
});
