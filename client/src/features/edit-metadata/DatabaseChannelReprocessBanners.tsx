'use client';

import { DatabaseChannelReprocessBanner } from '@/features/edit-metadata/DatabaseChannelReprocessBanner';
import { selectDatabaseChannelReprocessBanners } from '@/features/edit-metadata/lib/database-channel-reprocess-banner';
import {
  reopenChannelReprocessModal,
  useChannelReprocessStore,
} from '@/stores/channel-reprocess-store';
import { useMetadataEditDialogStore } from '@/stores/metadata-edit-dialog-store';

export function DatabaseChannelReprocessBanners() {
  const scopes = useChannelReprocessStore((state) => state.scopes);
  const isMetadataDialogOpen = useMetadataEditDialogStore((state) => state.isOpen);
  const metadataDialogProgramId = useMetadataEditDialogStore((state) => state.programId);
  const metadataDialogVersion = useMetadataEditDialogStore((state) => state.version);

  const banners = selectDatabaseChannelReprocessBanners({
    scopes,
    metadataEditDialog: {
      isOpen: isMetadataDialogOpen,
      programId: metadataDialogProgramId,
      version: metadataDialogVersion,
    },
  });

  if (banners.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {banners.map((entry) => {
        const scopeKey = `${entry.scope.programId}::${entry.scope.version}`;
        return (
          <DatabaseChannelReprocessBanner
            key={scopeKey}
            entry={entry}
            onReopen={() => reopenChannelReprocessModal(entry.scope)}
          />
        );
      })}
    </div>
  );
}
