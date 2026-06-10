import { describe, expect, it } from 'vitest';

import { isStatusField } from '../lib/metadata-field-helpers';

describe('isStatusField', () => {
  it('returns true when display name is status regardless of casing', () => {
    expect(isStatusField('Status', { column: 'event_status' })).toBe(true);
    expect(isStatusField('status', { column: 'program_id' })).toBe(true);
  });

  it('returns true when column is status even if display name differs', () => {
    expect(isStatusField('Approval State', { column: 'status' })).toBe(true);
  });

  it('returns false for non-status metadata fields', () => {
    expect(isStatusField('Program ID', { column: 'program_id' })).toBe(false);
    expect(isStatusField('Steering', { column: 'steering' })).toBe(false);
  });
});
