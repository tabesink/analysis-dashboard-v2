import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { ScopeDeleteOperationModal } from '@/features/database-scope-delete/ScopeDeleteOperationModal';
import { buildScopeDeletePlan } from '@/features/database-scope-delete/build-scope-delete-plan';
import { PROGRAM_SCOPE_PREFIX } from '@/features/database/datasets';
import type { ProgramVersionSummary } from '@/types/upload';

vi.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="scope-delete-dialog">{children}</div> : null,
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const programVersions: ProgramVersionSummary[] = [
  {
    program_id: 'P1',
    version: 'V1',
    event_count: 120,
    statuses: ['Approved'],
    has_channel_map: true,
    missing_channel_map: false,
    pending_artifact_count: 4,
    failed_artifact_count: 0,
  },
];

describe('ScopeDeleteOperationModal', () => {
  it('shows scope summary on the confirm step', () => {
    const plan = buildScopeDeletePlan([`${PROGRAM_SCOPE_PREFIX}P1`], programVersions);

    const markup = renderToStaticMarkup(
      <ScopeDeleteOperationModal
        open
        wizardStep="confirm"
        blocking={false}
        plan={plan}
        progressPhase="measurements"
        progressMessage="Starting…"
        onOpenChange={() => {}}
        onConfirmDelete={() => {}}
      />,
    );

    expect(markup).toContain('Delete program/version data?');
    expect(markup).toContain('Program P1');
    expect(markup).toContain('~120 events');
    expect(markup).toContain('Permanently delete');
  });

  it('shows phased progress while delete is running', () => {
    const plan = buildScopeDeletePlan([`${PROGRAM_SCOPE_PREFIX}P1`], programVersions);

    const markup = renderToStaticMarkup(
      <ScopeDeleteOperationModal
        open
        wizardStep="progress"
        blocking
        plan={plan}
        progressPhase="artifacts"
        progressMessage="Deleting P1: removing artifacts and channel maps…"
        onOpenChange={() => {}}
        onConfirmDelete={() => {}}
      />,
    );

    expect(markup).toContain('Deleting data…');
    expect(markup).toContain('Removing measurements and events');
    expect(markup).toContain('Removing artifacts and channel maps');
    expect(markup).toContain('Cleaning up files');
    expect(markup).toContain('removing artifacts and channel maps');
  });

  it('shows completion summary with elapsed time', () => {
    const markup = renderToStaticMarkup(
      <ScopeDeleteOperationModal
        open
        wizardStep="summary"
        blocking={false}
        plan={null}
        progressPhase="files"
        progressMessage=""
        completionResult={{
          success: true,
          title: 'Delete complete',
          message: 'Deleted 1 scope.',
          elapsedSeconds: 42,
          detailLines: ['1 scope removed', '5 events deleted', '1 artifact deleted'],
        }}
        onOpenChange={() => {}}
      />,
    );

    expect(markup).toContain('Delete complete');
    expect(markup).toContain('Total time: 42s');
    expect(markup).toContain('5 events deleted');
    expect(markup).toContain('Close');
  });
});
