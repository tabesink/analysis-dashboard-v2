import { describe, expect, it } from 'vitest';

import { computeSwitchDialogState } from './database-switch-dialog-state';

describe('computeSwitchDialogState', () => {
  it('validates create-mode database names', () => {
    expect(computeSwitchDialogState('my-db', '', null, 'connect', false, false)).toMatchObject({
      databaseName: 'my-db',
      databaseNameValid: true,
    });
    expect(computeSwitchDialogState('bad name', '', null, 'connect', false, false)).toMatchObject({
      databaseNameValid: false,
    });
  });

  it('allows connect when a different database is selected', () => {
    expect(
      computeSwitchDialogState('', 'project-a', 'project-b', 'connect', false, false),
    ).toMatchObject({
      canConnect: true,
      canDelete: false,
    });
  });

  it('blocks connect while submitting or loading', () => {
    expect(
      computeSwitchDialogState('', 'project-a', 'project-b', 'connect', true, false),
    ).toMatchObject({ canConnect: false });
    expect(
      computeSwitchDialogState('', 'project-a', 'project-b', 'connect', false, true),
    ).toMatchObject({ canConnect: false });
  });

  it('requires exact delete confirmation before delete is enabled', () => {
    const base = computeSwitchDialogState(
      'DELETE project-a',
      'project-a',
      'project-b',
      'delete',
      false,
      false,
    );
    expect(base).toMatchObject({
      expectedDeleteConfirmation: 'DELETE project-a',
      canDelete: true,
    });

    expect(
      computeSwitchDialogState('DELETE project-a', 'project-a', 'project-a', 'delete', false, false),
    ).toMatchObject({ canDelete: false });

    expect(
      computeSwitchDialogState('delete project-a', 'project-a', 'project-b', 'delete', false, false),
    ).toMatchObject({ canDelete: false });
  });
});
