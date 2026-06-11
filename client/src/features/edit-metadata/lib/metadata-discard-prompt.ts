export type MetadataDiscardPromptReason = 'close' | 'scope-change';

export function buildMetadataDiscardPromptCopy(params: {
  reason: MetadataDiscardPromptReason;
  programId: string;
  version: string;
  pendingScope?: { programId: string; version: string };
}): { title: string; description: string } {
  if (params.reason === 'scope-change' && params.pendingScope) {
    return {
      title: 'Discard changes and switch version?',
      description: `You have unsaved changes for ${params.programId} / ${params.version}. Switching to ${params.pendingScope.programId} / ${params.pendingScope.version} will discard those changes.`,
    };
  }

  return {
    title: 'Discard unsaved changes?',
    description: `You have unsaved changes for ${params.programId} / ${params.version}. Closing now will discard those changes.`,
  };
}
