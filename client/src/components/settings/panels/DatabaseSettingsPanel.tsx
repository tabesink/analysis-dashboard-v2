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
      <div className="rounded-xl border border-[var(--border)] bg-[var(--secondary)]/60 p-4 text-sm text-muted-foreground">
        Admin access required.
      </div>
    );
  }

  return (
    <>
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
      <DatabaseOperationModal {...dbOperation.modalProps} />
      <DatabaseSwitchDialog {...dbSwitch.dialogProps} />
    </>
  );
}
