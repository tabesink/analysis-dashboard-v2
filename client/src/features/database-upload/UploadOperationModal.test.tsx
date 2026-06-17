import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UploadOperationModal } from '@/features/database-upload/UploadOperationModal';

const { mockAlertDialog } = vi.hoisted(() => ({
  mockAlertDialog: vi.fn(
    ({ children, open }: { children: React.ReactNode; open: boolean }) =>
      open ? <div data-testid="upload-operation-dialog">{children}</div> : null,
  ),
}));

vi.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: mockAlertDialog,
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('UploadOperationModal', () => {
  beforeEach(() => {
    mockAlertDialog.mockClear();
  });

  it('keeps active upload progress non-dismissible and shows a real cancel action', () => {
    const onOpenChange = vi.fn();
    const markup = renderToStaticMarkup(
      <UploadOperationModal
        open
        wizardStep="progress"
        blocking
        progress={12}
        progressPhase="ingesting"
        progressMessage="Importing event 1 of 10"
        isCancelling={false}
        onOpenChange={onOpenChange}
        onCancelUpload={() => {}}
      />,
    );

    expect(markup).toContain('Cancel');

    const alertDialogProps = mockAlertDialog.mock.calls.at(-1)?.[0] as
      | { onOpenChange: (next: boolean) => void }
      | undefined;
    expect(alertDialogProps).toBeDefined();

    alertDialogProps?.onOpenChange(false);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('shows cancelling-safe copy while cancel is in flight', () => {
    const markup = renderToStaticMarkup(
      <UploadOperationModal
        open
        wizardStep="progress"
        blocking
        progress={40}
        progressPhase="writing"
        progressMessage="Cancelling safely..."
        isCancelling
        onOpenChange={() => {}}
        onCancelUpload={() => {}}
      />,
    );

    expect(markup).toContain('Cancelling safely...');
  });

  it('allows close requests after upload reaches summary', () => {
    const onOpenChange = vi.fn();
    renderToStaticMarkup(
      <UploadOperationModal
        open
        wizardStep="summary"
        blocking={false}
        progress={100}
        progressPhase="writing"
        progressMessage=""
        completionResult={{
          success: true,
          title: 'Import complete',
          message: 'All events were imported.',
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
