'use client';

import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { exportApi } from '@/lib/api';
import { invalidateDatabaseDataQueries } from '@/lib/metadata-save-cache';
import { clearStoredSessionIdentity } from '@/lib/session/session-identity';
import type {
  DatabaseSwitchDialogProps,
  DatabaseSwitchMode,
} from '@/features/database/portability/types';

export interface UseDatabaseSwitchOptions {
  isAdmin: boolean;
}

export interface UseDatabaseSwitchReturn {
  isCreatingDatabase: boolean;
  isConnectingDatabase: boolean;
  handleCreateDatabase: () => void;
  handleConnectDatabase: () => Promise<void>;
  dialogProps: DatabaseSwitchDialogProps;
}

export function useDatabaseSwitch({
  isAdmin,
}: UseDatabaseSwitchOptions): UseDatabaseSwitchReturn {
  const queryClient = useQueryClient();
  const [databaseSwitchOpen, setDatabaseSwitchOpen] = useState(false);
  const [databaseSwitchMode, setDatabaseSwitchMode] = useState<DatabaseSwitchMode | null>(null);
  const [databaseCatalog, setDatabaseCatalog] = useState<string[]>([]);
  const [currentDatabaseName, setCurrentDatabaseName] = useState<string | null>(null);
  const [selectedDatabaseName, setSelectedDatabaseName] = useState('');
  const [databaseSwitchConfirmation, setDatabaseSwitchConfirmation] = useState('');
  const [isLoadingDatabaseCatalog, setIsLoadingDatabaseCatalog] = useState(false);
  const [databaseSwitchSubmitting, setDatabaseSwitchSubmitting] = useState(false);
  const [databaseSwitchError, setDatabaseSwitchError] = useState<string | null>(null);
  const [isCreatingDatabase, setIsCreatingDatabase] = useState(false);
  const [isConnectingDatabase, setIsConnectingDatabase] = useState(false);

  const resetDatabaseSwitchState = useCallback(() => {
    setDatabaseSwitchMode(null);
    setDatabaseCatalog([]);
    setCurrentDatabaseName(null);
    setSelectedDatabaseName('');
    setDatabaseSwitchConfirmation('');
    setIsLoadingDatabaseCatalog(false);
    setDatabaseSwitchSubmitting(false);
    setDatabaseSwitchError(null);
  }, []);

  const refreshDatabaseCatalog = useCallback(async () => {
    const catalog = await exportApi.listDatabases();
    setDatabaseCatalog(catalog.databases);
    setCurrentDatabaseName(catalog.current_database);
    if (
      selectedDatabaseName &&
      !catalog.databases.includes(selectedDatabaseName)
    ) {
      setSelectedDatabaseName(catalog.current_database);
    }
    return catalog;
  }, [selectedDatabaseName]);

  const handleCreateDatabase = useCallback(() => {
    if (!isAdmin) {
      toast.error('Admin access required');
      return;
    }
    resetDatabaseSwitchState();
    setDatabaseSwitchMode('create');
    setDatabaseSwitchOpen(true);
  }, [isAdmin, resetDatabaseSwitchState]);

  const handleConnectDatabase = useCallback(async () => {
    if (!isAdmin) {
      toast.error('Admin access required');
      return;
    }
    resetDatabaseSwitchState();
    setDatabaseSwitchMode('connect');
    setDatabaseSwitchOpen(true);
    setIsConnectingDatabase(true);
    setIsLoadingDatabaseCatalog(true);
    try {
      const catalog = await exportApi.listDatabases();
      if (catalog.databases.length === 0) {
        setDatabaseSwitchError('No managed dashboard databases found');
        return;
      }
      setDatabaseCatalog(catalog.databases);
      setCurrentDatabaseName(catalog.current_database);
      setSelectedDatabaseName(catalog.current_database);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to load managed databases';
      setDatabaseSwitchError(message);
    } finally {
      setIsLoadingDatabaseCatalog(false);
      setIsConnectingDatabase(false);
    }
  }, [isAdmin, resetDatabaseSwitchState]);

  const handleDatabaseSwitchOpenChange = useCallback(
    (open: boolean) => {
      setDatabaseSwitchOpen(open);
      if (!open) {
        resetDatabaseSwitchState();
      }
    },
    [resetDatabaseSwitchState],
  );

  const handleDatabaseSwitchConfirm = useCallback(async () => {
    if (!databaseSwitchMode) {
      return;
    }

    setDatabaseSwitchSubmitting(true);
    setDatabaseSwitchError(null);

    if (databaseSwitchMode === 'create') {
      setIsCreatingDatabase(true);
    } else {
      setIsConnectingDatabase(true);
    }

    try {
      if (databaseSwitchMode === 'create') {
        const result = await exportApi.createNewDatabase(databaseSwitchConfirmation.trim());
        toast.success(`Created ${result.created_database}`);
        setDatabaseSwitchOpen(false);
        resetDatabaseSwitchState();
        return;
      }

      const result = await exportApi.connectDatabase(selectedDatabaseName);
      await invalidateDatabaseDataQueries(queryClient);
      clearStoredSessionIdentity();
      toast.success(
        `Connected to ${result.active_database}. Previous DB: ${result.previous_database}`,
      );
      window.location.reload();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : databaseSwitchMode === 'create'
            ? 'Failed to create database'
            : 'Failed to connect database';
      setDatabaseSwitchError(message);
    } finally {
      setDatabaseSwitchSubmitting(false);
      setIsCreatingDatabase(false);
      setIsConnectingDatabase(false);
    }
  }, [
    databaseSwitchConfirmation,
    databaseSwitchMode,
    queryClient,
    resetDatabaseSwitchState,
    selectedDatabaseName,
  ]);

  const handleDatabaseDelete = useCallback(async () => {
    if (!isAdmin || !selectedDatabaseName) {
      return;
    }

    setDatabaseSwitchSubmitting(true);
    setDatabaseSwitchError(null);

    try {
      const result = await exportApi.deleteDatabase(
        selectedDatabaseName,
        databaseSwitchConfirmation.trim(),
      );
      toast.success(`Deleted ${result.deleted_database}`);
      setDatabaseSwitchConfirmation('');
      await refreshDatabaseCatalog();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to delete database';
      setDatabaseSwitchError(message);
    } finally {
      setDatabaseSwitchSubmitting(false);
    }
  }, [
    databaseSwitchConfirmation,
    isAdmin,
    refreshDatabaseCatalog,
    selectedDatabaseName,
  ]);

  const dialogProps: DatabaseSwitchDialogProps = {
    open: databaseSwitchOpen,
    mode: databaseSwitchMode,
    isAdmin,
    onOpenChange: handleDatabaseSwitchOpenChange,
    databases: databaseCatalog,
    currentDatabase: currentDatabaseName,
    selectedDatabase: selectedDatabaseName,
    onSelectedDatabaseChange: setSelectedDatabaseName,
    confirmationText: databaseSwitchConfirmation,
    onConfirmationTextChange: setDatabaseSwitchConfirmation,
    isLoadingCatalog: isLoadingDatabaseCatalog,
    isSubmitting: databaseSwitchSubmitting,
    error: databaseSwitchError,
    onConfirm: handleDatabaseSwitchConfirm,
    onDelete: isAdmin ? handleDatabaseDelete : undefined,
  };

  return {
    isCreatingDatabase,
    isConnectingDatabase,
    handleCreateDatabase,
    handleConnectDatabase,
    dialogProps,
  };
}
