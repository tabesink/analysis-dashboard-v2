import type { QueryClient } from '@tanstack/react-query';

import { applyDamageTaskResponse } from '@/features/edit-metadata/lib/apply-damage-task-response';
import { resolveScheduleDamageResponse } from '@/features/edit-metadata/lib/schedule-damage-response';
import type { DamageCalculationScope } from '@/lib/damage-calculation-cache';
import type { DurabilityScheduleContextResponse } from '@/types/api';

export function applyScheduleDamageResponse(params: {
  scope: DamageCalculationScope;
  response: DurabilityScheduleContextResponse;
  queryClient: QueryClient;
}): ReturnType<typeof resolveScheduleDamageResponse> {
  const resolved = resolveScheduleDamageResponse(params.response);

  if (resolved.kind === 'damage_task') {
    applyDamageTaskResponse({
      scope: params.scope,
      response: { damage_task_id: resolved.taskId },
      queryClient: params.queryClient,
      origin: 'automatic',
    });
    return resolved;
  }

  if (resolved.kind === 'prerequisite_report') {
    applyDamageTaskResponse({
      scope: params.scope,
      response: { damage_prerequisite_report: resolved.report },
      queryClient: params.queryClient,
      origin: 'automatic',
    });
    return resolved;
  }

  return resolved;
}
