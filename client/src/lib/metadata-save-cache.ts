import type { QueryClient } from '@tanstack/react-query';

/** Queries that derive dropdowns/tables from dim_event rows in the active database. */
export const DATABASE_DATA_INVALIDATION_KEYS = [
  'program-version-events',
  'datasets',
  'event-catalog',
  'all-events',
  'versions',
  'program-ids',
  'filter-options',
  'sync-version',
] as const;

/** @deprecated Use DATABASE_DATA_INVALIDATION_KEYS */
export const METADATA_SAVE_INVALIDATION_KEYS = DATABASE_DATA_INVALIDATION_KEYS;

export async function invalidateDatabaseDataQueries(
  queryClient: QueryClient
): Promise<void> {
  for (const queryKey of DATABASE_DATA_INVALIDATION_KEYS) {
    await queryClient.invalidateQueries({ queryKey: [queryKey] });
  }
}

export async function invalidateQueriesAfterMetadataSave(
  queryClient: QueryClient
): Promise<void> {
  await invalidateDatabaseDataQueries(queryClient);
}
