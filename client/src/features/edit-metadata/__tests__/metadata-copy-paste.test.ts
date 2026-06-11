import { describe, expect, it } from 'vitest';

import type { FilterOptions } from '@/types/api';

import {
  applyMetadataPaste,
  buildCopyableMetadataKeys,
  snapshotMetadataForCopy,
} from '../lib/metadata-copy-paste';

const filterOptions: FilterOptions = {
  Status: { column: 'status', values: ['Draft', 'Approved'], order: 0, source: 'core' },
  'Steering Position': {
    column: 'steering_position',
    values: ['LHD', 'RHD'],
    order: 1,
    source: 'core',
  },
};

describe('buildCopyableMetadataKeys', () => {
  it('includes non-status metadata fields and raw weight labels', () => {
    expect(buildCopyableMetadataKeys(filterOptions)).toEqual([
      'Steering Position',
      'GVW (lbs)',
      'FGAWR (lbs)',
      'RGAWR (lbs)',
    ]);
  });
});

describe('snapshotMetadataForCopy', () => {
  it('captures only the copyable keys from the current draft', () => {
    const snapshot = snapshotMetadataForCopy(
      {
        Status: 'Draft',
        'Steering Position': 'LHD',
        'GVW (lbs)': '4000',
      },
      ['Steering Position', 'GVW (lbs)'],
    );

    expect(snapshot).toEqual({
      'Steering Position': 'LHD',
      'GVW (lbs)': '4000',
    });
  });
});

describe('applyMetadataPaste', () => {
  it('merges clipboard values and marks pasted keys dirty', () => {
    const result = applyMetadataPaste(
      { 'Steering Position': 'LHD', 'GVW (lbs)': '' },
      { 'Steering Position': 'RHD', 'GVW (lbs)': '5000' },
      ['Steering Position', 'GVW (lbs)'],
    );

    expect(result.nextDraft).toEqual({
      'Steering Position': 'RHD',
      'GVW (lbs)': '5000',
    });
    expect(result.dirtyKeys).toEqual(['Steering Position', 'GVW (lbs)']);
  });
});
