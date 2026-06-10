'use client';

import { useCallback, useState } from 'react';
import { uploadApi } from '@/lib/api/upload';
import { buildScopeDeletePlan, type ScopeDeletePlan } from '@/features/database-scope-delete/build-scope-delete-plan';
import { executeScopeDelete } from '@/features/database-scope-delete/execute-scope-delete';
import type {
  ScopeDeleteCompletionResult,
  ScopeDeleteOperationModalProps,
  ScopeDeleteProgressPhase,
  ScopeDeleteWizardStep,
} from '@/features/database-scope-delete/scope-delete-operation-types';
import type { ProgramVersionSummary } from '@/types/upload';

export interface UseScopeDeleteOperationOptions {
  programVersions: ProgramVersionSummary[];
  deleteDatasets: (eventIds: string[]) => Promise<boolean>;
  onComplete: () => void | Promise<void>;
}

export interface UseScopeDeleteOperationReturn {
  openDeleteFlow: (selectedKeys: string[]) => void;
  modalProps: ScopeDeleteOperationModalProps;
  isBusy: boolean;
}

function buildCompletionResult(
  success: boolean,
  result: {
    deletedEventCount: number;
    deletedArtifactCount: number;
    scopeCount: number;
    errorMessage?: string;
  },
  plan: ScopeDeletePlan,
  elapsedSeconds: number,
): ScopeDeleteCompletionResult {
  if (!success) {
    return {
      success: false,
      title: 'Delete failed',
      message: result.errorMessage ?? 'Failed to delete selected data.',
      elapsedSeconds,
    };
  }

  const hasScopeDeletes = plan.summary.hasScopeDeletes;
  const detailLines: string[] = [];
  if (hasScopeDeletes) {
    detailLines.push(
      `${result.scopeCount} scope${result.scopeCount === 1 ? '' : 's'} removed`,
    );
  }
  detailLines.push(
    `${result.deletedEventCount} event${result.deletedEventCount === 1 ? '' : 's'} deleted`,
    `${result.deletedArtifactCount} artifact${result.deletedArtifactCount === 1 ? '' : 's'} deleted`,
  );

  return {
    success: true,
    title: 'Delete complete',
    message: hasScopeDeletes
      ? `Deleted ${result.scopeCount} scope${result.scopeCount === 1 ? '' : 's'}.`
      : `Deleted ${plan.eventIds.length} dataset${plan.eventIds.length === 1 ? '' : 's'}.`,
    elapsedSeconds,
    detailLines,
  };
}

export function useScopeDeleteOperation({
  programVersions,
  deleteDatasets,
  onComplete,
}: UseScopeDeleteOperationOptions): UseScopeDeleteOperationReturn {
  const [open, setOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<ScopeDeleteWizardStep>('confirm');
  const [blocking, setBlocking] = useState(false);
  const [plan, setPlan] = useState<ScopeDeletePlan | null>(null);
  const [progressPhase, setProgressPhase] = useState<ScopeDeleteProgressPhase>('measurements');
  const [progressMessage, setProgressMessage] = useState('Starting…');
  const [completionResult, setCompletionResult] = useState<ScopeDeleteCompletionResult | null>(
    null,
  );
  const [isBusy, setIsBusy] = useState(false);

  const reset = useCallback(() => {
    setWizardStep('confirm');
    setBlocking(false);
    setPlan(null);
    setProgressPhase('measurements');
    setProgressMessage('Starting…');
    setCompletionResult(null);
    setIsBusy(false);
  }, []);

  const openDeleteFlow = useCallback(
    (selectedKeys: string[]) => {
      const nextPlan = buildScopeDeletePlan(selectedKeys, programVersions);
      setPlan(nextPlan);
      setWizardStep('confirm');
      setBlocking(false);
      setCompletionResult(null);
      setOpen(true);
    },
    [programVersions],
  );

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next && blocking) return;
      if (!next) {
        reset();
      }
      setOpen(next);
    },
    [blocking, reset],
  );

  const confirmDelete = useCallback(async () => {
    if (!plan) return;

    setWizardStep('progress');
    setBlocking(true);
    setIsBusy(true);
    setProgressPhase('measurements');
    setProgressMessage('Starting delete…');

    const startedAt = Date.now();
    const result = await executeScopeDelete({
      plan,
      deleteProgramVersionScope: (payload) => uploadApi.deleteProgramVersionScope(payload),
      deleteDatasets: async (eventIds) => {
        const ok = await deleteDatasets(eventIds);
        if (!ok) {
          throw new Error('Failed to delete datasets');
        }
        return { deleted_count: eventIds.length };
      },
      onProgress: ({ phase, message }) => {
        setProgressPhase(phase);
        setProgressMessage(message);
      },
    });

    const elapsedSeconds = (Date.now() - startedAt) / 1000;
    setCompletionResult(buildCompletionResult(result.success, result, plan, elapsedSeconds));
    setWizardStep('summary');
    setBlocking(false);
    setIsBusy(false);

    if (result.success) {
      await onComplete();
    }
  }, [deleteDatasets, onComplete, plan]);

  const closeSummary = useCallback(async () => {
    reset();
    setOpen(false);
  }, [reset]);

  return {
    openDeleteFlow,
    isBusy,
    modalProps: {
      open,
      onOpenChange: handleOpenChange,
      wizardStep,
      blocking,
      plan,
      progressPhase,
      progressMessage,
      completionResult,
      onConfirmDelete: confirmDelete,
      onCloseSummary: closeSummary,
    },
  };
}
