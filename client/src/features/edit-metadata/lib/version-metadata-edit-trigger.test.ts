import { describe, expect, it, vi } from 'vitest';

import {
  buildVersionMetadataEditLabel,
  triggerVersionMetadataEdit,
} from '@/features/edit-metadata/lib/version-metadata-edit-trigger';

describe('version metadata edit trigger', () => {
  it('builds an accessible label with program, version, and event count', () => {
    expect(
      buildVersionMetadataEditLabel({
        programId: 'P1',
        version: 'V1',
        eventCount: 1,
      }),
    ).toBe('Edit metadata for P1 V1 (1 event)');

    expect(
      buildVersionMetadataEditLabel({
        programId: 'P1',
        version: 'V2',
        eventCount: 42,
      }),
    ).toBe('Edit metadata for P1 V2 (42 events)');
  });

  it('stops propagation and opens the dialog with the clicked scope', () => {
    const stopPropagation = vi.fn();
    const openDialog = vi.fn();

    triggerVersionMetadataEdit(
      { stopPropagation },
      { programId: 'P1', version: 'V1' },
      openDialog,
    );

    expect(stopPropagation).toHaveBeenCalledTimes(1);
    expect(openDialog).toHaveBeenCalledWith({ programId: 'P1', version: 'V1' });
  });
});
