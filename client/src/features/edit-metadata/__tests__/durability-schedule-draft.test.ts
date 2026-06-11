import { describe, expect, it } from 'vitest';

import type { DurabilityScheduleRow } from '@/features/edit-metadata/lib/build-durability-schedule-rows';
import {
  isDurabilityScheduleDirty,
  parseOptionalScheduleNumber,
} from '@/features/edit-metadata/lib/durability-schedule-draft';

const sampleRow: DurabilityScheduleRow = {
  id: 'row-1',
  rspFileName: 'event.rsp',
  rspEventName: 'event',
  schedulePattern: 'P1',
  weight: 1,
  repeats: 2,
  scheduleSequence: 3,
};

describe('parseOptionalScheduleNumber', () => {
  it('returns null for blank input', () => {
    expect(parseOptionalScheduleNumber('')).toBeNull();
    expect(parseOptionalScheduleNumber('   ')).toBeNull();
  });

  it('parses finite numbers', () => {
    expect(parseOptionalScheduleNumber('1.5')).toBe(1.5);
    expect(parseOptionalScheduleNumber('42')).toBe(42);
  });
});

describe('isDurabilityScheduleDirty', () => {
  it('returns false when draft matches baseline', () => {
    expect(isDurabilityScheduleDirty([sampleRow], [sampleRow], 2, 2)).toBe(false);
  });

  it('returns true when multiplier differs', () => {
    expect(isDurabilityScheduleDirty([sampleRow], [sampleRow], 3, 2)).toBe(true);
  });

  it('returns true when row content differs', () => {
    const edited = [{ ...sampleRow, rspEventName: 'changed' }];
    expect(isDurabilityScheduleDirty(edited, [sampleRow], 2, 2)).toBe(true);
  });
});
