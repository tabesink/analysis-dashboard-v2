// @vitest-environment happy-dom

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Damage2DPlotSpec } from '../lib/build-damage-2d-plot-spec';
import { TargetDeltaVsReferencePlotCard } from './TargetDeltaVsReferencePlotCard';

function buildSpec(overrides?: Partial<Damage2DPlotSpec>): Damage2DPlotSpec {
  return {
    plotType: 'target_delta_vs_reference',
    chartKind: 'diverging-bar',
    title: 'Target Δ vs Reference Damage by Channel',
    subtitle: '',
    xCategories: ['BJ X Force', 'BJ Y Force'],
    yScale: {
      mode: 'linear',
      domain: [-20, 20],
      tickFormat: 'linear',
    },
    series: [
      {
        id: 'target_delta',
        label: 'Signed delta (Target - Reference)',
        color: '#7c3aed',
        values: [20, -4],
        flags: [undefined, 'low_reference'],
      },
    ],
    legend: [{ label: 'Target - Reference Δ', color: '#7c3aed', role: 'delta' }],
    warnings: ['Low-reference channels are flagged and ratio-style metrics are suppressed.'],
    emptyState: null,
    deltaRows: [
      {
        channelKey: 'bj_x_force',
        channelLabel: 'BJ X Force',
        referenceDamage: 10,
        targetDamage: 30,
        signedDelta: 20,
        valueModeLabel: 'absolute',
        lowReference: false,
      },
      {
        channelKey: 'bj_y_force',
        channelLabel: 'BJ Y Force',
        referenceDamage: 8,
        targetDamage: 4,
        signedDelta: -4,
        valueModeLabel: 'absolute',
        lowReference: true,
      },
    ],
    ...overrides,
  };
}

describe('TargetDeltaVsReferencePlotCard', () => {
  it('renders diverging bars with a visible zero baseline and legend', () => {
    const markup = renderToStaticMarkup(<TargetDeltaVsReferencePlotCard spec={buildSpec()} />);

    expect(markup).toContain('Target Δ vs Reference Damage by Channel');
    expect(markup).not.toContain('Absolute mode · Signed delta · 2 channels');
    expect(markup).toContain('data-delta-zero-baseline="true"');
    expect(markup).toContain('data-delta-bar-id="target_delta-0"');
    expect(markup).toContain('data-delta-bar-id="target_delta-1"');
    expect(markup).toContain('Ratio');
    expect(markup).toContain('Target - Reference Δ');
    expect(markup).toContain('data-plot-legend-overlay="true"');
    expect(markup).toContain('text-xs text-gray-700');
    expect(markup).not.toContain('bg-white/85');
    expect(markup).not.toContain('ring-1');
  });

  it('always renders ratio metric values and marks low-reference rows as unavailable', () => {
    const markup = renderToStaticMarkup(<TargetDeltaVsReferencePlotCard spec={buildSpec()} />);

    expect(markup).toContain('data-delta-axis-format="ratio"');
    expect(markup).toContain('data-delta-metric-label="ratio"');
    expect(markup).toContain('aria-label="Ratio for BJ X Force: 3.00x"');
    expect(markup).toContain('aria-label="Ratio for BJ Y Force: unavailable"');
    expect(markup).toContain('Ratio: 3.00x');
    expect(markup).toContain('Ratio: unavailable (low reference)');
  });

  it('includes tooltip fields and low-reference warning copy', () => {
    const markup = renderToStaticMarkup(<TargetDeltaVsReferencePlotCard spec={buildSpec()} />);

    expect(markup).toContain('Channel: BJ X Force');
    expect(markup).toContain('Reference damage: 10.00');
    expect(markup).toContain('Target damage: 30.00');
    expect(markup).toContain('Value mode: absolute');
    expect(markup).toContain('Low-reference channels are flagged');
  });

  it('does not render the delta metric mode toggle', () => {
    const markup = renderToStaticMarkup(<TargetDeltaVsReferencePlotCard spec={buildSpec()} />);

    expect(markup).not.toContain('aria-label="Delta metric mode"');
    expect(markup).not.toContain('aria-label="Set delta metric to absolute"');
    expect(markup).not.toContain('aria-label="Set delta metric to percent"');
    expect(markup).not.toContain('aria-label="Set delta metric to ratio"');
    expect(markup).not.toContain('data-delta-metric-mode=');
  });
});
