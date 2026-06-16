import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PlotLegendOverlay } from './PlotLegendOverlay';

describe('PlotLegendOverlay', () => {
  it('renders a vertical, scrollable legend with readable font size', () => {
    const markup = renderToStaticMarkup(
      <PlotLegendOverlay
        items={[
          { id: 'a', label: 'Alpha', color: '#2563eb' },
          { id: 'b', label: 'Beta', color: '#dc2626' },
        ]}
      />,
    );

    expect(markup).toContain('data-plot-legend-overlay="true"');
    expect(markup).toContain('flex max-h-full flex-col items-start gap-1 overflow-y-auto');
    expect(markup).toContain('text-xs text-gray-700');
    expect(markup).toContain('h-2 w-2');
    expect(markup).toContain('Alpha');
    expect(markup).toContain('Beta');
  });

  it('uses a transparent panel without border chrome', () => {
    const markup = renderToStaticMarkup(
      <PlotLegendOverlay items={[{ id: 'a', label: 'Alpha', color: '#2563eb' }]} />,
    );

    expect(markup).toContain('bg-transparent');
    expect(markup).not.toContain('ring-1');
    expect(markup).not.toContain('bg-white/85');
  });
});
