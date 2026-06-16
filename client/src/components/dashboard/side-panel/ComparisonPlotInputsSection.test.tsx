import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ComparisonPlotInputsSection } from './ComparisonPlotInputsSection';

describe('ComparisonPlotInputsSection', () => {
  it('renders disabled channels with clear strike-through styling', () => {
    const markup = renderToStaticMarkup(
      <ComparisonPlotInputsSection
        selectedChannelKeys={['bj_x_force']}
        valueMode="absolute"
        eventThreshold={5}
        onChannelToggle={vi.fn()}
        onValueModeChange={vi.fn()}
        onEventThresholdChange={vi.fn()}
      />,
    );

    expect(markup).toContain('data-channel-enabled="false"');
    expect(markup).toContain('line-through');
    expect(markup).toContain('aria-label="Channel BJ Y disabled"');
    expect(markup).toContain('border-dashed');
  });
});
