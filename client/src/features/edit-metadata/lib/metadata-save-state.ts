export function isMetadataSaveEnabled(params: {
  programId: string;
  version: string;
  isPrefillLoading: boolean;
  isSaving: boolean;
  dirtyFieldCount: number;
  dirtyPhaseCount: number;
  canWrite?: boolean;
}): boolean {
  return Boolean(
    params.canWrite !== false &&
      params.programId &&
      params.version &&
      !params.isPrefillLoading &&
      !params.isSaving &&
      (params.dirtyFieldCount > 0 || params.dirtyPhaseCount > 0),
  );
}
