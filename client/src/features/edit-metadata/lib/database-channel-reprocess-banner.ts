import type { ChannelReprocessScopeState } from '@/stores/channel-reprocess-store';

export interface DatabaseChannelReprocessBannerScope {
  programId: string;
  version: string;
}

export interface DatabaseChannelReprocessBannerEntry {
  scope: DatabaseChannelReprocessBannerScope;
  progressMessage: string;
}

export interface MetadataEditDialogVisibility {
  isOpen: boolean;
  programId: string;
  version: string;
}

const RUNNING_LABEL = 'Channel reprocess running…';

function parseScopeKey(key: string): DatabaseChannelReprocessBannerScope {
  const separatorIndex = key.indexOf('::');
  return {
    programId: key.slice(0, separatorIndex),
    version: key.slice(separatorIndex + 2),
  };
}

function isMetadataEditorOpenForScope(
  metadataEditDialog: MetadataEditDialogVisibility,
  scope: DatabaseChannelReprocessBannerScope,
): boolean {
  return (
    metadataEditDialog.isOpen &&
    metadataEditDialog.programId === scope.programId &&
    metadataEditDialog.version === scope.version
  );
}

export function selectDatabaseChannelReprocessBanners(params: {
  scopes: Record<string, ChannelReprocessScopeState>;
  metadataEditDialog: MetadataEditDialogVisibility;
}): DatabaseChannelReprocessBannerEntry[] {
  return Object.entries(params.scopes)
    .filter(([, scopeState]) => scopeState.status === 'running' && !scopeState.modalOpen)
    .map(([key, scopeState]) => ({
      scope: parseScopeKey(key),
      progressMessage: scopeState.progressMessage.trim() || RUNNING_LABEL,
    }))
    .filter((entry) => !isMetadataEditorOpenForScope(params.metadataEditDialog, entry.scope));
}
