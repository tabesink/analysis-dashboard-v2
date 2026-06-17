import { describe, expect, it } from 'vitest';

import {
  selectDatabaseChannelReprocessBanners,
  type DatabaseChannelReprocessBannerEntry,
} from '@/features/edit-metadata/lib/database-channel-reprocess-banner';
import type { ChannelReprocessScopeState } from '@/stores/channel-reprocess-store';

function runningScopeState(
  overrides: Partial<ChannelReprocessScopeState> = {},
): ChannelReprocessScopeState {
  return {
    taskId: 'task-1',
    status: 'running',
    modalOpen: false,
    wizardStep: 'progress',
    progress: 42,
    progressPhase: 'generating',
    progressMessage: 'Generating cross-plot data: event_042 - bj_xy_force_plot (4,872 points)',
    completionResult: null,
    ...overrides,
  };
}

describe('selectDatabaseChannelReprocessBanners', () => {
  it('shows a banner when reprocess is running, modal is dismissed, and metadata editor is closed', () => {
    const entries = selectDatabaseChannelReprocessBanners({
      scopes: { 'P1::V1': runningScopeState() },
      metadataEditDialog: { isOpen: false, programId: '', version: '' },
    });

    expect(entries).toEqual<DatabaseChannelReprocessBannerEntry[]>([
      {
        scope: { programId: 'P1', version: 'V1' },
        progressMessage:
          'Generating cross-plot data: event_042 - bj_xy_force_plot (4,872 points)',
      },
    ]);
  });

  it('hides the banner while the progress modal is open', () => {
    const entries = selectDatabaseChannelReprocessBanners({
      scopes: {
        'P1::V1': runningScopeState({ modalOpen: true }),
      },
      metadataEditDialog: { isOpen: false, programId: '', version: '' },
    });

    expect(entries).toEqual([]);
  });

  it('hides the banner when metadata editor is open for the same scope', () => {
    const entries = selectDatabaseChannelReprocessBanners({
      scopes: { 'P1::V1': runningScopeState() },
      metadataEditDialog: { isOpen: true, programId: 'P1', version: 'V1' },
    });

    expect(entries).toEqual([]);
  });

  it('still shows the banner when metadata editor is open for a different scope', () => {
    const entries = selectDatabaseChannelReprocessBanners({
      scopes: { 'P1::V1': runningScopeState() },
      metadataEditDialog: { isOpen: true, programId: 'P2', version: 'V2' },
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]?.scope).toEqual({ programId: 'P1', version: 'V1' });
  });

  it('does not show a banner after completion when scoped store entry remains on summary', () => {
    const entries = selectDatabaseChannelReprocessBanners({
      scopes: {
        'P1::V1': runningScopeState({
          status: 'completed',
          wizardStep: 'summary',
          modalOpen: false,
          progressMessage: 'Channel reprocess completed',
        }),
      },
      metadataEditDialog: { isOpen: false, programId: '', version: '' },
    });

    expect(entries).toEqual([]);
  });

  it('falls back to a short running label when progress message is empty', () => {
    const entries = selectDatabaseChannelReprocessBanners({
      scopes: {
        'JOB-42::R3': runningScopeState({ progressMessage: '' }),
      },
      metadataEditDialog: { isOpen: false, programId: '', version: '' },
    });

    expect(entries[0]?.progressMessage).toBe('Channel reprocess running…');
  });

  it('shows a banner while cancellation is in progress and modal is dismissed', () => {
    const entries = selectDatabaseChannelReprocessBanners({
      scopes: {
        'P1::V1': runningScopeState({
          status: 'cancelling',
          progressMessage: 'Cancelling safely...',
        }),
      },
      metadataEditDialog: { isOpen: false, programId: '', version: '' },
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]?.progressMessage).toBe('Cancelling safely...');
  });
});
