export type MetadataDialogCloseDecision = 'stay-open' | 'close';

export function isMetadataDialogDirty(
  isMetadataDirty: boolean,
  isChannelMapDirty: boolean,
  isScheduleDirty: boolean,
): boolean {
  return isMetadataDirty || isChannelMapDirty || isScheduleDirty;
}

export function shouldPromptMetadataDiscard(isDirty: boolean): boolean {
  return isDirty;
}

export function resolveMetadataDialogCloseRequest(params: {
  isDirty: boolean;
  confirmedDiscard: boolean;
}): MetadataDialogCloseDecision {
  if (!params.isDirty) {
    return 'close';
  }
  return params.confirmedDiscard ? 'close' : 'stay-open';
}
