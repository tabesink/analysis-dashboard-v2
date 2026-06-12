import type { DamageInspectResponse, DamageInspectScopeState } from '@/types/api';

export function planInspectDamageBackfillAttempts(params: {
  response: DamageInspectResponse | null;
  canWrite: boolean;
  attemptedScopeKeys: ReadonlySet<string>;
  isScopeActive: (scope: DamageInspectScopeState) => boolean;
}): DamageInspectScopeState[] {
  void params;
  return [];
}
