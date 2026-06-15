import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { PlotCardShell } from './PlotCardShell';

describe('PlotCardShell', () => {
  it('renders children, title chip, subtitle, actions, and footer in normal state', () => {
    const markup = renderToStaticMarkup(
      <PlotCardShell
        title="Cumulative by channel"
        subtitle="4 channels"
        actionSlot={<button type="button">Action</button>}
        footerSlot={<div>Footer details</div>}
      >
        <div>Renderer content</div>
      </PlotCardShell>,
    );

    expect(markup).toContain('Renderer content');
    expect(markup).toContain('Cumulative by channel');
    expect(markup).toContain('4 channels');
    expect(markup).toContain('Action');
    expect(markup).toContain('Footer details');
  });

  it('renders loading state content and still keeps the title chip', () => {
    const markup = renderToStaticMarkup(
      <PlotCardShell title="Absolute by event" isLoading>
        <div>Renderer content</div>
      </PlotCardShell>,
    );

    expect(markup).toContain('Loading plot...');
    expect(markup).toContain('Absolute by event');
    expect(markup).not.toContain('Renderer content');
  });

  it('renders error state content with message', () => {
    const markup = renderToStaticMarkup(
      <PlotCardShell title="Program/version" error="Failed to build plot">
        <div>Renderer content</div>
      </PlotCardShell>,
    );

    expect(markup).toContain('Failed to build plot');
    expect(markup).toContain('Program/version');
    expect(markup).not.toContain('Renderer content');
  });

  it('renders empty state content and no renderer children', () => {
    const markup = renderToStaticMarkup(
      <PlotCardShell
        title="Delta vs reference"
        isEmpty
        emptyTitle="No comparison data"
        emptyDescription="Select events in both scopes to compare."
      >
        <div>Renderer content</div>
      </PlotCardShell>,
    );

    expect(markup).toContain('No comparison data');
    expect(markup).toContain('Select events in both scopes to compare.');
    expect(markup).toContain('Delta vs reference');
    expect(markup).not.toContain('Renderer content');
  });
});
