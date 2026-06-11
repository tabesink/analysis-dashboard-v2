import { describe, expect, it } from 'vitest';

import {
  isMetadataDialogDirty,
  resolveMetadataDialogCloseRequest,
  shouldPromptMetadataDiscard,
} from '../lib/metadata-dialog-close';

describe('isMetadataDialogDirty', () => {
  it('is dirty when only metadata has unsaved edits', () => {
    expect(isMetadataDialogDirty(true, false, false)).toBe(true);
  });

  it('is dirty when only channel maps have unsaved edits', () => {
    expect(isMetadataDialogDirty(false, true, false)).toBe(true);
  });

  it('is dirty when only the durability schedule has unsaved edits', () => {
    expect(isMetadataDialogDirty(false, false, true)).toBe(true);
  });

  it('is clean when no section has unsaved edits', () => {
    expect(isMetadataDialogDirty(false, false, false)).toBe(false);
  });
});

describe('shouldPromptMetadataDiscard', () => {
  it('prompts when metadata values are dirty', () => {
    expect(shouldPromptMetadataDiscard(true)).toBe(true);
  });

  it('prompts when channel-map values are dirty', () => {
    expect(shouldPromptMetadataDiscard(isMetadataDialogDirty(false, true, false))).toBe(true);
  });

  it('prompts when durability schedule values are dirty', () => {
    expect(shouldPromptMetadataDiscard(isMetadataDialogDirty(false, false, true))).toBe(true);
  });

  it('does not prompt when metadata values are clean', () => {
    expect(shouldPromptMetadataDiscard(false)).toBe(false);
  });
});

describe('resolveMetadataDialogCloseRequest', () => {
  it('closes immediately when metadata is clean', () => {
    expect(
      resolveMetadataDialogCloseRequest({
        isDirty: false,
        confirmedDiscard: false,
      }),
    ).toBe('close');
  });

  it('stays open when channel maps are dirty and discard is not confirmed', () => {
    expect(
      resolveMetadataDialogCloseRequest({
        isDirty: isMetadataDialogDirty(false, true, false),
        confirmedDiscard: false,
      }),
    ).toBe('stay-open');
  });

  it('closes when channel maps are dirty and discard is confirmed', () => {
    expect(
      resolveMetadataDialogCloseRequest({
        isDirty: isMetadataDialogDirty(false, true, false),
        confirmedDiscard: true,
      }),
    ).toBe('close');
  });

  it('stays open when the durability schedule is dirty and discard is not confirmed', () => {
    expect(
      resolveMetadataDialogCloseRequest({
        isDirty: isMetadataDialogDirty(false, false, true),
        confirmedDiscard: false,
      }),
    ).toBe('stay-open');
  });

  it('closes when the durability schedule is dirty and discard is confirmed', () => {
    expect(
      resolveMetadataDialogCloseRequest({
        isDirty: isMetadataDialogDirty(false, false, true),
        confirmedDiscard: true,
      }),
    ).toBe('close');
  });

  it('stays open when metadata is dirty and discard is not confirmed', () => {
    expect(
      resolveMetadataDialogCloseRequest({
        isDirty: true,
        confirmedDiscard: false,
      }),
    ).toBe('stay-open');
  });

  it('closes when metadata is dirty and discard is confirmed', () => {
    expect(
      resolveMetadataDialogCloseRequest({
        isDirty: true,
        confirmedDiscard: true,
      }),
    ).toBe('close');
  });
});
