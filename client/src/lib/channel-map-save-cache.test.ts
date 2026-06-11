import { describe, expect, it, vi } from 'vitest';

import {
  CHANNEL_MAP_SAVE_INVALIDATION_KEYS,
  invalidateQueriesAfterChannelMapSave,
} from '@/lib/channel-map-save-cache';

describe('invalidateQueriesAfterChannelMapSave', () => {
  it('invalidates channel-map editor and database-table queries after save', async () => {
    const invalidated: string[] = [];
    const queryClient = {
      invalidateQueries: vi.fn(async ({ queryKey }: { queryKey: string[] }) => {
        invalidated.push(queryKey[0]);
      }),
    };

    await invalidateQueriesAfterChannelMapSave(queryClient as never);

    expect(invalidated).toEqual([...CHANNEL_MAP_SAVE_INVALIDATION_KEYS]);
    expect(invalidated).toContain('channel-map-editor');
    expect(invalidated).toContain('datasets');
    expect(invalidated).toContain('program-version-events');
    expect(invalidated).toContain('all-events');
    expect(invalidated).toContain('event-catalog');
  });
});
