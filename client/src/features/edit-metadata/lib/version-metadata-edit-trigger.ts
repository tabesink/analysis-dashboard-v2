export interface VersionMetadataEditScope {
  programId: string;
  version: string;
  eventCount: number;
}

export function buildVersionMetadataEditLabel({
  programId,
  version,
  eventCount,
}: VersionMetadataEditScope): string {
  const eventLabel = eventCount === 1 ? '1 event' : `${eventCount} events`;
  return `Edit metadata for ${programId} ${version} (${eventLabel})`;
}

export function triggerVersionMetadataEdit(
  event: { stopPropagation: () => void },
  scope: Pick<VersionMetadataEditScope, 'programId' | 'version'>,
  openDialog: (scope: Pick<VersionMetadataEditScope, 'programId' | 'version'>) => void,
): void {
  event.stopPropagation();
  openDialog(scope);
}
