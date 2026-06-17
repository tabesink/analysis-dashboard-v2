'use client';

import { useCallback } from 'react';
import { toast } from 'sonner';
import {
  DatabaseOperationModal,
  DatabaseSection,
  DatabaseSwitchDialog,
  useDatabaseOperation,
  useDatabaseSwitch,
} from '@/features/database/portability';
import { DialogContentCard } from '@/components/shared/dialog-layout';
import { selectIsAdmin, useAuthStore } from '@/stores/auth-store';

export function DatabaseSettingsPanel() {
  const isAdmin = useAuthStore(selectIsAdmin);
  const dbOperation = useDatabaseOperation();

  const dbSwitch = useDatabaseSwitch({ isAdmin });

  const handleExportDatabase = async () => {
    if (!isAdmin) {
      toast.error('Admin access required');
      return;
    }
    await dbOperation.startExport();
  };

  if (!isAdmin) {
    return (
      <DialogContentCard className="min-h-0 flex-1" bodyClassName="flex min-h-0 flex-1 flex-col">
        <div className="text-sm text-muted-foreground">Admin access required.</div>
      </DialogContentCard>
    );
  }

  return (
    <>
      <DialogContentCard className="min-h-0 flex-1" bodyClassName="flex min-h-0 flex-1 flex-col">
        <DatabaseSection
          isAdmin={isAdmin}
          isCreatingDatabase={dbSwitch.isCreatingDatabase}
          isConnectingDatabase={dbSwitch.isConnectingDatabase}
          isExporting={dbOperation.isExporting}
          exportProgress={dbOperation.exportProgress || undefined}
          onCreateDatabase={dbSwitch.handleCreateDatabase}
          onConnectDatabase={dbSwitch.handleConnectDatabase}
          onExportDatabase={handleExportDatabase}
        />
      </DialogContentCard>
      <DatabaseOperationModal {...dbOperation.modalProps} />
      <DatabaseSwitchDialog {...dbSwitch.dialogProps} />
    </>
  );
}
