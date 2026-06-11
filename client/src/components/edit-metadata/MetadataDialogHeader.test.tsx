import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { MetadataDialogHeader } from '@/components/edit-metadata/MetadataDialogHeader';

const mockUseQuery = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

describe('MetadataDialogHeader', () => {
  it('prefers the draft status value over the rolled-up event status', () => {
    mockUseQuery.mockReturnValue({
      data: {
        events: [{ status: 'Pending' }, { status: 'Approved' }],
      },
      isLoading: false,
      isFetching: false,
    });

    const markup = renderToStaticMarkup(
      <MetadataDialogHeader
        programId="P1"
        version="V1"
        statusDraftValue="Approved"
      />,
    );

    expect(markup).toContain('data-testid="metadata-dialog-status-badge"');
    expect(markup).toContain('>Approved<');
    expect(markup).not.toContain('data-testid="metadata-dialog-status-skeleton"');
  });

  it('falls back to rolled-up status when no draft value is set', () => {
    mockUseQuery.mockReturnValue({
      data: {
        events: [{ status: 'Pending' }, { status: 'Approved' }],
      },
      isLoading: false,
      isFetching: false,
    });

    const markup = renderToStaticMarkup(
      <MetadataDialogHeader programId="P1" version="V1" statusDraftValue={null} />,
    );

    expect(markup).toContain('>Pending<');
  });

  it('shows a skeleton while events load and no draft status is available', () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isFetching: true,
    });

    const markup = renderToStaticMarkup(
      <MetadataDialogHeader programId="P1" version="V1" statusDraftValue={null} />,
    );

    expect(markup).toContain('data-testid="metadata-dialog-status-skeleton"');
  });
});
