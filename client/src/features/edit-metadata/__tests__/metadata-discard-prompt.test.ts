import { describe, expect, it } from 'vitest';

import { buildMetadataDiscardPromptCopy } from '../lib/metadata-discard-prompt';

describe('buildMetadataDiscardPromptCopy', () => {
  it('describes closing the dialog with unsaved changes from any section', () => {
    expect(
      buildMetadataDiscardPromptCopy({
        reason: 'close',
        programId: 'P1',
        version: 'V1',
      }),
    ).toEqual({
      title: 'Discard unsaved changes?',
      description:
        'You have unsaved changes for P1 / V1. Closing now will discard those changes.',
    });
  });

  it('describes switching to another program/version with unsaved changes from any section', () => {
    expect(
      buildMetadataDiscardPromptCopy({
        reason: 'scope-change',
        programId: 'P1',
        version: 'V1',
        pendingScope: { programId: 'P2', version: 'V2' },
      }),
    ).toEqual({
      title: 'Discard changes and switch version?',
      description:
        'You have unsaved changes for P1 / V1. Switching to P2 / V2 will discard those changes.',
    });
  });
});
