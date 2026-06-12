import type { QueryClient } from '@tanstack/react-query';

import { applyDamageTaskResponse } from '@/features/edit-metadata/lib/apply-damage-task-response';
import type { DamageCalculationTaskOrigin } from '@/features/edit-metadata/lib/damage-calculation-task-completion';
import type { DamageCalculationScope } from '@/lib/damage-calculation-cache';
import type { DamageCalculateResponse } from '@/types/api';

export function applyInspectDamageCalculateResponse(params: {
  scope: DamageCalculationScope;
  response: DamageCalculateResponse;
  queryClient: QueryClient;
  origin?: DamageCalculationTaskOrigin;
}): 'damage_task' | 'prerequisite_report' | 'none' {
  return applyDamageTaskResponse({
    scope: params.scope,
    response: params.response,
    queryClient: params.queryClient,
    origin: params.origin ?? 'manual',
  });
}
