import { describe, expect, it } from 'vitest';

import {
  isMetadataDialogSectionActive,
  metadataDialogSectionNavClassName,
} from '@/features/edit-metadata/lib/metadata-dialog-sections';

describe('metadata dialog sections', () => {
  it('marks only the active section as visible', () => {
    expect(isMetadataDialogSectionActive('edit-metadata', 'edit-metadata')).toBe(true);
    expect(isMetadataDialogSectionActive('edit-metadata', 'assign-channels')).toBe(false);
    expect(isMetadataDialogSectionActive('edit-metadata', 'durability-schedule')).toBe(false);
    expect(isMetadataDialogSectionActive('assign-channels', 'assign-channels')).toBe(true);
    expect(isMetadataDialogSectionActive('durability-schedule', 'durability-schedule')).toBe(true);
  });

  it('applies active styling only to the selected nav item', () => {
    expect(metadataDialogSectionNavClassName(true)).toContain('bg-[var(--secondary)]');
    expect(metadataDialogSectionNavClassName(false)).toContain('hover:bg-[var(--secondary)]/60');
    expect(metadataDialogSectionNavClassName(false)).not.toMatch(/\sbg-\[var\(--secondary\)\]/);
  });
});
