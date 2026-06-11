import { describe, expect, it } from 'vitest';

import { resolveDamageCalculationCompletionBehavior } from '@/features/edit-metadata/lib/damage-calculation-task-completion';
import type { DerivedTaskStatusEvent } from '@/types/api';

function completedEvent(
  overrides: Partial<DerivedTaskStatusEvent> = {},
): DerivedTaskStatusEvent {
  return {
    task_id: 'task-1',
    task_kind: 'damage_calculation',
    status: 'completed',
    phase: 'completed',
    completed_events: 2,
    total_events: 2,
    result: { processed_events: 2 },
    ...overrides,
  };
}

describe('resolveDamageCalculationCompletionBehavior', () => {
  it('keeps manual failures on the derived-data summary modal', () => {
    const resolved = resolveDamageCalculationCompletionBehavior({
      event: completedEvent({
        status: 'failed',
        phase: 'failed',
        error: 'Schedule validation failed',
      }),
      origin: 'manual',
      modalWasOpen: true,
    });

    expect(resolved.status).toBe('failed');
    expect(resolved.modalOpen).toBe(true);
    expect(resolved.toast).toBeUndefined();
  });

  it('uses toast-only feedback for automatic failures', () => {
    const resolved = resolveDamageCalculationCompletionBehavior({
      event: completedEvent({
        status: 'failed',
        phase: 'failed',
        error: 'Damage calculation failed',
      }),
      origin: 'automatic',
      modalWasOpen: true,
    });

    expect(resolved.status).toBe('failed');
    expect(resolved.modalOpen).toBe(false);
    expect(resolved.toast?.tone).toBe('error');
    expect(resolved.toast?.message).toContain('Damage calculation failed');
  });

  it('does not reopen the modal after automatic success when the user dismissed it', () => {
    const resolved = resolveDamageCalculationCompletionBehavior({
      event: completedEvent(),
      origin: 'automatic',
      modalWasOpen: false,
    });

    expect(resolved.status).toBe('completed');
    expect(resolved.modalOpen).toBe(false);
    expect(resolved.toast).toBeUndefined();
  });
});
