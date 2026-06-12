import { describe, expect, it } from 'vitest';

import { resolveScheduleDamageResponse } from '@/features/edit-metadata/lib/schedule-damage-response';
import type { DurabilityScheduleContextResponse } from '@/types/api';

function makeBaseResponse(): DurabilityScheduleContextResponse {
  return {
    program_id: 'P1',
    version: 'V1',
    schedule_id: 1,
    artifact_uri: 'artifact://schedule.sch',
    schedule_sha256: 'sha256',
    source_filename: 'schedule.sch',
    parse_preview: {
      schedule_id: 'S1',
      multiplier: 1,
      entry_count: 0,
      entries: [],
      entries_preview: [],
      event_rows: [],
      delimiter_token: null,
    },
  };
}

describe('resolveScheduleDamageResponse', () => {
  it('resolves task outcome from explicit command fields', () => {
    const resolved = resolveScheduleDamageResponse({
      ...makeBaseResponse(),
      schedule_command_outcome: 'calculation_started',
      damage_task_id: 'task-1',
      damage_task_status: 'calculating',
    });

    expect(resolved).toEqual({ kind: 'damage_task', taskId: 'task-1' });
  });

  it('resolves blocked outcome from explicit command fields', () => {
    const resolved = resolveScheduleDamageResponse({
      ...makeBaseResponse(),
      schedule_command_outcome: 'validation_blocked',
      damage_prerequisite_report: {
        summary: 'Prerequisites missing',
        issues: [],
      },
    });

    expect(resolved).toEqual({
      kind: 'prerequisite_report',
      report: {
        summary: 'Prerequisites missing',
        issues: [],
      },
    });
  });

  it('keeps legacy fallback behavior when command outcome is absent', () => {
    const resolved = resolveScheduleDamageResponse({
      ...makeBaseResponse(),
      damage_task_id: 'legacy-task',
    });

    expect(resolved).toEqual({ kind: 'damage_task', taskId: 'legacy-task' });
  });
});
