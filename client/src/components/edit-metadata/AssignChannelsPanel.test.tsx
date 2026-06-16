import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { AssignChannelsPanel } from '@/components/edit-metadata/AssignChannelsPanel';

const mockUseQuery = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    loading: vi.fn(),
  },
}));

vi.mock('@/lib/api', () => ({
  dashboardApi: {
    getChannelMapEditor: vi.fn(),
    saveChannelMap: vi.fn(),
    uploadChannelMap: vi.fn(),
  },
}));

vi.mock('@/components/edit-metadata/ChannelMapUploadDialog', () => ({
  ChannelMapUploadDialog: () => <div data-testid="channel-map-upload-dialog" />,
}));

vi.mock('@/features/database/datasets', () => ({
  CsvPreviewTable: () => <div data-testid="csv-preview-table" />,
}));

describe('AssignChannelsPanel', () => {
  it('renders scoped channel map editor when program and version are provided', () => {
    mockUseQuery.mockReturnValue({
      data: {
        entries: [{ plot_key: 'bj_xy_force_plot', x_col: 1, y_col: 2 }],
        preview_lines: ['line1'],
        column_count: 10,
        missing_channel_map: false,
      },
      isLoading: false,
    });

    const markup = renderToStaticMarkup(
      <AssignChannelsPanel scope={{ programId: 'P1', version: 'V1' }} canWrite />,
    );

    expect(markup).toContain('data-testid="assign-channels-panel"');
    expect(markup).toContain('data-scope="P1::V1"');
    expect(markup).toContain('data-testid="csv-preview-table"');
  });

  it('reports clean dirty state when draft matches loaded baseline', () => {
    mockUseQuery.mockReturnValue({
      data: {
        entries: [{ plot_key: 'bj_xy_force_plot', x_col: 1, y_col: 2 }],
        preview_lines: [],
        column_count: 10,
        missing_channel_map: false,
      },
      isLoading: false,
    });

    const markup = renderToStaticMarkup(
      <AssignChannelsPanel scope={{ programId: 'P1', version: 'V1' }} canWrite />,
    );

    expect(markup).toContain('data-is-dirty="false"');
  });

  it('keeps Save disabled when column_count is missing', () => {
    mockUseQuery.mockReturnValue({
      data: {
        entries: [],
        preview_lines: [],
        column_count: 0,
        missing_channel_map: true,
      },
      isLoading: false,
    });

    const markup = renderToStaticMarkup(
      <AssignChannelsPanel scope={{ programId: 'P1', version: 'V1' }} canWrite />,
    );

    expect(markup).toContain('disabled=""');
  });

  it('disables Upload when write access is denied', () => {
    mockUseQuery.mockReturnValue({
      data: {
        entries: [],
        preview_lines: [],
        column_count: 10,
        missing_channel_map: false,
      },
      isLoading: false,
    });

    const markup = renderToStaticMarkup(
      <AssignChannelsPanel scope={{ programId: 'P1', version: 'V1' }} canWrite={false} />,
    );

    expect(markup).toContain('data-testid="assign-channels-upload"');
    expect(markup).toContain('disabled=""');
  });

  it('shows read-only save affordance when write access is denied', () => {
    mockUseQuery.mockReturnValue({
      data: {
        entries: [],
        preview_lines: [],
        column_count: 10,
        missing_channel_map: false,
      },
      isLoading: false,
    });

    const markup = renderToStaticMarkup(
      <AssignChannelsPanel scope={{ programId: 'P1', version: 'V1' }} canWrite={false} />,
    );

    expect(markup).toContain('data-can-write="false"');
    expect(markup).toContain('data-testid="assign-channels-save"');
    expect(markup).toContain('data-testid="assign-channels-reset"');
    expect(markup).toContain('disabled=""');
  });

  it('renders Upload alongside Reset and Save for write users', () => {
    mockUseQuery.mockReturnValue({
      data: {
        entries: [{ plot_key: 'bj_xy_force_plot', x_col: 1, y_col: 2 }],
        preview_lines: [],
        column_count: 10,
        missing_channel_map: false,
      },
      isLoading: false,
    });

    const markup = renderToStaticMarkup(
      <AssignChannelsPanel scope={{ programId: 'P1', version: 'V1' }} canWrite />,
    );

    expect(markup).toContain('data-testid="assign-channels-upload"');
    expect(markup).toContain('>Upload<');
    expect(markup).toContain('data-testid="assign-channels-reset"');
    expect(markup).toContain('data-testid="assign-channels-save"');
    expect(markup).toContain('data-testid="channel-map-upload-dialog"');
  });

  it('hides channel-map-required indicator after the scoped version has a saved map', () => {
    mockUseQuery.mockReturnValue({
      data: {
        entries: [{ plot_key: 'bj_xy_force_plot', x_col: 1, y_col: 2 }],
        preview_lines: [],
        column_count: 10,
        missing_channel_map: false,
      },
      isLoading: false,
    });

    const markup = renderToStaticMarkup(
      <AssignChannelsPanel scope={{ programId: 'P1', version: 'V1' }} canWrite />,
    );

    expect(markup).not.toContain('Channel map required before these files can be plotted.');
  });

  it('keeps Reset and Save enabled alongside Upload when the editor is ready for writes', () => {
    mockUseQuery.mockReturnValue({
      data: {
        entries: [{ plot_key: 'bj_xy_force_plot', x_col: 1, y_col: 2 }],
        preview_lines: [],
        column_count: 10,
        missing_channel_map: false,
      },
      isLoading: false,
    });

    const markup = renderToStaticMarkup(
      <AssignChannelsPanel scope={{ programId: 'P1', version: 'V1' }} canWrite />,
    );

    expect(markup).toContain('data-testid="assign-channels-upload"');
    expect(markup).not.toMatch(/data-testid="assign-channels-upload"[^>]*disabled=""/);
    expect(markup).toContain('data-testid="assign-channels-reset"');
    expect(markup).not.toMatch(/data-testid="assign-channels-reset"[^>]*disabled=""/);
    expect(markup).toContain('data-testid="assign-channels-save"');
    expect(markup).not.toMatch(/data-testid="assign-channels-save"[^>]*disabled=""/);
  });

  it('shows channel-map-required indicator when the scoped version still needs a map', () => {
    mockUseQuery.mockReturnValue({
      data: {
        entries: [],
        preview_lines: [],
        column_count: 10,
        missing_channel_map: true,
      },
      isLoading: false,
    });

    const markup = renderToStaticMarkup(
      <AssignChannelsPanel scope={{ programId: 'P1', version: 'V1' }} canWrite />,
    );

    expect(markup).toContain('Channel map required before these files can be plotted.');
  });
});
