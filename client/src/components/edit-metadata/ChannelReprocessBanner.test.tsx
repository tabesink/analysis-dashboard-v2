import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { ChannelReprocessBanner } from '@/components/edit-metadata/ChannelReprocessBanner';

describe('ChannelReprocessBanner', () => {
  it('shows scoped background progress with a reopen action', () => {
    const markup = renderToStaticMarkup(
      <ChannelReprocessBanner
        progressMessage="Generating cross-plot data: event_042 - bj_xy_force_plot (4,872 points)"
        onReopen={vi.fn()}
      />,
    );

    expect(markup).toContain('data-testid="channel-reprocess-banner"');
    expect(markup).toContain('Channel reprocess in progress');
    expect(markup).toContain(
      'Generating cross-plot data: event_042 - bj_xy_force_plot (4,872 points)',
    );
    expect(markup).toContain('Reopen progress');
  });
});
