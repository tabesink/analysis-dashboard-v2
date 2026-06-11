import { describe, expect, it } from 'vitest';

import { buildDamageCalculationCompletionResult } from '@/features/edit-metadata/lib/damage-calculation-completion';
import type { DerivedTaskStatusEvent } from '@/types/api';

describe('buildDamageCalculationCompletionResult', () => {
  it('returns a schedule-editor action when validation fails with a failure report', () => {
    const result = buildDamageCalculationCompletionResult({
      task_id: 'task-1',
      task_kind: 'damage_calculation',
      status: 'failed',
      phase: 'failed',
      completed_events: 0,
      total_events: 2,
      error: 'Schedule validation failed',
      result: {
        failure_report: {
          summary: 'Fix blank repeats before calculating damage.',
          issues: [
            {
              event_id: 'event_042',
              event_name: 'event_042',
              field: 'repeats',
              code: 'blank_repeats',
              message: 'Repeats is required.',
            },
          ],
        },
      },
    } satisfies DerivedTaskStatusEvent);

    expect(result.success).toBe(false);
    expect(result.title).toBe('Damage calculation failed');
    expect(result.primaryAction).toEqual({
      label: 'Open schedule editor',
      testId: 'damage-calculation-open-schedule-editor',
    });
    expect(result.failureReport?.summary).toBe('Fix blank repeats before calculating damage.');
  });

  it('returns a success summary when damage calculation completes', () => {
    const result = buildDamageCalculationCompletionResult({
      task_id: 'task-1',
      task_kind: 'damage_calculation',
      status: 'completed',
      phase: 'completed',
      completed_events: 3,
      total_events: 3,
      result: { processed_events: 3 },
    });

    expect(result.success).toBe(true);
    expect(result.title).toBe('Damage calculation complete');
    expect(result.failureReport).toBeUndefined();
  });
});
