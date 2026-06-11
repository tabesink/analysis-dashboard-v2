import { resolveInspectDamageBackfillScopes } from '@/features/inspect-damage/lib/resolve-inspect-damage-backfill-scopes';
import type { DamageInspectResponse, DamageInspectScopeState } from '@/types/api';

export function inspectDamageScopeKey(scope: Pick<DamageInspectScopeState, 'program_id' | 'version'>): string {
  return `${scope.program_id}::${scope.version}`;
}

export function planInspectDamageBackfillAttempts(params: {
  response: DamageInspectResponse | null;
  canWrite: boolean;
  attemptedScopeKeys: ReadonlySet<string>;
  isScopeActive: (scope: DamageInspectScopeState) => boolean;
}): DamageInspectScopeState[] {
  return resolveInspectDamageBackfillScopes({
    response: params.response,
    canWrite: params.canWrite,
  }).filter((scope) => {
    if (params.isScopeActive(scope)) {
      return false;
    }
    const key = inspectDamageScopeKey(scope);
    if (params.attemptedScopeKeys.has(key) && !scope.active_damage_task_id) {
      return false;
    }
    return true;
  });
}
