import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  DialogCardFooter,
  DialogContentCard,
  DialogPageHeader,
} from '@/components/shared/dialog-layout';

describe('DialogPageHeader', () => {
  it('renders the title with a bottom divider', () => {
    const markup = renderToStaticMarkup(<DialogPageHeader title="Users" />);

    expect(markup).toContain('>Users<');
    expect(markup).toContain('border-b');
  });
});

describe('DialogContentCard', () => {
  it('renders context and alert slots above the body in order', () => {
    const markup = renderToStaticMarkup(
      <DialogContentCard
        data-testid="dialog-content-card"
        contextBar={<div data-testid="context-bar">Context</div>}
        alertBar={<div data-testid="alert-bar">Alert</div>}
      >
        <div data-testid="card-body">Body</div>
      </DialogContentCard>,
    );

    expect(markup).toMatch(
      /data-testid="context-bar"[\s\S]*data-testid="alert-bar"[\s\S]*data-testid="card-body"/,
    );
  });

  it('omits the footer when not provided', () => {
    const markup = renderToStaticMarkup(
      <DialogContentCard>
        <div>Body only</div>
      </DialogContentCard>,
    );

    expect(markup).not.toContain('border-t');
  });

  it('renders the footer when provided', () => {
    const markup = renderToStaticMarkup(
      <DialogContentCard
        footer={
          <DialogCardFooter>
            <button type="button">Save</button>
          </DialogCardFooter>
        }
      >
        <div>Body</div>
      </DialogContentCard>,
    );

    expect(markup).toContain('>Save<');
    expect(markup).toContain('border-t');
  });

  it('keeps the footer outside the scrollable body region', () => {
    const markup = renderToStaticMarkup(
      <DialogContentCard
        footer={
          <DialogCardFooter>
            <button type="button">Upload</button>
          </DialogCardFooter>
        }
      >
        <div data-testid="card-body">Sparse content</div>
      </DialogContentCard>,
    );

    expect(markup).toMatch(
      /overflow-y-auto[\s\S]*data-testid="card-body"[\s\S]*>Upload</,
    );
    expect(markup).toContain('shrink-0');
  });
});

describe('DialogCardFooter', () => {
  it('right-aligns footer actions with a top separator', () => {
    const markup = renderToStaticMarkup(
      <DialogCardFooter>
        <button type="button">Action</button>
      </DialogCardFooter>,
    );

    expect(markup).toContain('justify-end');
    expect(markup).toContain('border-t');
  });
});
