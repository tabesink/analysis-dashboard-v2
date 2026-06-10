'use client';

import { useEffect, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { exportApi } from '@/lib/api';
import { useDatabaseOperation } from '@/hooks/use-database-operation';
import { useDatabaseSwitch } from '@/hooks/use-database-switch';
import { DatabaseSection } from '@/components/upload/DatabaseSection';
import {
  DatabaseOperationModal,
  DatabaseSwitchDialog,
} from '@/components/upload';
import { selectCanWrite, selectIsAdmin, useAuthStore } from '@/stores/auth-store';

export function DatabaseSettingsPanel() {
  const queryClient = useQueryClient();
  const isAdmin = useAuthStore(selectIsAdmin);
  const canWrite = useAuthStore(selectCanWrite);
  const [eventCount, setEventCount] = useState(0);

  useEffect(() => {
    void exportApi
      .getDatabaseInfo()
      .then((info) => setEventCount(info.event_count))
      .catch(() => undefined);
  }, []);

  const onImportComplete = useCallback(() => {
    void queryClient.invalidateQueries();
    void exportApi
      .getDatabaseInfo()
      .then((info) => setEventCount(info.event_count))
      .catch(() => undefined);
  }, [queryClient]);

  const dbOperation = useDatabaseOperation({
    currentEventCount: eventCount,
    onImportComplete,
  });

  const dbSwitch = useDatabaseSwitch({ isAdmin, canWrite });

  const handleExportDatabase = async () => {
    if (!isAdmin) {
      toast.error('Admin access required');
      return;
    }
    await dbOperation.startExport();
  };

  const handleImportClick = () => {
    if (!isAdmin) {
      toast.error('Admin access required');
      return;
    }
    dbOperation.openImport();
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
        isImporting={dbOperation.isImporting}
        isImportBusy={dbOperation.isImportBusy}
        exportProgress={dbOperation.exportProgress || undefined}
        onCreateDatabase={dbSwitch.handleCreateDatabase}
        onConnectDatabase={dbSwitch.handleConnectDatabase}
        onExportDatabase={handleExportDatabase}
        onImportClick={handleImportClick}
      />
      <DatabaseOperationModal {...dbOperation.modalProps} />
      <DatabaseSwitchDialog {...dbSwitch.dialogProps} />
    </>
  );
}
