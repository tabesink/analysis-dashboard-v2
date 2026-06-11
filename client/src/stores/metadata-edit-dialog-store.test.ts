import { beforeEach, describe, expect, it } from 'vitest';

import {
  applyPendingMetadataEditDialogScope,
  clearPendingMetadataEditDialogScope,
  closeMetadataEditDialog,
  getMetadataEditDialogSnapshot,
  openMetadataEditDialog,
  setMetadataEditDialogOpen,
} from '@/stores/metadata-edit-dialog-store';

describe('metadata edit dialog store', () => {
  beforeEach(() => {
    closeMetadataEditDialog();
  });

  it('opens with the requested program/version scope', () => {
    openMetadataEditDialog({ programId: 'P1', version: 'V1' });

    expect(getMetadataEditDialogSnapshot()).toEqual({
      isOpen: true,
      programId: 'P1',
      version: 'V1',
      pendingScope: null,
      pendingSection: null,
    });
  });

  it('queues a pending scope when opened again while already open', () => {
    openMetadataEditDialog({ programId: 'P1', version: 'V1' });
    openMetadataEditDialog({ programId: 'P2', version: 'V2' });

    expect(getMetadataEditDialogSnapshot()).toEqual({
      isOpen: true,
      programId: 'P1',
      version: 'V1',
      pendingScope: { programId: 'P2', version: 'V2' },
      pendingSection: null,
    });
  });

  it('ignores onOpenChange(false) so dirty-close can stay in control', () => {
    openMetadataEditDialog({ programId: 'P1', version: 'V1' });
    setMetadataEditDialogOpen(false);

    expect(getMetadataEditDialogSnapshot()).toEqual({
      isOpen: true,
      programId: 'P1',
      version: 'V1',
      pendingScope: null,
      pendingSection: null,
    });
  });

  it('resets scope when explicitly closed', () => {
    openMetadataEditDialog({ programId: 'P1', version: 'V1' });
    closeMetadataEditDialog();

    expect(getMetadataEditDialogSnapshot()).toEqual({
      isOpen: false,
      programId: '',
      version: '',
      pendingScope: null,
      pendingSection: null,
    });
  });

  it('applies and clears a pending scope', () => {
    openMetadataEditDialog({ programId: 'P1', version: 'V1' });
    openMetadataEditDialog({ programId: 'P2', version: 'V2' });
    applyPendingMetadataEditDialogScope();

    expect(getMetadataEditDialogSnapshot()).toEqual({
      isOpen: true,
      programId: 'P2',
      version: 'V2',
      pendingScope: null,
      pendingSection: null,
    });
  });

  it('clears a pending scope without applying it', () => {
    openMetadataEditDialog({ programId: 'P1', version: 'V1' });
    openMetadataEditDialog({ programId: 'P2', version: 'V2' });
    clearPendingMetadataEditDialogScope();

    expect(getMetadataEditDialogSnapshot()).toEqual({
      isOpen: true,
      programId: 'P1',
      version: 'V1',
      pendingScope: null,
      pendingSection: null,
    });
  });
});
