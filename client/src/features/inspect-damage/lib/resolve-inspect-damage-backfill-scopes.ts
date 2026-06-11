import type { DamageInspectResponse, DamageInspectScopeState } from '@/types/api';

export function resolveInspectDamageBackfillScopes(params: {
  response: DamageInspectResponse | null;
  canWrite: boolean;
}): DamageInspectScopeState[] {
  if (!params.canWrite || !params.response) {
    return [];
  }

  return params.response.scopes.filter(
    (scope) =>
      scope.has_active_schedule &&
      scope.can_start_calculation &&
      (scope.needs_damage_repair ??
        (!scope.has_current_results && !scope.has_stale_results)),
  );
}
