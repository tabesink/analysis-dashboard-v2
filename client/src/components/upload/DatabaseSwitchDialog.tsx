'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Check, Loader2, Plug, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { computeSwitchDialogState, type ConnectAction } from './database-switch-dialog-state';

export type DatabaseSwitchMode = 'create' | 'connect';

function DatabaseSwitchDialogHeader({
  mode,
  isAdmin,
}: {
  mode: DatabaseSwitchMode | null;
  isAdmin: boolean;
}) {
  return (
    <DialogHeader>
      <DialogTitle className={mode === 'connect' ? 'flex items-center gap-2' : undefined}>
        {mode === 'create' ? (
          'Enter Database Name'
        ) : (
          <>
            <Plug className="size-4" />
            Connect Database
          </>
        )}
      </DialogTitle>
      {mode === 'connect' ? (
        <DialogDescription>
          Select a managed dashboard database, then switch after health checks.
          {isAdmin ? ' Admins can delete unused databases from this list.' : null}
        </DialogDescription>
      ) : null}
    </DialogHeader>
  );
}

interface CreateDatabaseNameFieldsProps {
  confirmationText: string;
  databaseName: string;
  isSubmitting: boolean;
  isLoadingCatalog: boolean;
  onConfirmationTextChange: (value: string) => void;
}

function CreateDatabaseNameFields({
  confirmationText,
  databaseName,
  isSubmitting,
  isLoadingCatalog,
  onConfirmationTextChange,
}: CreateDatabaseNameFieldsProps) {
  return (
    <div className="grid gap-2">
      <Input
        id="database-name"
        placeholder="my-project"
        value={confirmationText}
        onChange={(event) => onConfirmationTextChange(event.target.value)}
        disabled={isSubmitting || isLoadingCatalog}
        autoComplete="off"
        aria-label="Database name"
      />
      <p className="text-xs text-muted-foreground">
        Creates{' '}
        <span className="font-mono">
          dashboard-{databaseName || '<name>'}-&lt;timestamp&gt;.db
        </span>
      </p>
    </div>
  );
}

interface DeleteDatabaseConfirmationFieldsProps {
  confirmationText: string;
  expectedDeleteConfirmation: string;
  isSubmitting: boolean;
  isLoadingCatalog: boolean;
  onConfirmationTextChange: (value: string) => void;
}

function DeleteDatabaseConfirmationFields({
  confirmationText,
  expectedDeleteConfirmation,
  isSubmitting,
  isLoadingCatalog,
  onConfirmationTextChange,
}: DeleteDatabaseConfirmationFieldsProps) {
  return (
    <div className="grid gap-2">
      <Label htmlFor="database-delete-confirmation">
        Type exactly: <span className="font-mono">{expectedDeleteConfirmation || '—'}</span>
      </Label>
      <Input
        id="database-delete-confirmation"
        value={confirmationText}
        onChange={(event) => onConfirmationTextChange(event.target.value)}
        disabled={isSubmitting || isLoadingCatalog}
        autoComplete="off"
      />
    </div>
  );
}

function DatabaseSwitchError({ error }: { error: string | null }) {
  if (!error) {
    return null;
  }

  return (
    <p className="flex items-start gap-2 text-sm text-destructive">
      <AlertTriangle className="size-4 shrink-0 mt-0.5" />
      <span>{error}</span>
    </p>
  );
}

export interface DatabaseSwitchDialogProps {
  open: boolean;
  mode: DatabaseSwitchMode | null;
  isAdmin?: boolean;
  onOpenChange: (open: boolean) => void;
  databases: string[];
  currentDatabase: string | null;
  selectedDatabase: string;
  onSelectedDatabaseChange: (value: string) => void;
  confirmationText: string;
  onConfirmationTextChange: (value: string) => void;
  isLoadingCatalog: boolean;
  isSubmitting: boolean;
  error: string | null;
  onConfirm: () => void;
  onDelete?: () => void;
}

interface ConnectDatabaseListProps {
  isLoadingCatalog: boolean;
  databases: string[];
  selectedDatabase: string;
  currentDatabase: string | null;
  connectAction: ConnectAction;
  isAdmin: boolean;
  onDelete?: () => void;
  isSubmitting: boolean;
  onSelectDatabase: (name: string) => void;
  onDeleteIntent: (name: string) => void;
}

function ConnectDatabaseList({
  isLoadingCatalog,
  databases,
  selectedDatabase,
  currentDatabase,
  connectAction,
  isAdmin,
  onDelete,
  isSubmitting,
  onSelectDatabase,
  onDeleteIntent,
}: ConnectDatabaseListProps) {
  if (isLoadingCatalog) {
    return (
      <div className="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading managed databases...
      </div>
    );
  }

  if (databases.length === 0) {
    return <div className="px-2 py-3 text-sm text-muted-foreground">No databases found.</div>;
  }

  return (
    <>
      {databases.map((name) => {
        const isSelected = selectedDatabase === name;
        const isCurrent = name === currentDatabase;
        return (
          <div
            key={name}
            className={cn(
              'flex items-center gap-1 rounded transition-colors',
              isSelected && connectAction === 'connect'
                ? 'bg-primary/10'
                : isSelected && connectAction === 'delete'
                  ? 'bg-destructive/10'
                  : 'hover:bg-muted',
            )}
          >
            <button
              type="button"
              onClick={() => onSelectDatabase(name)}
              className={cn(
                'min-w-0 flex-1 rounded px-2 py-2 text-left text-sm transition-colors',
                isSelected && connectAction === 'connect'
                  ? 'text-primary'
                  : isSelected && connectAction === 'delete'
                    ? 'text-destructive'
                    : 'text-foreground',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate">{name}</span>
                <div className="flex items-center gap-2">
                  {isCurrent ? <span className="text-xs text-muted-foreground">current</span> : null}
                  {isSelected && connectAction === 'connect' ? <Check className="size-3.5" /> : null}
                </div>
              </div>
            </button>
            {isAdmin && !isCurrent && onDelete ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                aria-label={`Delete ${name}`}
                disabled={isSubmitting || isLoadingCatalog}
                onClick={() => onDeleteIntent(name)}
              >
                <Trash2 className="size-4" />
              </Button>
            ) : null}
          </div>
        );
      })}
    </>
  );
}

interface PrimaryActionButtonProps {
  mode: DatabaseSwitchMode | null;
  connectAction: ConnectAction;
  isAdmin: boolean;
  onDelete?: () => void;
  isSubmitting: boolean;
  isLoadingCatalog: boolean;
  databaseNameValid: boolean;
  canConnect: boolean;
  canDelete: boolean;
  onConfirm: () => void;
}

// fallow-ignore-next-line complexity
function PrimaryActionButton({
  mode,
  connectAction,
  isAdmin,
  onDelete,
  isSubmitting,
  isLoadingCatalog,
  databaseNameValid,
  canConnect,
  canDelete,
  onConfirm,
}: PrimaryActionButtonProps) {
  if (mode === 'connect' && connectAction === 'delete' && isAdmin && onDelete) {
    return (
      <Button type="button" variant="destructive" onClick={onDelete} disabled={!canDelete}>
        {isSubmitting ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Deleting...
          </>
        ) : (
          'Delete Database'
        )}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      onClick={onConfirm}
      disabled={mode === 'create' ? !databaseNameValid || isSubmitting || isLoadingCatalog : !canConnect}
    >
      {isSubmitting ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          Working...
        </>
      ) : mode === 'create' ? (
        'Create'
      ) : (
        'Connect & Switch'
      )}
    </Button>
  );
}

export function DatabaseSwitchDialog({
  open,
  mode,
  isAdmin = false,
  onOpenChange,
  databases,
  currentDatabase,
  selectedDatabase,
  onSelectedDatabaseChange,
  confirmationText,
  onConfirmationTextChange,
  isLoadingCatalog,
  isSubmitting,
  error,
  onConfirm,
  onDelete,
}: DatabaseSwitchDialogProps) {
  const [connectAction, setConnectAction] = useState<ConnectAction>('connect');

  useEffect(() => {
    if (!open) {
      setConnectAction('connect');
    }
  }, [open]);

  const {
    databaseName,
    databaseNameValid,
    expectedDeleteConfirmation,
    canConnect,
    canDelete,
  } = computeSwitchDialogState(
    confirmationText,
    selectedDatabase,
    currentDatabase,
    connectAction,
    isSubmitting,
    isLoadingCatalog,
  );

  const handleSelectDatabase = (name: string) => {
    onSelectedDatabaseChange(name);
    setConnectAction('connect');
    onConfirmationTextChange('');
  };

  const handleDeleteIntent = (name: string) => {
    onSelectedDatabaseChange(name);
    setConnectAction('delete');
    onConfirmationTextChange('');
  };

  const showConnectList = mode === 'connect';
  const showCreateFields = mode === 'create';
  const showDeleteConfirmation = mode === 'connect' && connectAction === 'delete' && isAdmin;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent overlayClassName="bg-transparent backdrop-blur-none">
        <DatabaseSwitchDialogHeader mode={mode} isAdmin={isAdmin} />

        {showConnectList ? (
          <ScrollArea className="h-44 rounded-md border">
            <div className="p-1">
              <ConnectDatabaseList
                isLoadingCatalog={isLoadingCatalog}
                databases={databases}
                selectedDatabase={selectedDatabase}
                currentDatabase={currentDatabase}
                connectAction={connectAction}
                isAdmin={isAdmin}
                onDelete={onDelete}
                isSubmitting={isSubmitting}
                onSelectDatabase={handleSelectDatabase}
                onDeleteIntent={handleDeleteIntent}
              />
            </div>
          </ScrollArea>
        ) : null}

        {showCreateFields ? (
          <CreateDatabaseNameFields
            confirmationText={confirmationText}
            databaseName={databaseName}
            isSubmitting={isSubmitting}
            isLoadingCatalog={isLoadingCatalog}
            onConfirmationTextChange={onConfirmationTextChange}
          />
        ) : null}

        {showDeleteConfirmation ? (
          <DeleteDatabaseConfirmationFields
            confirmationText={confirmationText}
            expectedDeleteConfirmation={expectedDeleteConfirmation}
            isSubmitting={isSubmitting}
            isLoadingCatalog={isLoadingCatalog}
            onConfirmationTextChange={onConfirmationTextChange}
          />
        ) : null}

        <DatabaseSwitchError error={error} />

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <PrimaryActionButton
            mode={mode}
            connectAction={connectAction}
            isAdmin={isAdmin}
            onDelete={onDelete}
            isSubmitting={isSubmitting}
            isLoadingCatalog={isLoadingCatalog}
            databaseNameValid={databaseNameValid}
            canConnect={canConnect}
            canDelete={canDelete}
            onConfirm={onConfirm}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
