import { describe, expect, it } from 'vitest';

import { resolveScheduleDamageResponse } from '@/features/edit-metadata/lib/schedule-damage-response';
import type { DurabilityScheduleContextResponse } from '@/types/api';

function response(
  overrides: Partial<DurabilityScheduleContextResponse> = {},
): DurabilityScheduleContextResponse {
  return {
    program_id: 'P1',
    version: 'V1',
    schedule_id: 1,
    artifact_uri: 'uri',
    schedule_sha256: 'sha',
    source_filename: 'test.sch',
    parse_preview: {
      schedule_id: 'SCH-1',
      multiplier: 1,
      entry_count: 1,
      entries: [],
      entries_preview: [],
    },
    ...overrides,
  };
}

describe('resolveScheduleDamageResponse', () => {
  it('starts damage progress polling when the response includes damage_task_id', () => {
    const resolved = resolveScheduleDamageResponse(
      response({ damage_task_id: 'damage-task-1' }),
    );

    expect(resolved).toEqual({
      kind: 'damage_task',
      taskId: 'damage-task-1',
    });
  });

  it('shows a prerequisite report without polling when damage cannot start', () => {
    const report = {
      summary: 'Assign channels before calculating damage.',
      issues: [
        {
          field: 'channel' as const,
          code: 'missing_raw_load_histories',
          message: 'Raw load histories are missing.',
        },
      ],
    };

    const resolved = resolveScheduleDamageResponse(
      response({ damage_prerequisite_report: report }),
    );

    expect(resolved).toEqual({
      kind: 'prerequisite_report',
      report,
    });
  });

  it('returns none when no damage follow-up is required', () => {
    expect(resolveScheduleDamageResponse(response())).toEqual({ kind: 'none' });
  });
});
