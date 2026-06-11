import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  startAssignChannelsSaveReprocess,
  startAssignChannelsUploadReprocess,
} from '@/features/edit-metadata/lib/assign-channels-reprocess-flow';

const saveProgramVersionChannelMap = vi.fn();
const uploadProgramVersionChannelMap = vi.fn();
const trackChannelReprocessTask = vi.fn();

vi.mock('@/lib/api', () => ({
  dashboardApi: {
    saveChannelMap: (...args: unknown[]) => saveProgramVersionChannelMap(...args),
    uploadChannelMap: (...args: unknown[]) => uploadProgramVersionChannelMap(...args),
  },
}));

vi.mock('@/stores/channel-reprocess-store', () => ({
  trackChannelReprocessTask: (...args: unknown[]) => trackChannelReprocessTask(...args),
}));

describe('assign channels reprocess flow', () => {
  const scope = { programId: 'P1', version: 'V1' };
  const queryClient = { invalidateQueries: vi.fn() } as never;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens channel reprocess tracking immediately after manual save returns a task id', async () => {
    saveProgramVersionChannelMap.mockResolvedValue({
      task_id: 'task-save',
      task_kind: 'channel_reprocess',
      reused_existing_task: false,
    });

    const entries = [{ plot_key: 'bj_xy_force_plot', x_col: 1, y_col: 2 }];
    const result = await startAssignChannelsSaveReprocess({
      scope,
      entries,
      queryClient,
    });

    expect(saveProgramVersionChannelMap).toHaveBeenCalledWith({
      program_id: 'P1',
      version: 'V1',
      entries,
    });
    expect(trackChannelReprocessTask).toHaveBeenCalledWith({
      scope,
      taskId: 'task-save',
      queryClient,
      reopenExisting: false,
    });
    expect(result.task_id).toBe('task-save');
  });

  it('opens channel reprocess tracking immediately after channel-map upload returns a task id', async () => {
    uploadProgramVersionChannelMap.mockResolvedValue({
      task_id: 'task-upload',
      task_kind: 'channel_reprocess',
      reused_existing_task: false,
    });
    const channelMapFile = new File(['x_col: 0'], 'channel_map.yml', {
      type: 'application/x-yaml',
    });

    const result = await startAssignChannelsUploadReprocess({
      scope,
      channelMapFile,
      queryClient,
    });

    expect(uploadProgramVersionChannelMap).toHaveBeenCalledWith({
      program_id: 'P1',
      version: 'V1',
      channelMapFile,
    });
    expect(trackChannelReprocessTask).toHaveBeenCalledWith({
      scope,
      taskId: 'task-upload',
      queryClient,
      reopenExisting: false,
    });
    expect(result.task_id).toBe('task-upload');
  });

  it('reopens the existing task when the start API reports reused_existing_task', async () => {
    saveProgramVersionChannelMap.mockResolvedValue({
      task_id: 'task-active',
      task_kind: 'channel_reprocess',
      reused_existing_task: true,
    });

    await startAssignChannelsSaveReprocess({
      scope,
      entries: [{ plot_key: 'bj_xy_force_plot', x_col: 1, y_col: 2 }],
      queryClient,
    });

    expect(trackChannelReprocessTask).toHaveBeenCalledWith({
      scope,
      taskId: 'task-active',
      queryClient,
      reopenExisting: true,
    });
  });

  it('does not track reprocess when manual save fails before a task starts', async () => {
    saveProgramVersionChannelMap.mockRejectedValue(new Error('Save failed'));

    await expect(
      startAssignChannelsSaveReprocess({
        scope,
        entries: [{ plot_key: 'bj_xy_force_plot', x_col: 1, y_col: 2 }],
        queryClient,
      }),
    ).rejects.toThrow('Save failed');

    expect(trackChannelReprocessTask).not.toHaveBeenCalled();
  });

  it('does not track reprocess when channel-map upload fails before a task starts', async () => {
    uploadProgramVersionChannelMap.mockRejectedValue(new Error('Upload failed'));

    await expect(
      startAssignChannelsUploadReprocess({
        scope,
        channelMapFile: new File(['bad'], 'channel_map.yml', { type: 'application/x-yaml' }),
        queryClient,
      }),
    ).rejects.toThrow('Upload failed');

    expect(trackChannelReprocessTask).not.toHaveBeenCalled();
  });
});
