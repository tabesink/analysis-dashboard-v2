import type { QueryClient } from '@tanstack/react-query';

export interface DamageCalculationScope {
  programId: string;
  version: string;
}

export async function invalidateQueriesAfterDamageCalculation(
  queryClient: QueryClient,
  scope: DamageCalculationScope,
): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: ['damage-inspect'] });
  await queryClient.invalidateQueries({
    queryKey: ['program-version-schedule', scope.programId, scope.version],
  });
}
