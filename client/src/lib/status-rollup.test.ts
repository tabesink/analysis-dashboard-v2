import { describe, expect, it } from 'vitest';

import { rollUpStatusFromValues } from '@/lib/status-rollup';

describe('rollUpStatusFromValues', () => {
  it('returns a dash when no statuses are present', () => {
    expect(rollUpStatusFromValues([]).label).toBe('-');
  });

  it('returns the single status when all events agree', () => {
    expect(rollUpStatusFromValues(['Pending', 'Pending']).label).toBe('Pending');
  });

  it('prefers Obsolete over Pending and Approved when mixed', () => {
    expect(rollUpStatusFromValues(['Approved', 'Pending', 'Obsolete']).label).toBe('Obsolete');
  });

  it('prefers Pending over Approved when mixed', () => {
    expect(rollUpStatusFromValues(['Approved', 'Pending']).label).toBe('Pending');
  });
});
