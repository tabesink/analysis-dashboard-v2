import { describe, expect, it, vi } from 'vitest';

import { applyScheduleDamageResponse } from '@/features/edit-metadata/lib/apply-schedule-damage-response';
import { attachProgramVersionDurabilitySchedule } from '@/features/edit-metadata/lib/durability-schedule-upload';

vi.mock('@/lib/api', () => ({
  dashboardApi: {
    attachProgramVersionSchedule: vi.fn(),
  },
}));

vi.mock('@/features/edit-metadata/lib/apply-schedule-damage-response', () => ({
  applyScheduleDamageResponse: vi.fn(),
}));

import { dashboardApi } from '@/lib/api';

describe('attachProgramVersionDurabilitySchedule', () => {
  it('attaches a schedule file for the scoped program/version and refreshes the scoped query', async () => {
    const queryClient = { invalidateQueries: vi.fn() };
    const scheduleFile = new File(['schedule'], 'test.sch', { type: 'application/octet-stream' });
    vi.mocked(dashboardApi.attachProgramVersionSchedule).mockResolvedValue({
      program_id: 'P1',
      version: 'V1',
      schedule_id: 9,
      artifact_uri: 'uri',
      schedule_sha256: 'sha',
      source_filename: 'test.sch',
      replaced_previous: false,
      previous_schedule_id: null,
      parse_preview: {
        schedule_id: 'SCH-1',
        multiplier: 1,
        entry_count: 1,
        entries: [],
        entries_preview: [],
      },
    });

    const result = await attachProgramVersionDurabilitySchedule({
      programId: 'P1',
      version: 'V1',
      scheduleFile,
      queryClient: queryClient as never,
    });

    expect(dashboardApi.attachProgramVersionSchedule).toHaveBeenCalledWith({
      programId: 'P1',
      version: 'V1',
      scheduleFile,
    });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['program-version-schedule', 'P1', 'V1'],
    });
    expect(result.source_filename).toBe('test.sch');
  });
});

describe('schedule upload damage follow-up', () => {
  it('can start damage progress when upload returns damage_task_id', () => {
    const queryClient = { invalidateQueries: vi.fn() } as never;
    const response = {
      program_id: 'P1',
      version: 'V1',
      schedule_id: 9,
      artifact_uri: 'uri',
      schedule_sha256: 'sha',
      source_filename: 'test.sch',
      replaced_previous: false,
      previous_schedule_id: null,
      damage_task_id: 'damage-task-1',
      parse_preview: {
        schedule_id: 'SCH-1',
        multiplier: 1,
        entry_count: 1,
        entries: [],
        entries_preview: [],
      },
    };

    applyScheduleDamageResponse({
      scope: { programId: 'P1', version: 'V1' },
      queryClient,
      response,
    });

    expect(applyScheduleDamageResponse).toHaveBeenCalledWith({
      scope: { programId: 'P1', version: 'V1' },
      queryClient,
      response,
    });
  });
});
