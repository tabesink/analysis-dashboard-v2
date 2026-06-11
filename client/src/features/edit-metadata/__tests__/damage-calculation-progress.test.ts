import { describe, expect, it } from 'vitest';

import { mapDamageCalculationProgress } from '@/features/edit-metadata/lib/damage-calculation-progress';
import type { DerivedTaskStatusEvent } from '@/types/api';

function event(
  overrides: Partial<DerivedTaskStatusEvent> = {},
): DerivedTaskStatusEvent {
  return {
    task_id: 'task-1',
    task_kind: 'damage_calculation',
    status: 'running',
    phase: 'validating',
    completed_events: 0,
    total_events: 4,
    ...overrides,
  };
}

describe('mapDamageCalculationProgress', () => {
  it('uses locked copy for load-history damage calculation', () => {
    const mapped = mapDamageCalculationProgress(
      event({
        phase: 'calculating',
        progress_message: 'Calculating load history damage: event_042 - BJ X Force',
        completed_events: 1,
        total_events: 4,
      }),
    );

    expect(mapped.progressMessage).toBe(
      'Calculating load history damage: event_042 - BJ X Force',
    );
    expect(mapped.progressPhase).toBe('calculating');
    expect(mapped.progress).toBeGreaterThan(25);
    expect(mapped.progress).toBeLessThan(96);
  });

  it('maps completed tasks to 100 percent progress', () => {
    const mapped = mapDamageCalculationProgress(
      event({
        status: 'completed',
        phase: 'completed',
        completed_events: 4,
        progress_message: null,
      }),
    );

    expect(mapped.progress).toBe(100);
    expect(mapped.progressPhase).toBe('calculating');
  });
});
