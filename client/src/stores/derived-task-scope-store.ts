'use client';

import { useSyncExternalStore } from 'react';

export interface ProgramVersionScope {
  programId: string;
  version: string;
}

export interface DerivedTaskScopeStateBase {
  taskId: string;
  status: 'running' | 'cancelling' | 'completed' | 'failed' | 'cancelled';
  modalOpen: boolean;
  wizardStep: 'progress' | 'summary';
}

export type DerivedTaskStoreState<TState> = {
  scopes: Record<string, TState>;
};

export interface DerivedTaskTrackParams<TScope extends ProgramVersionScope> {
  scope: TScope;
  taskId: string;
}

export interface DerivedTaskScopeStoreOptions<
  TScope extends ProgramVersionScope,
  TState extends DerivedTaskScopeStateBase,
  TTrackParams extends DerivedTaskTrackParams<TScope>,
> {
  createRunningState: (params: TTrackParams) => TState;
  pollTask: (
    params: TTrackParams,
    helpers: {
      scopeKey: string;
      updateScope: (updater: (current: TState) => TState) => void;
      getScopeState: () => TState | null;
    },
  ) => Promise<void>;
  closeSummary?: (current: TState) => TState | null;
}

export function formatProgramVersionScopeKey(scope: ProgramVersionScope): string {
  return `${scope.programId}::${scope.version}`;
}

export function parseProgramVersionScopeKey(key: string): ProgramVersionScope {
  const separatorIndex = key.indexOf('::');
  return {
    programId: key.slice(0, separatorIndex),
    version: key.slice(separatorIndex + 2),
  };
}

export function createDerivedTaskScopeStore<
  TScope extends ProgramVersionScope,
  TState extends DerivedTaskScopeStateBase,
  TTrackParams extends DerivedTaskTrackParams<TScope>,
>({
  createRunningState,
  pollTask,
  closeSummary,
}: DerivedTaskScopeStoreOptions<TScope, TState, TTrackParams>) {
  const listeners = new Set<() => void>();
  let state: DerivedTaskStoreState<TState> = { scopes: {} };
  const activePolls = new Map<string, Promise<void>>();

  function emit() {
    listeners.forEach((listener) => listener());
  }

  function setState(next: DerivedTaskStoreState<TState>) {
    state = next;
    emit();
  }

  function updateScopeByKey(
    key: string,
    updater: (current: TState) => TState,
  ) {
    const current = state.scopes[key];
    if (!current) {
      return;
    }
    setState({
      scopes: {
        ...state.scopes,
        [key]: updater(current),
      },
    });
  }

  function removeScopeByKey(key: string) {
    setState({
      scopes: Object.fromEntries(
        Object.entries(state.scopes).filter(([entryKey]) => entryKey !== key),
      ),
    });
  }

  function setScopeState(scope: TScope, next: TState) {
    setState({
      scopes: {
        ...state.scopes,
        [formatProgramVersionScopeKey(scope)]: next,
      },
    });
  }

  function useStore<T = DerivedTaskStoreState<TState>>(
    selector: (value: DerivedTaskStoreState<TState>) => T = (value) => value as T,
  ): T {
    return useSyncExternalStore(
      (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      () => selector(state),
      () => selector(state),
    );
  }

  function getScopeState(scope: TScope): TState | null {
    return state.scopes[formatProgramVersionScopeKey(scope)] ?? null;
  }

  function isActive(scope: TScope): boolean {
    const status = getScopeState(scope)?.status;
    return status === 'running' || status === 'cancelling';
  }

  function reopenModal(scope: TScope): void {
    updateScopeByKey(formatProgramVersionScopeKey(scope), (value) => ({
      ...value,
      modalOpen: true,
      wizardStep:
        value.status === 'running' || value.status === 'cancelling'
          ? 'progress'
          : 'summary',
    }));
  }

  function dismissModal(scope: TScope): void {
    updateScopeByKey(formatProgramVersionScopeKey(scope), (value) => ({
      ...value,
      modalOpen: false,
    }));
  }

  function closeSummaryForScope(scope: TScope): void {
    const key = formatProgramVersionScopeKey(scope);
    const current = state.scopes[key];
    if (!current) {
      return;
    }
    const next = closeSummary?.(current) ?? null;
    if (next) {
      setState({
        scopes: {
          ...state.scopes,
          [key]: next,
        },
      });
      return;
    }
    removeScopeByKey(key);
  }

  function track(params: TTrackParams): void {
    const key = formatProgramVersionScopeKey(params.scope);
    const existing = state.scopes[key];

    if (existing?.taskId === params.taskId && activePolls.has(params.taskId)) {
      reopenModal(params.scope);
      return;
    }

    setState({
      scopes: {
        ...state.scopes,
        [key]: createRunningState(params),
      },
    });

    if (!activePolls.has(params.taskId)) {
      const activePoll = pollTask(params, {
        scopeKey: key,
        updateScope: (updater) => updateScopeByKey(key, updater),
        getScopeState: () => state.scopes[key] ?? null,
      }).finally(() => {
        activePolls.delete(params.taskId);
      });
      activePolls.set(params.taskId, activePoll);
    }
  }

  function resetForTests(): void {
    state = { scopes: {} };
    activePolls.clear();
    emit();
  }

  return {
    useStore,
    getScopeState,
    isActive,
    reopenModal,
    dismissModal,
    closeSummary: closeSummaryForScope,
    track,
    resetForTests,
    updateScopeByKey,
    setState,
    setScopeState,
  };
}
