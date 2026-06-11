import { describe, expect, it } from 'vitest';

import { isMetadataSaveEnabled } from '../lib/metadata-save-state';

describe('isMetadataSaveEnabled', () => {
  it('is disabled without a program/version scope', () => {
    expect(
      isMetadataSaveEnabled({
        programId: '',
        version: 'V1',
        isPrefillLoading: false,
        isSaving: false,
        dirtyFieldCount: 1,
        dirtyPhaseCount: 0,
      }),
    ).toBe(false);
  });

  it('is disabled while loading or saving', () => {
    expect(
      isMetadataSaveEnabled({
        programId: 'P1',
        version: 'V1',
        isPrefillLoading: true,
        isSaving: false,
        dirtyFieldCount: 1,
        dirtyPhaseCount: 0,
      }),
    ).toBe(false);

    expect(
      isMetadataSaveEnabled({
        programId: 'P1',
        version: 'V1',
        isPrefillLoading: false,
        isSaving: true,
        dirtyFieldCount: 1,
        dirtyPhaseCount: 0,
      }),
    ).toBe(false);
  });

  it('is disabled when nothing is dirty', () => {
    expect(
      isMetadataSaveEnabled({
        programId: 'P1',
        version: 'V1',
        isPrefillLoading: false,
        isSaving: false,
        dirtyFieldCount: 0,
        dirtyPhaseCount: 0,
      }),
    ).toBe(false);
  });

  it('is disabled for read-only users even when metadata is dirty', () => {
    expect(
      isMetadataSaveEnabled({
        programId: 'P1',
        version: 'V1',
        isPrefillLoading: false,
        isSaving: false,
        dirtyFieldCount: 2,
        dirtyPhaseCount: 1,
        canWrite: false,
      }),
    ).toBe(false);
  });

  it('is enabled when scope is set and metadata or phases are dirty', () => {
    expect(
      isMetadataSaveEnabled({
        programId: 'P1',
        version: 'V1',
        isPrefillLoading: false,
        isSaving: false,
        dirtyFieldCount: 1,
        dirtyPhaseCount: 0,
      }),
    ).toBe(true);

    expect(
      isMetadataSaveEnabled({
        programId: 'P1',
        version: 'V1',
        isPrefillLoading: false,
        isSaving: false,
        dirtyFieldCount: 0,
        dirtyPhaseCount: 1,
      }),
    ).toBe(true);
  });
});
