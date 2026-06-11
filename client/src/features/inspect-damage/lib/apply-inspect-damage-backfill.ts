import type { QueryClient } from '@tanstack/react-query';

import { applyInspectDamageCalculateResponse } from '@/features/inspect-damage/lib/apply-inspect-damage-calculate';
import { damageApi } from '@/lib/api/damage';
import { trackDamageCalculationTask } from '@/stores/damage-calculation-store';
import type { DamageInspectScopeState } from '@/types/api';

export async function applyInspectDamageBackfill(params: {
  scope: DamageInspectScopeState;
  queryClient: QueryClient;
}): Promise<'damage_task' | 'prerequisite_report' | 'reused_active_task' | 'none'> {
  const calculationScope = {
    programId: params.scope.program_id,
    version: params.scope.version,
  };

  if (params.scope.active_damage_task_id) {
    trackDamageCalculationTask({
      scope: calculationScope,
      taskId: params.scope.active_damage_task_id,
      queryClient: params.queryClient,
      reopenExisting: true,
      origin: 'automatic',
    });
    return 'reused_active_task';
  }

  const response = await damageApi.backfill(params.scope.program_id, params.scope.version);
  const result = applyInspectDamageCalculateResponse({
    scope: calculationScope,
    response,
    queryClient: params.queryClient,
    origin: 'automatic',
  });
  return result;
}
