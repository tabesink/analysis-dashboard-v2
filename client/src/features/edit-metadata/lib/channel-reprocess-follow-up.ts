import type { QueryClient } from '@tanstack/react-query';

import { applyDamageTaskResponse } from '@/features/edit-metadata/lib/apply-damage-task-response';
import type { DamageCalculationScope } from '@/lib/damage-calculation-cache';
import type { DamageFailureReport } from '@/types/api';

interface ChannelReprocessPrecomputeFollowUp {
  damage_task_id?: string;
  damage_prerequisite_report?: DamageFailureReport;
}

function readPrecomputeFollowUp(
  result: Record<string, unknown> | null | undefined,
): ChannelReprocessPrecomputeFollowUp | null {
  if (!result || typeof result !== 'object') {
    return null;
  }
  const followUp = result.precompute_follow_up;
  if (!followUp || typeof followUp !== 'object') {
    return null;
  }
  return followUp as ChannelReprocessPrecomputeFollowUp;
}

export function applyChannelReprocessPrecomputeFollowUp(params: {
  scope: DamageCalculationScope;
  queryClient: QueryClient;
  result: Record<string, unknown> | null | undefined;
}): void {
  const followUp = readPrecomputeFollowUp(params.result);
  if (!followUp) {
    return;
  }

  if (followUp.damage_task_id) {
    applyDamageTaskResponse({
      scope: params.scope,
      response: followUp,
      queryClient: params.queryClient,
      origin: 'automatic',
      openModal: true,
    });
    return;
  }

  if (followUp.damage_prerequisite_report) {
    applyDamageTaskResponse({
      scope: params.scope,
      response: followUp,
      queryClient: params.queryClient,
      origin: 'automatic',
    });
  }
}
