import { describe, expect, it } from 'vitest';

import { buildBlockedPrecomputeToastMessage } from '@/features/edit-metadata/lib/blocked-precompute-feedback';

describe('buildBlockedPrecomputeToastMessage', () => {
  it('names the program/version scope and the missing prerequisite at a high level', () => {
    const message = buildBlockedPrecomputeToastMessage({
      programId: 'P1',
      version: 'V1',
      report: {
        summary: 'Damage calculation prerequisites are not met',
        issues: [
          {
            field: 'event_id',
            code: 'missing_raw_load_histories',
            message: 'Raw load histories are missing or stale for event_042.',
          },
        ],
      },
    });

    expect(message).toContain('P1 / V1');
    expect(message).toContain('channel assignment');
  });

  it('falls back to the report summary when no known prerequisite code is present', () => {
    const message = buildBlockedPrecomputeToastMessage({
      programId: 'P2',
      version: 'V2',
      report: {
        summary: 'Schedule validation failed before damage calculation.',
        issues: [],
      },
    });

    expect(message).toContain('P2 / V2');
    expect(message).toContain('Schedule validation failed before damage calculation.');
  });
});
