import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createDerivedTaskScopeStore } from '@/stores/derived-task-scope-store';

interface TestScope {
  programId: string;
  version: string;
}

interface TestState {
  taskId: string;
  status: 'running' | 'completed' | 'failed';
  modalOpen: boolean;
  wizardStep: 'progress' | 'summary';
  message: string;
}

describe('createDerivedTaskScopeStore', () => {
  const scope = { programId: 'P1', version: 'V1' };
  const pollTask = vi.fn();
  let store: ReturnType<typeof createDerivedTaskScopeStore<TestScope, TestState, { taskId: string }>>;

  beforeEach(() => {
    vi.clearAllMocks();
    store = createDerivedTaskScopeStore({
      createRunningState: ({ taskId }) => ({
        taskId,
        status: 'running',
        modalOpen: true,
        wizardStep: 'progress',
        message: 'Starting',
      }),
      pollTask,
    });
  });

  it('keeps polling after progress modal dismissal', () => {
    pollTask.mockReturnValue(new Promise(() => {}));

    store.track({ scope, taskId: 'task-1' });
    store.dismissModal(scope);

    expect(store.getScopeState(scope)?.modalOpen).toBe(false);
    expect(store.isActive(scope)).toBe(true);
    expect(pollTask).toHaveBeenCalledTimes(1);
  });

  it('reuses active polling when tracking the same task id again', () => {
    pollTask.mockReturnValue(new Promise(() => {}));

    store.track({ scope, taskId: 'task-1' });
    store.dismissModal(scope);
    store.track({ scope, taskId: 'task-1' });

    expect(pollTask).toHaveBeenCalledTimes(1);
    expect(store.getScopeState(scope)?.modalOpen).toBe(true);
  });
});
