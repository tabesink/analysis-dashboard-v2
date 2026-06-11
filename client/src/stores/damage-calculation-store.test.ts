import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  resetDamageCalculationToastEmitterForTests,
  setDamageCalculationToastEmitterForTests,
} from '@/features/edit-metadata/lib/damage-calculation-feedback';
import {
  closeDamageCalculationSummary,
  dismissDamageCalculationModal,
  getDamageCalculationScopeState,
  isDamageCalculationActive,
  reopenDamageCalculationModal,
  resetDamageCalculationStoreForTests,
  setScheduleDamageReport,
  trackDamageCalculationTask,
} from '@/stores/damage-calculation-store';

const waitForDerivedDataTask = vi.fn();

vi.mock('@/lib/api/derived-data', () => ({
  derivedDataApi: {
    waitForDerivedDataTask: (...args: unknown[]) => waitForDerivedDataTask(...args),
  },
}));

describe('damageCalculationStore', () => {
  const scope = { programId: 'P1', version: 'V1' };
  const queryClient = { invalidateQueries: vi.fn() } as never;

  beforeEach(() => {
    resetDamageCalculationStoreForTests();
    resetDamageCalculationToastEmitterForTests();
    vi.clearAllMocks();
  });

  it('tracks an active damage task and opens the progress modal', () => {
    waitForDerivedDataTask.mockReturnValue(new Promise(() => {}));

    trackDamageCalculationTask({
      scope,
      taskId: 'damage-task-1',
      queryClient,
    });

    const scoped = getDamageCalculationScopeState(scope);
    expect(scoped?.taskId).toBe('damage-task-1');
    expect(scoped?.modalOpen).toBe(true);
    expect(scoped?.wizardStep).toBe('progress');
    expect(isDamageCalculationActive(scope)).toBe(true);
  });

  it('keeps polling when the modal is dismissed', async () => {
    let resolvePoll: ((value: unknown) => void) | undefined;
    waitForDerivedDataTask.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePoll = resolve;
        }),
    );

    trackDamageCalculationTask({ scope, taskId: 'damage-task-1', queryClient });
    dismissDamageCalculationModal(scope);

    expect(getDamageCalculationScopeState(scope)?.modalOpen).toBe(false);
    expect(isDamageCalculationActive(scope)).toBe(true);

    resolvePoll?.({
      task_id: 'damage-task-1',
      task_kind: 'damage_calculation',
      status: 'completed',
      phase: 'completed',
      completed_events: 2,
      total_events: 2,
      result: { processed_events: 2 },
    });

    await vi.waitFor(() => {
      expect(getDamageCalculationScopeState(scope)?.wizardStep).toBe('summary');
    });
  });

  it('stores a validation report for schedule editor highlights', () => {
    setScheduleDamageReport(scope, {
      summary: 'Fix blank repeats.',
      issues: [
        {
          event_id: 'row-1',
          event_name: 'event_042',
          field: 'repeats',
          code: 'blank_repeats',
          message: 'Repeats is required.',
        },
      ],
    });

    expect(getDamageCalculationScopeState(scope)?.scheduleDamageReport?.summary).toBe(
      'Fix blank repeats.',
    );
  });

  it('keeps existing active task scopes when storing a report-only scope', () => {
    waitForDerivedDataTask.mockReturnValue(new Promise(() => {}));
    trackDamageCalculationTask({
      scope: { programId: 'P1', version: 'V1' },
      taskId: 'damage-task-1',
      queryClient,
    });

    setScheduleDamageReport({ programId: 'P2', version: 'V2' }, {
      summary: 'Assign channels first.',
      issues: [],
    });

    expect(getDamageCalculationScopeState({ programId: 'P1', version: 'V1' })?.taskId).toBe(
      'damage-task-1',
    );
    expect(
      getDamageCalculationScopeState({ programId: 'P2', version: 'V2' })?.scheduleDamageReport
        ?.summary,
    ).toBe('Assign channels first.');
  });

  it('replaces an existing prerequisite report when a new report is set', () => {
    setScheduleDamageReport(scope, {
      summary: 'First report',
      issues: [],
    });
    setScheduleDamageReport(scope, {
      summary: 'Updated report',
      issues: [],
    });

    expect(getDamageCalculationScopeState(scope)?.scheduleDamageReport?.summary).toBe(
      'Updated report',
    );
  });

  it('can reopen the modal from the inline banner', () => {
    waitForDerivedDataTask.mockReturnValue(new Promise(() => {}));

    trackDamageCalculationTask({ scope, taskId: 'damage-task-1', queryClient });
    dismissDamageCalculationModal(scope);
    reopenDamageCalculationModal(scope);

    expect(getDamageCalculationScopeState(scope)?.modalOpen).toBe(true);
  });

  it('invalidates inspect damage and schedule-context queries when damage calculation completes', async () => {
    waitForDerivedDataTask.mockResolvedValue({
      task_id: 'damage-task-1',
      task_kind: 'damage_calculation',
      status: 'completed',
      phase: 'completed',
      completed_events: 1,
      total_events: 1,
      result: { processed_events: 1 },
    });

    trackDamageCalculationTask({ scope, taskId: 'damage-task-1', queryClient });
    await vi.waitFor(() => {
      expect(getDamageCalculationScopeState(scope)?.wizardStep).toBe('summary');
    });

    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['damage-inspect'],
    });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['program-version-schedule', 'P1', 'V1'],
    });
  });

  it('uses toast-only feedback for automatic failures', async () => {
    const emitted: Array<{ message: string; tone: string }> = [];
    setDamageCalculationToastEmitterForTests((toastMessage) => {
      emitted.push(toastMessage);
    });
    waitForDerivedDataTask.mockResolvedValue({
      task_id: 'damage-task-1',
      task_kind: 'damage_calculation',
      status: 'failed',
      phase: 'failed',
      completed_events: 0,
      total_events: 1,
      error: 'Damage calculation failed',
    });

    trackDamageCalculationTask({
      scope,
      taskId: 'damage-task-1',
      queryClient,
      origin: 'automatic',
    });
    await vi.waitFor(() => {
      expect(getDamageCalculationScopeState(scope)?.status).toBe('failed');
    });

    expect(emitted).toEqual([
      { message: 'Damage calculation failed', tone: 'error' },
    ]);
    expect(getDamageCalculationScopeState(scope)?.modalOpen).toBe(false);
  });

  it('keeps the modal closed after automatic success when the user dismissed it', async () => {
    waitForDerivedDataTask.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              task_id: 'damage-task-1',
              task_kind: 'damage_calculation',
              status: 'completed',
              phase: 'completed',
              completed_events: 1,
              total_events: 1,
              result: { processed_events: 1 },
            });
          }, 0);
        }),
    );

    trackDamageCalculationTask({
      scope,
      taskId: 'damage-task-1',
      queryClient,
      origin: 'automatic',
    });
    dismissDamageCalculationModal(scope);
    await vi.waitFor(() => {
      expect(getDamageCalculationScopeState(scope)?.status).toBe('completed');
    });

    expect(getDamageCalculationScopeState(scope)?.modalOpen).toBe(false);
  });

  it('clears scoped state after closing the completion summary', async () => {
    waitForDerivedDataTask.mockResolvedValue({
      task_id: 'damage-task-1',
      task_kind: 'damage_calculation',
      status: 'completed',
      phase: 'completed',
      completed_events: 1,
      total_events: 1,
      result: { processed_events: 1 },
    });

    trackDamageCalculationTask({ scope, taskId: 'damage-task-1', queryClient });
    await vi.waitFor(() => {
      expect(getDamageCalculationScopeState(scope)?.wizardStep).toBe('summary');
    });
    closeDamageCalculationSummary(scope);

    expect(getDamageCalculationScopeState(scope)).toBeNull();
    expect(isDamageCalculationActive(scope)).toBe(false);
  });
});
