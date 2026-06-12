import type { QueryClient } from '@tanstack/react-query';

import { emitBlockedPrecomputeToast } from '@/features/edit-metadata/lib/blocked-precompute-feedback';
import type { DamageCalculationTaskOrigin } from '@/features/edit-metadata/lib/damage-calculation-task-completion';
import {
  setScheduleDamageReport,
  trackDamageCalculationTask,
} from '@/stores/damage-calculation-store';
import type { DamageCalculationScope } from '@/lib/damage-calculation-cache';
import type { DamageFailureReport } from '@/types/api';

export interface DamageTaskResponsePayload {
  damage_task_id?: string | null;
  damage_prerequisite_report?: DamageFailureReport | null;
}

export type DamageTaskResponseResult = 'damage_task' | 'prerequisite_report' | 'none';

export function applyDamageTaskResponse(params: {
  scope: DamageCalculationScope;
  response: DamageTaskResponsePayload;
  queryClient: QueryClient;
  origin: DamageCalculationTaskOrigin;
  openModal?: boolean;
}): DamageTaskResponseResult {
  if (params.response.damage_task_id) {
    setScheduleDamageReport(params.scope, null);
    const trackParams = {
      scope: params.scope,
      taskId: params.response.damage_task_id,
      queryClient: params.queryClient,
      origin: params.origin,
      ...(params.openModal === undefined ? {} : { openModal: params.openModal }),
    };
    trackDamageCalculationTask({
      ...trackParams,
    });
    return 'damage_task';
  }

  if (params.response.damage_prerequisite_report) {
    setScheduleDamageReport(params.scope, params.response.damage_prerequisite_report);
    emitBlockedPrecomputeToast({
      programId: params.scope.programId,
      version: params.scope.version,
      report: params.response.damage_prerequisite_report,
    });
    return 'prerequisite_report';
  }

  return 'none';
}
