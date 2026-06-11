import { describe, expect, it } from 'vitest';

import { buildChannelReprocessCompletionResult } from '@/features/edit-metadata/lib/channel-reprocess-completion';
import type { DerivedTaskStatusEvent } from '@/types/api';

describe('buildChannelReprocessCompletionResult', () => {
  it('builds a success summary when all artifacts processed', () => {
    const result = buildChannelReprocessCompletionResult({
      task_id: 'task-1',
      task_kind: 'channel_reprocess',
      status: 'completed',
      phase: 'completed',
      completed_events: 3,
      total_events: 3,
      result: {
        processed_count: 3,
        failed_count: 0,
      },
    } as DerivedTaskStatusEvent);

    expect(result.success).toBe(true);
    expect(result.title).toBe('Channel reprocess complete');
    expect(result.detailLines).toContain('Processed 3 files');
  });

  it('builds a warning summary when some artifacts failed', () => {
    const result = buildChannelReprocessCompletionResult({
      task_id: 'task-1',
      task_kind: 'channel_reprocess',
      status: 'completed',
      phase: 'completed',
      completed_events: 2,
      total_events: 3,
      error: '1 artifact(s) failed',
      result: {
        processed_count: 2,
        failed_count: 1,
      },
    } as DerivedTaskStatusEvent);

    expect(result.success).toBe(false);
    expect(result.title).toBe('Channel reprocess finished with warnings');
    expect(result.detailLines).toContain('Processed 2 files');
    expect(result.detailLines).toContain('1 file failed');
  });

  it('builds a failure summary when the task fails', () => {
    const result = buildChannelReprocessCompletionResult({
      task_id: 'task-1',
      task_kind: 'channel_reprocess',
      status: 'failed',
      phase: 'failed',
      completed_events: 0,
      total_events: 3,
      error: 'Unexpected server error',
    } as DerivedTaskStatusEvent);

    expect(result.success).toBe(false);
    expect(result.title).toBe('Channel reprocess failed');
    expect(result.message).toBe('Unexpected server error');
  });
});
