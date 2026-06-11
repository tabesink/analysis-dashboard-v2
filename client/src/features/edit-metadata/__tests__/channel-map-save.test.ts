import { describe, expect, it, vi } from 'vitest';

import { saveProgramVersionChannelMap } from '@/features/edit-metadata/lib/channel-map-save';

vi.mock('@/lib/api', () => ({
  dashboardApi: {
    saveChannelMap: vi.fn(),
  },
}));

import { dashboardApi } from '@/lib/api';

describe('saveProgramVersionChannelMap', () => {
  it('starts a channel reprocess task through the dashboard API', async () => {
    const entries = [{ plot_key: 'bj_xy_force_plot', x_col: 1, y_col: 2 }];
    vi.mocked(dashboardApi.saveChannelMap).mockResolvedValue({
      task_id: 'task-1',
      task_kind: 'channel_reprocess',
      reused_existing_task: false,
    });

    const result = await saveProgramVersionChannelMap({
      programId: 'P1',
      version: 'V1',
      entries,
    });

    expect(dashboardApi.saveChannelMap).toHaveBeenCalledWith({
      program_id: 'P1',
      version: 'V1',
      entries,
    });
    expect(result.task_id).toBe('task-1');
    expect(result.task_kind).toBe('channel_reprocess');
  });
});
