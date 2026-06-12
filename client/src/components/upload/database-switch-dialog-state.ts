const DATABASE_NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;

export type ConnectAction = 'connect' | 'delete';

export function computeSwitchDialogState(
  confirmationText: string,
  selectedDatabase: string,
  currentDatabase: string | null,
  connectAction: ConnectAction,
  isSubmitting: boolean,
  isLoadingCatalog: boolean,
) {
  const databaseName = confirmationText.trim();
  const databaseNameValid = DATABASE_NAME_PATTERN.test(databaseName);
  const expectedDeleteConfirmation = selectedDatabase ? `DELETE ${selectedDatabase}` : '';
  const deleteConfirmationMatches =
    expectedDeleteConfirmation.length > 0 && confirmationText.trim() === expectedDeleteConfirmation;
  const canConnect =
    !isSubmitting && !isLoadingCatalog && Boolean(selectedDatabase) && connectAction === 'connect';
  const canDelete =
    !isSubmitting &&
    !isLoadingCatalog &&
    connectAction === 'delete' &&
    deleteConfirmationMatches &&
    Boolean(selectedDatabase) &&
    selectedDatabase !== currentDatabase;

  return {
    databaseName,
    databaseNameValid,
    expectedDeleteConfirmation,
    canConnect,
    canDelete,
  };
}
