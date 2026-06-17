import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DatabaseOperationModal } from '@/components/upload/DatabaseOperationModal';

const { mockAlertDialog } = vi.hoisted(() => ({
  mockAlertDialog: vi.fn(
    ({ children, open }: { children: React.ReactNode; open: boolean }) =>
      open ? <div data-testid="database-operation-dialog">{children}</div> : null,
  ),
}));

vi.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: mockAlertDialog,
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('DatabaseOperationModal', () => {
  beforeEach(() => {
    mockAlertDialog.mockClear();
  });

  it('blocks active progress close requests through open-change', () => {
    const onOpenChange = vi.fn();
    const markup = renderToStaticMarkup(
      <DatabaseOperationModal
        open
        mode="export"
        wizardStep="progress"
        blocking
        taskStatus={{
          task_id: 'task-1',
          kind: 'database_export',
          status: 'running',
          progress: 'Exporting table 1',
          current: 1,
          total: 3,
          current_table: 'events',
          events_loaded: null,
          phase: 'exporting',
          error: null,
          result: null,
        }}
        activeTaskId="task-1"
        onOpenChange={onOpenChange}
      />,
    );

    expect(markup).toContain('Cancel operation');

    const alertDialogProps = mockAlertDialog.mock.calls.at(-1)?.[0] as
      | { onOpenChange: (next: boolean) => void }
      | undefined;
    expect(alertDialogProps).toBeDefined();

    alertDialogProps?.onOpenChange(false);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('allows close requests after export reaches summary', () => {
    const onOpenChange = vi.fn();
    renderToStaticMarkup(
      <DatabaseOperationModal
        open
        mode="export"
        wizardStep="summary"
        blocking={false}
        completionResult={{
          success: true,
          title: 'Export complete',
          message: 'Saved archive.',
        }}
        onOpenChange={onOpenChange}
      />,
    );

    const alertDialogProps = mockAlertDialog.mock.calls.at(-1)?.[0] as
      | { onOpenChange: (next: boolean) => void }
      | undefined;
    expect(alertDialogProps).toBeDefined();

    alertDialogProps?.onOpenChange(false);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
