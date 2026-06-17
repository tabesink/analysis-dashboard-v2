"use client";

import type { QueryClient } from "@tanstack/react-query";

import { buildChannelReprocessCompletionResult } from "@/features/edit-metadata/lib/channel-reprocess-completion";
import { applyChannelReprocessPrecomputeFollowUp } from "@/features/edit-metadata/lib/channel-reprocess-follow-up";
import { mapDerivedTaskProgress } from "@/features/edit-metadata/lib/derived-task-progress";
import type { ChannelReprocessProgressPhase } from "@/features/edit-metadata/lib/derived-task-progress";
import { derivedDataApi } from "@/lib/api/derived-data";
import { invalidateQueriesAfterChannelMapSave } from "@/lib/channel-map-save-cache";
import type { UploadCompletionResult } from "@/features/database-upload/upload-operation-types";
import {
  createDerivedTaskScopeStore,
  type DerivedTaskStoreState,
} from "@/stores/derived-task-scope-store";

export interface ChannelReprocessScope {
  programId: string;
  version: string;
}

export type ChannelReprocessWizardStep = "progress" | "summary";

export interface ChannelReprocessScopeState {
  taskId: string;
  status: "running" | "cancelling" | "completed" | "failed" | "cancelled";
  modalOpen: boolean;
  wizardStep: ChannelReprocessWizardStep;
  progress: number;
  progressPhase: ChannelReprocessProgressPhase;
  progressMessage: string;
  completionResult: UploadCompletionResult | null;
}

type ChannelReprocessStoreState = {
  scopes: Record<string, ChannelReprocessScopeState>;
};

async function pollChannelReprocessTask(
  params: {
    scope: ChannelReprocessScope;
    taskId: string;
    queryClient: QueryClient;
  },
  helpers: {
    updateScope: (
      updater: (current: ChannelReprocessScopeState) => ChannelReprocessScopeState,
    ) => void;
  },
): Promise<void> {
  try {
    const finalEvent = await derivedDataApi.waitForDerivedDataTask(params.taskId, (event) => {
      const mapped = mapDerivedTaskProgress(event);
      helpers.updateScope((current) => ({
        ...current,
        status: event.status === "cancelling" ? "cancelling" : current.status,
        progress: mapped.progress,
        progressPhase: mapped.progressPhase,
        progressMessage: mapped.progressMessage,
      }));
    });

    await invalidateQueriesAfterChannelMapSave(params.queryClient);

    applyChannelReprocessPrecomputeFollowUp({
      scope: params.scope,
      queryClient: params.queryClient,
      result: finalEvent.result,
    });

    const completionResult = buildChannelReprocessCompletionResult(finalEvent);
    const terminalStatus =
      finalEvent.status === "failed"
        ? "failed"
        : finalEvent.status === "cancelled"
          ? "cancelled"
          : "completed";
    helpers.updateScope((current) => ({
      ...current,
      status: terminalStatus,
      wizardStep: "summary",
      progress: 100,
      progressMessage: completionResult.message,
      completionResult,
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Channel reprocess failed";
    helpers.updateScope((current) => ({
      ...current,
      status: "failed",
      wizardStep: "summary",
      completionResult: {
        success: false,
        title: "Channel reprocess failed",
        message,
      },
    }));
  }
}

const channelReprocessStore = createDerivedTaskScopeStore<
  ChannelReprocessScope,
  ChannelReprocessScopeState,
  {
    scope: ChannelReprocessScope;
    taskId: string;
    queryClient: QueryClient;
    reopenExisting?: boolean;
  }
>({
  createRunningState: (params) => ({
    taskId: params.taskId,
    status: "running",
    modalOpen: true,
    wizardStep: "progress",
    progress: 0,
    progressPhase: "validating",
    progressMessage: params.reopenExisting
      ? "Resuming channel reprocess progress…"
      : "Starting channel reprocess…",
    completionResult: null,
  }),
  pollTask: pollChannelReprocessTask,
});

export function useChannelReprocessStore<T = ChannelReprocessStoreState>(
  selector: (value: ChannelReprocessStoreState) => T = (value) => value as T,
): T {
  return channelReprocessStore.useStore(
    selector as (value: DerivedTaskStoreState<ChannelReprocessScopeState>) => T,
  );
}

export function getChannelReprocessScopeState(
  scope: ChannelReprocessScope,
): ChannelReprocessScopeState | null {
  return channelReprocessStore.getScopeState(scope);
}

export function isChannelReprocessActive(scope: ChannelReprocessScope): boolean {
  return channelReprocessStore.isActive(scope);
}

export function reopenChannelReprocessModal(scope: ChannelReprocessScope): void {
  channelReprocessStore.reopenModal(scope);
}

export function dismissChannelReprocessModal(scope: ChannelReprocessScope): void {
  channelReprocessStore.dismissModal(scope);
}

export function closeChannelReprocessSummary(scope: ChannelReprocessScope): void {
  channelReprocessStore.closeSummary(scope);
}

export function trackChannelReprocessTask(params: {
  scope: ChannelReprocessScope;
  taskId: string;
  queryClient: QueryClient;
  reopenExisting?: boolean;
}): void {
  channelReprocessStore.track(params);
}

export function resetChannelReprocessStoreForTests(): void {
  channelReprocessStore.resetForTests();
}
