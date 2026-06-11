import { describe, expect, it, vi } from 'vitest';

import { saveProgramVersionDurabilitySchedule } from '@/features/edit-metadata/lib/durability-schedule-save';

vi.mock('@/lib/api', () => ({
  dashboardApi: {
    saveProgramVersionSchedule: vi.fn(),
  },
}));

import { dashboardApi } from '@/lib/api';

const sampleRow = {
  id: 'row-1',
  rspFileName: 'event.rsp',
  rspEventName: 'event',
  schedulePattern: 'P1',
  weight: 1,
  repeats: 2,
  scheduleSequence: 3,
};

describe('saveProgramVersionDurabilitySchedule', () => {
  it('persists schedule rows through the existing API contract and refreshes the scoped query', async () => {
    const queryClient = { invalidateQueries: vi.fn() };
    vi.mocked(dashboardApi.saveProgramVersionSchedule).mockResolvedValue({
      program_id: 'P1',
      version: 'V1',
      schedule_id: 9,
      artifact_uri: 'uri',
      schedule_sha256: 'sha',
      source_filename: 'test.sch',
      parse_preview: {
        schedule_id: 'SCH-1',
        multiplier: 2,
        entry_count: 1,
        entries: [],
        entries_preview: [],
        event_rows: [
          {
            event_id: 'row-1',
            rsp_file_name: 'event.rsp',
            rsp_event_name: 'event',
            pattern: 'P1',
            repeats: 2,
            weight: 1,
            schedule_sequence: 3,
          },
        ],
        delimiter_token: 'bt1cc',
      },
    });

    const result = await saveProgramVersionDurabilitySchedule({
      programId: 'P1',
      version: 'V1',
      draftRows: [sampleRow],
      multiplier: 2,
      delimiterToken: 'bt1cc',
      queryClient: queryClient as never,
    });

    expect(dashboardApi.saveProgramVersionSchedule).toHaveBeenCalledWith({
      program_id: 'P1',
      version: 'V1',
      multiplier: 2,
      event_rows: [
        {
          event_id: 'row-1',
          rsp_file_name: 'event.rsp',
          rsp_event_name: 'event',
          pattern: 'P1',
          repeats: 2,
          weight: 1,
          schedule_sequence: 3,
        },
      ],
      delimiter_token: 'bt1cc',
    });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['program-version-schedule', 'P1', 'V1'],
    });
    expect(result.draft.rows).toHaveLength(1);
    expect(result.draft.multiplier).toBe(2);
    expect(result.draft.delimiterToken).toBe('bt1cc');
    expect(result.response.damage_task_id).toBeUndefined();
  });

  it('returns damage follow-up fields from the save response', async () => {
    const queryClient = { invalidateQueries: vi.fn() };
    vi.mocked(dashboardApi.saveProgramVersionSchedule).mockResolvedValue({
      program_id: 'P1',
      version: 'V1',
      schedule_id: 9,
      artifact_uri: 'uri',
      schedule_sha256: 'sha',
      source_filename: 'test.sch',
      damage_task_id: 'damage-task-1',
      parse_preview: {
        schedule_id: 'SCH-1',
        multiplier: 2,
        entry_count: 1,
        entries: [],
        entries_preview: [],
        event_rows: [],
      },
    });

    const result = await saveProgramVersionDurabilitySchedule({
      programId: 'P1',
      version: 'V1',
      draftRows: [sampleRow],
      multiplier: 2,
      delimiterToken: null,
      queryClient: queryClient as never,
    });

    expect(result.response.damage_task_id).toBe('damage-task-1');
  });
});
