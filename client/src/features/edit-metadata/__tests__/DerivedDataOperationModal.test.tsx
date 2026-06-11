import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { DerivedDataOperationModal } from '@/features/edit-metadata/DerivedDataOperationModal';

vi.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({
    children,
    open,
    containerClassName,
  }: {
    children: React.ReactNode;
    open: boolean;
    containerClassName?: string;
  }) =>
    open ? (
      <div
        data-testid="derived-data-dialog"
        data-shell-operation-modal-layer={containerClassName?.includes('z-[70]') ? 'true' : 'false'}
        data-shell-operation-modal-pointer-events={
          containerClassName?.includes('pointer-events-auto') ? 'true' : 'false'
        }
      >
        {children}
      </div>
    ) : null,
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('DerivedDataOperationModal', () => {
  it('shows damage calculation progress with locked live messages', () => {
    const markup = renderToStaticMarkup(
      <DerivedDataOperationModal
        open
        taskKind="damage_calculation"
        wizardStep="progress"
        progress={42}
        progressPhase="calculating"
        progressMessage="Calculating load history damage: event_042 - BJ X Force"
        onOpenChange={() => {}}
      />,
    );

    expect(markup).toContain('Calculating schedule damage…');
    expect(markup).toContain('Validating schedule rows');
    expect(markup).toContain('Calculating load history damage');
    expect(markup).toContain('Calculating load history damage: event_042 - BJ X Force');
  });

  it('shows a schedule-editor action in the failure summary', () => {
    const markup = renderToStaticMarkup(
      <DerivedDataOperationModal
        open
        taskKind="damage_calculation"
        wizardStep="summary"
        progress={100}
        progressPhase="calculating"
        progressMessage=""
        completionResult={{
          success: false,
          title: 'Damage calculation failed',
          message: 'Fix blank repeats before calculating damage.',
          primaryAction: {
            label: 'Open schedule editor',
            testId: 'damage-calculation-open-schedule-editor',
          },
        }}
        onOpenChange={() => {}}
        onPrimaryAction={() => {}}
      />,
    );

    expect(markup).toContain('Damage calculation failed');
    expect(markup).toContain('data-testid="damage-calculation-open-schedule-editor"');
    expect(markup).toContain('Open schedule editor');
  });

  it('shows phased progress with locked live messages', () => {
    const markup = renderToStaticMarkup(
      <DerivedDataOperationModal
        open
        wizardStep="progress"
        progress={42}
        progressPhase="generating"
        progressMessage="Generating cross-plot data: event_042 - bj_xy_force_plot (4,872 points)"
        onOpenChange={() => {}}
      />,
    );

    expect(markup).toContain('Processing channel assignment…');
    expect(markup).toContain('Validating artifacts');
    expect(markup).toContain('Generating cross-plot data');
    expect(markup).toContain(
      'Generating cross-plot data: event_042 - bj_xy_force_plot (4,872 points)',
    );
  });

  it('uses the shell operation modal z-index layer above Edit Metadata', () => {
    const markup = renderToStaticMarkup(
      <DerivedDataOperationModal
        open
        wizardStep="progress"
        progress={10}
        progressPhase="validating"
        progressMessage="Validating artifact 1/3: event_a.csv"
        onOpenChange={() => {}}
      />,
    );

    expect(markup).toContain('data-shell-operation-modal-layer="true"');
    expect(markup).toContain('data-shell-operation-modal-pointer-events="true"');
  });

  it('communicates that closing the modal does not cancel processing', () => {
    const markup = renderToStaticMarkup(
      <DerivedDataOperationModal
        open
        wizardStep="progress"
        progress={10}
        progressPhase="validating"
        progressMessage="Validating artifact 1/3: event_a.csv"
        onOpenChange={() => {}}
        onDismissProgress={() => {}}
      />,
    );

    expect(markup).toContain('Closing this dialog does not cancel processing');
    expect(markup).toContain('Close and continue in background');
    expect(markup).not.toContain('Cancel');
  });

  it('shows a warning completion summary for partial failures', () => {
    const markup = renderToStaticMarkup(
      <DerivedDataOperationModal
        open
        wizardStep="summary"
        progress={100}
        progressPhase="generating"
        progressMessage=""
        completionResult={{
          success: false,
          title: 'Channel reprocess finished with warnings',
          message: '1 artifact(s) failed',
          detailLines: ['Processed 2 files', '1 file failed'],
        }}
        onOpenChange={() => {}}
      />,
    );

    expect(markup).toContain('Channel reprocess finished with warnings');
    expect(markup).toContain('Processed 2 files');
    expect(markup).toContain('1 file failed');
  });
});
