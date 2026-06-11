import { describe, expect, it, vi } from 'vitest';

import { invalidateQueriesAfterDamageCalculation } from '@/lib/damage-calculation-cache';

describe('invalidateQueriesAfterDamageCalculation', () => {
  it('invalidates inspect damage and schedule-context queries for the affected scope', async () => {
    const invalidated: string[][] = [];
    const queryClient = {
      invalidateQueries: vi.fn(async ({ queryKey }: { queryKey: string[] }) => {
        invalidated.push(queryKey);
      }),
    };

    await invalidateQueriesAfterDamageCalculation(queryClient as never, {
      programId: 'P1',
      version: 'V1',
    });

    expect(invalidated).toEqual([
      ['damage-inspect'],
      ['program-version-schedule', 'P1', 'V1'],
    ]);
  });
});
