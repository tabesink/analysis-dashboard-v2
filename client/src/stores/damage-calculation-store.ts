"use client";

import type { QueryClient } from "@tanstack/react-query";

import type { DamageCalculationCompletionResult } from "@/features/edit-metadata/lib/damage-calculation-completion";
import { resolveDamageCalculationCompletionBehavior } from "@/features/edit-metadata/lib/damage-calculation-task-completion";
import type { DamageCalculationTaskOrigin } from "@/features/edit-metadata/lib/damage-calculation-task-completion";
import { mapDamageCalculationProgress } from "@/features/edit-metadata/lib/damage-calculation-progress";
import type { DamageCalculationProgressPhase } from "@/features/edit-metadata/lib/damage-calculation-progress";
import { emitDamageCalculationCompletionToast } from "@/features/edit-metadata/lib/damage-calculation-feedback";
import { derivedDataApi } from "@/lib/api/derived-data";
import {
  invalidateQueriesAfterDamageCalculation,
  type DamageCalculationScope,
} from "@/lib/damage-calculation-cache";
import {
  createDerivedTaskScopeStore,
  formatProgramVersionScopeKey,
  type DerivedTaskStoreState,
} from "@/stores/derived-task-scope-store";
import type { DamageFailureReport } from "@/types/api";

export type DamageCalculationWizardStep = "progress" | "summary";

export interface DamageCalculationScopeState {
  taskId: string;
  status: "running" | "cancelling" | "completed" | "failed" | "cancelled";
  origin: DamageCalculationTaskOrigin;
  modalOpen: boolean;
  wizardStep: DamageCalculationWizardStep;
  progress: number;
  progressPhase: DamageCalculationProgressPhase;
  progressMessage: string;
  completionResult: DamageCalculationCompletionResult | null;
  scheduleDamageReport: DamageFailureReport | null;
}

type DamageCalculationStoreState = {
  scopes: Record<string, DamageCalculationScopeState>;
};

async function pollDamageCalculationTask(
  params: {
    scope: DamageCalculationScope;
    taskId: string;
    queryClient: QueryClient;
    reopenExisting?: boolean;
    origin?: DamageCalculationTaskOrigin;
    openModal?: boolean;
  },
  helpers: {
    updateScope: (
      updater: (current: DamageCalculationScopeState) => DamageCalculationScopeState,
    ) => void;
    getScopeState: () => DamageCalculationScopeState | null;
  },
): Promise<void> {
  try {
    const finalEvent = await derivedDataApi.waitForDerivedDataTask(params.taskId, (event) => {
      const mapped = mapDamageCalculationProgress(event);
      helpers.updateScope((current) => ({
        ...current,
        status: event.status === "cancelling" ? "cancelling" : current.status,
        progress: mapped.progress,
        progressPhase: mapped.progressPhase,
        progressMessage: mapped.progressMessage,
      }));
    });

    const current = helpers.getScopeState();
    const resolved = resolveDamageCalculationCompletionBehavior({
      event: finalEvent,
      origin: current?.origin ?? "manual",
      modalWasOpen: current?.modalOpen ?? true,
    });

    if (resolved.toast) {
      emitDamageCalculationCompletionToast(resolved.toast);
    }

    helpers.updateScope((scopeState) => ({
      ...scopeState,
      status:
        finalEvent.status === "cancelled"
          ? "cancelled"
          : resolved.status,
      wizardStep: "summary",
      progress: 100,
      progressMessage: resolved.completionResult.message,
      completionResult: resolved.completionResult,
      scheduleDamageReport:
        resolved.completionResult.failureReport ??
        (resolved.status === "failed" ? scopeState.scheduleDamageReport : null),
      modalOpen: resolved.modalOpen,
    }));

    if (resolved.status === "completed") {
      await invalidateQueriesAfterDamageCalculation(params.queryClient, params.scope);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Damage calculation failed";
    helpers.updateScope((current) => ({
      ...current,
      status: "failed",
      wizardStep: "summary",
      completionResult: {
        success: false,
        title: "Damage calculation failed",
        message,
      },
      modalOpen: true,
    }));
  }
}

const damageCalculationStore = createDerivedTaskScopeStore<
  DamageCalculationScope,
  DamageCalculationScopeState,
  {
    scope: DamageCalculationScope;
    taskId: string;
    queryClient: QueryClient;
    reopenExisting?: boolean;
    origin?: DamageCalculationTaskOrigin;
    openModal?: boolean;
  }
>({
  createRunningState: (params) => ({
    taskId: params.taskId,
    status: "running",
    origin: params.origin ?? "manual",
    modalOpen: params.openModal ?? true,
    wizardStep: "progress",
    progress: 0,
    progressPhase: "validating",
    progressMessage: params.reopenExisting
      ? "Resuming damage calculation progress…"
      : "Starting damage calculation…",
    completionResult: null,
    scheduleDamageReport: null,
  }),
  pollTask: pollDamageCalculationTask,
  closeSummary: (current) => {
    if (!current.scheduleDamageReport) {
      return null;
    }
    return {
      taskId: "",
      status: "failed",
      origin: current.origin,
      modalOpen: false,
      wizardStep: "summary",
      progress: 0,
      progressPhase: "validating",
      progressMessage: "",
      completionResult: null,
      scheduleDamageReport: current.scheduleDamageReport,
    };
  },
});

export function useDamageCalculationStore<T = DamageCalculationStoreState>(
  selector: (value: DamageCalculationStoreState) => T = (value) => value as T,
): T {
  return damageCalculationStore.useStore(
    selector as (value: DerivedTaskStoreState<DamageCalculationScopeState>) => T,
  );
}

export function getDamageCalculationScopeState(
  scope: DamageCalculationScope,
): DamageCalculationScopeState | null {
  return damageCalculationStore.getScopeState(scope);
}

export function isDamageCalculationActive(scope: DamageCalculationScope): boolean {
  return damageCalculationStore.isActive(scope);
}

export function setScheduleDamageReport(
  scope: DamageCalculationScope,
  report: DamageFailureReport | null,
): void {
  const current = damageCalculationStore.getScopeState(scope);
  if (current) {
    damageCalculationStore.updateScopeByKey(formatProgramVersionScopeKey(scope), (value) => ({
      ...value,
      scheduleDamageReport: report,
    }));
    return;
  }

  if (!report) {
    return;
  }

  damageCalculationStore.setScopeState(scope, {
    taskId: "",
    status: "failed",
    origin: "manual",
    modalOpen: false,
    wizardStep: "summary",
    progress: 0,
    progressPhase: "validating",
    progressMessage: "",
    completionResult: null,
    scheduleDamageReport: report,
  });
}

export function reopenDamageCalculationModal(scope: DamageCalculationScope): void {
  damageCalculationStore.reopenModal(scope);
}

export function dismissDamageCalculationModal(scope: DamageCalculationScope): void {
  damageCalculationStore.dismissModal(scope);
}

export function closeDamageCalculationSummary(scope: DamageCalculationScope): void {
  damageCalculationStore.closeSummary(scope);
}

export function trackDamageCalculationTask(params: {
  scope: DamageCalculationScope;
  taskId: string;
  queryClient: QueryClient;
  reopenExisting?: boolean;
  origin?: DamageCalculationTaskOrigin;
  openModal?: boolean;
}): void {
  damageCalculationStore.track(params);
}

export function resetDamageCalculationStoreForTests(): void {
  damageCalculationStore.resetForTests();
}
