import type { QueryClient } from '@tanstack/react-query';

import { DATABASE_DATA_INVALIDATION_KEYS } from '@/lib/metadata-save-cache';

/** Queries refreshed after a successful channel-map save. */
export const CHANNEL_MAP_SAVE_INVALIDATION_KEYS = [
  'channel-map-editor',
  ...DATABASE_DATA_INVALIDATION_KEYS,
] as const;

export async function invalidateQueriesAfterChannelMapSave(
  queryClient: QueryClient,
): Promise<void> {
  for (const queryKey of CHANNEL_MAP_SAVE_INVALIDATION_KEYS) {
    await queryClient.invalidateQueries({ queryKey: [queryKey] });
  }
}
