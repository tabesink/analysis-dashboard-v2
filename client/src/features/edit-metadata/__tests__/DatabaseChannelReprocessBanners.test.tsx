import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DatabaseChannelReprocessBanners } from '@/features/edit-metadata/DatabaseChannelReprocessBanners';

const mockScopes: Record<
  string,
  {
    taskId: string;
    status: 'running' | 'completed' | 'failed';
    modalOpen: boolean;
    wizardStep: 'progress' | 'summary';
    progress: number;
    progressPhase: 'validating' | 'extracting' | 'generating';
    progressMessage: string;
    completionResult: null;
  }
> = {};

const mockMetadataEditDialog = {
  isOpen: false,
  programId: '',
  version: '',
};

vi.mock('@/stores/channel-reprocess-store', () => ({
  reopenChannelReprocessModal: vi.fn(),
  useChannelReprocessStore: <T,>(selector: (state: { scopes: typeof mockScopes }) => T) =>
    selector({ scopes: mockScopes }),
}));

vi.mock('@/stores/metadata-edit-dialog-store', () => ({
  useMetadataEditDialogStore: <T,>(
    selector: (state: typeof mockMetadataEditDialog) => T,
  ) => selector(mockMetadataEditDialog),
}));

describe('metadata edit dialog store selectors', () => {
  it('must not return a fresh object from useSyncExternalStore selectors', () => {
    const state = { isOpen: false, programId: 'P1', version: 'V1' };
    const unstableObjectSelector = (value: typeof state) => ({
      isOpen: value.isOpen,
      programId: value.programId,
      version: value.version,
    });
    const stablePrimitiveSelector = (value: typeof state) => value.isOpen;

    expect(unstableObjectSelector(state)).not.toBe(unstableObjectSelector(state));
    expect(stablePrimitiveSelector(state)).toBe(stablePrimitiveSelector(state));
  });
});

describe('DatabaseChannelReprocessBanners', () => {
  beforeEach(() => {
    Object.keys(mockScopes).forEach((key) => {
      delete mockScopes[key];
    });
    mockMetadataEditDialog.isOpen = false;
    mockMetadataEditDialog.programId = '';
    mockMetadataEditDialog.version = '';
  });

  it('shows a scoped database-page banner when reprocess runs in the background', () => {
    mockScopes['JOB-42::R3'] = {
      taskId: 'task-42',
      status: 'running',
      modalOpen: false,
      wizardStep: 'progress',
      progress: 30,
      progressPhase: 'generating',
      progressMessage: 'Generating cross-plot data: event_042 - bj_xy_force_plot (4,872 points)',
      completionResult: null,
    };

    const markup = renderToStaticMarkup(<DatabaseChannelReprocessBanners />);

    expect(markup).toContain('data-testid="database-channel-reprocess-banner"');
    expect(markup).toContain('JOB-42 · R3');
    expect(markup).toContain(
      'Generating cross-plot data: event_042 - bj_xy_force_plot (4,872 points)',
    );
    expect(markup).toContain('Reopen progress');
  });

  it('includes a reopen action for restoring the shell-mounted progress modal', () => {
    mockScopes['P1::V1'] = {
      taskId: 'task-1',
      status: 'running',
      modalOpen: false,
      wizardStep: 'progress',
      progress: 12,
      progressPhase: 'validating',
      progressMessage: 'Validating artifact 1/3: event_a.csv',
      completionResult: null,
    };

    const markup = renderToStaticMarkup(<DatabaseChannelReprocessBanners />);

    expect(markup).toContain('data-testid="database-channel-reprocess-reopen"');
  });

  it('suppresses the database-page banner while metadata editor is open for the same scope', () => {
    mockScopes['P1::V1'] = {
      taskId: 'task-1',
      status: 'running',
      modalOpen: false,
      wizardStep: 'progress',
      progress: 12,
      progressPhase: 'validating',
      progressMessage: 'Validating artifact 1/3: event_a.csv',
      completionResult: null,
    };
    mockMetadataEditDialog.isOpen = true;
    mockMetadataEditDialog.programId = 'P1';
    mockMetadataEditDialog.version = 'V1';

    const markup = renderToStaticMarkup(<DatabaseChannelReprocessBanners />);

    expect(markup).not.toContain('data-testid="database-channel-reprocess-banner"');
  });

  it('shows running state for read-only users without write actions on the banner', () => {
    mockScopes['P1::V1'] = {
      taskId: 'task-1',
      status: 'running',
      modalOpen: false,
      wizardStep: 'progress',
      progress: 12,
      progressPhase: 'validating',
      progressMessage: 'Validating artifact 1/3: event_a.csv',
      completionResult: null,
    };

    const markup = renderToStaticMarkup(<DatabaseChannelReprocessBanners />);

    expect(markup).toContain('data-testid="database-channel-reprocess-banner"');
    expect(markup).toContain('Reopen progress');
    expect(markup).not.toContain('Save');
    expect(markup).not.toContain('Upload');
  });
});
