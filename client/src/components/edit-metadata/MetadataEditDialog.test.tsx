import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MetadataEditDialog } from '@/components/edit-metadata/MetadataEditDialog';

let mockIsOpen = false;
let mockProgramId = '';
let mockVersion = '';
let mockPendingScope: { programId: string; version: string } | null = null;
let mockCanWrite = true;

vi.mock('@radix-ui/react-dialog', () => ({
  Root: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="metadata-edit-dialog-root">{children}</div> : null,
  Portal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Overlay: () => <div data-testid="metadata-edit-dialog-overlay" />,
  Content: ({
    children,
    onOpenAutoFocus,
  }: {
    children: React.ReactNode;
    onOpenAutoFocus?: (event: { preventDefault: () => void }) => void;
  }) => {
    onOpenAutoFocus?.({ preventDefault: () => undefined });
    return <div data-testid="metadata-edit-dialog-content">{children}</div>;
  },
  Title: ({ children }: { children: React.ReactNode }) => <h1>{children}</h1>,
}));

vi.mock('@/stores/metadata-edit-dialog-store', () => ({
  closeMetadataEditDialog: vi.fn(),
  clearPendingMetadataEditDialogScope: vi.fn(),
  applyPendingMetadataEditDialogScope: vi.fn(),
  useMetadataEditDialogStore: <T,>(
    selector: (state: {
      isOpen: boolean;
      programId: string;
      version: string;
      pendingScope: { programId: string; version: string } | null;
      pendingSection: string | null;
    }) => T,
  ) =>
    selector({
      isOpen: mockIsOpen,
      programId: mockProgramId,
      version: mockVersion,
      pendingScope: mockPendingScope,
      pendingSection: null,
    }),
}));

vi.mock('@/stores/auth-store', () => ({
  selectCanWrite: (state: { canWrite: boolean }) => state.canWrite,
  useAuthStore: <T,>(selector: (state: { canWrite: boolean }) => T) =>
    selector({ canWrite: mockCanWrite }),
}));

let mockChannelReprocessScopeState: {
  taskId: string;
  status: 'running';
  modalOpen: boolean;
  wizardStep: 'progress';
  progress: number;
  progressPhase: 'validating';
  progressMessage: string;
  completionResult: null;
} | null = null;

vi.mock('@/stores/channel-reprocess-store', () => ({
  reopenChannelReprocessModal: vi.fn(),
  useChannelReprocessStore: <T,>(
    selector: (state: { scopes: Record<string, NonNullable<typeof mockChannelReprocessScopeState>> }) => T,
  ) =>
    selector({
      scopes:
        mockChannelReprocessScopeState && mockProgramId && mockVersion
          ? { [`${mockProgramId}::${mockVersion}`]: mockChannelReprocessScopeState }
          : {},
    }),
}));

vi.mock('@/stores/damage-calculation-store', () => ({
  reopenDamageCalculationModal: vi.fn(),
  useDamageCalculationStore: <T,>(selector: (state: { scopes: Record<string, never> }) => T) =>
    selector({ scopes: {} }),
}));

vi.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="metadata-edit-discard-dialog-root">{children}</div> : null,
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="metadata-edit-discard-dialog">{children}</div>
  ),
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogCancel: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  AlertDialogAction: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
}));

vi.mock('@/components/edit-metadata/EditMetadataPanel', () => ({
  EditMetadataPanel: ({
    scope,
    canWrite,
    onDirtyChange,
    onStatusDraftChange,
  }: {
    scope: { programId: string; version: string };
    canWrite?: boolean;
    onDirtyChange?: (isDirty: boolean) => void;
    onStatusDraftChange?: (status: string | null) => void;
  }) => {
    onDirtyChange?.(false);
    onStatusDraftChange?.('Draft');
    return (
      <div data-testid="edit-metadata-panel" data-can-write={String(canWrite ?? true)}>
        {scope.programId}::{scope.version}
      </div>
    );
  },
}));

vi.mock('@/components/edit-metadata/AssignChannelsPanel', () => ({
  AssignChannelsPanel: ({
    scope,
    canWrite,
    onDirtyChange,
  }: {
    scope: { programId: string; version: string };
    canWrite?: boolean;
    onDirtyChange?: (isDirty: boolean) => void;
  }) => {
    onDirtyChange?.(false);
    return (
      <div data-testid="assign-channels-panel" data-can-write={String(canWrite ?? true)}>
        {scope.programId}::{scope.version}
      </div>
    );
  },
}));

let mockScheduleDirty = false;

vi.mock('@/components/edit-metadata/MetadataDialogHeader', () => ({
  MetadataDialogHeader: ({
    programId,
    version,
    statusDraftValue,
  }: {
    programId: string;
    version: string;
    statusDraftValue?: string | null;
  }) => (
    <header data-testid="metadata-dialog-header">
      <h2>Event Details</h2>
      <span>Program ID</span>
      <span>{programId}</span>
      <span>Version</span>
      <span>{version}</span>
      <span>Status</span>
      <span>{statusDraftValue ?? 'rolled-up'}</span>
    </header>
  ),
}));

vi.mock('@/components/edit-metadata/DurabilitySchedulePanel', () => ({
  DurabilitySchedulePanel: ({
    scope,
    canWrite,
    showUploadAffordance,
    onDirtyChange,
  }: {
    scope: { programId: string; version: string };
    canWrite?: boolean;
    showUploadAffordance?: boolean;
    onDirtyChange?: (isDirty: boolean) => void;
  }) => {
    onDirtyChange?.(mockScheduleDirty);
    return (
      <div
        data-testid="durability-schedule-panel"
        data-can-write={String(canWrite ?? true)}
        data-show-upload={String(showUploadAffordance ?? true)}
      >
        {scope.programId}::{scope.version}
        <span data-testid="durability-schedule-upload" />
        <span data-testid="durability-schedule-reset" />
        <span data-testid="durability-schedule-save" />
      </div>
    );
  },
}));

describe('MetadataEditDialog', () => {
  beforeEach(() => {
    mockChannelReprocessScopeState = null;
  });

  it('renders nothing when closed', () => {
    mockIsOpen = false;
    mockProgramId = 'P1';
    mockVersion = 'V1';
    mockPendingScope = null;
    mockCanWrite = true;
    mockChannelReprocessScopeState = null;

    const markup = renderToStaticMarkup(<MetadataEditDialog />);
    expect(markup).toBe('');
  });

  it('renders all three nav sections and defaults to Edit Metadata', () => {
    mockIsOpen = true;
    mockProgramId = 'P1';
    mockVersion = 'V1';
    mockPendingScope = null;
    mockCanWrite = true;

    const markup = renderToStaticMarkup(<MetadataEditDialog />);

    expect(markup).toContain('data-testid="metadata-edit-dialog-root"');
    expect(markup).toContain('data-testid="metadata-edit-dialog-overlay"');
    expect(markup).toContain('data-testid="metadata-dialog-nav-edit-metadata"');
    expect(markup).toContain('data-testid="metadata-dialog-nav-assign-channels"');
    expect(markup).toContain('data-testid="metadata-dialog-nav-durability-schedule"');
    expect(markup).toContain('Edit Metadata');
    expect(markup).toContain('Assign Channels');
    expect(markup).toContain('Assign Schedule');
    expect(markup).toContain('aria-label="Edit Metadata section"');
    expect(markup).toContain('aria-label="Assign Channels section"');
    expect(markup).toContain('aria-label="Assign Schedule section"');
    expect(markup).toContain('data-testid="metadata-dialog-section-edit-metadata"');
    expect(markup).toContain('data-testid="metadata-dialog-section-assign-channels"');
    expect(markup).toContain('data-testid="metadata-dialog-section-durability-schedule"');
    expect(markup).toContain('data-testid="edit-metadata-panel"');
    expect(markup).toContain('data-testid="assign-channels-panel"');
    expect(markup).toContain('data-testid="durability-schedule-panel"');
    expect(markup).toContain('P1::V1');
  });

  it('shows Edit Metadata as the active nav item by default', () => {
    mockIsOpen = true;
    mockProgramId = 'P1';
    mockVersion = 'V1';
    mockPendingScope = null;
    mockCanWrite = true;
    mockChannelReprocessScopeState = null;

    const markup = renderToStaticMarkup(<MetadataEditDialog />);

    expect(markup).toMatch(
      /data-testid="metadata-dialog-nav-edit-metadata"[^>]*aria-current="page"/,
    );
    expect(markup).not.toMatch(
      /data-testid="metadata-dialog-nav-assign-channels"[^>]*aria-current="page"/,
    );
    expect(markup).not.toMatch(
      /data-testid="metadata-dialog-nav-durability-schedule"[^>]*aria-current="page"/,
    );
  });

  it('orders Durability Schedule directly below Assign Channels in the left nav', () => {
    mockIsOpen = true;
    mockProgramId = 'P1';
    mockVersion = 'V1';
    mockPendingScope = null;
    mockCanWrite = true;

    const markup = renderToStaticMarkup(<MetadataEditDialog />);

    expect(markup).toMatch(
      /data-testid="metadata-dialog-nav-edit-metadata"[\s\S]*data-testid="metadata-dialog-nav-assign-channels"[\s\S]*data-testid="metadata-dialog-nav-durability-schedule"/,
    );
  });

  it('keeps all scoped panels mounted while hiding inactive sections', () => {
    mockIsOpen = true;
    mockProgramId = 'P1';
    mockVersion = 'V1';
    mockPendingScope = null;
    mockCanWrite = true;

    const markup = renderToStaticMarkup(<MetadataEditDialog />);

    expect(markup).toContain('data-testid="edit-metadata-panel"');
    expect(markup).toContain('data-testid="assign-channels-panel"');
    expect(markup).toContain('data-testid="durability-schedule-panel"');
    expect(markup).toMatch(/data-testid="metadata-dialog-section-assign-channels"[^>]*hidden=""/);
    expect(markup).toMatch(/data-testid="metadata-dialog-section-durability-schedule"[^>]*hidden=""/);
  });

  it('passes write permission through to all panels', () => {
    mockIsOpen = true;
    mockProgramId = 'P1';
    mockVersion = 'V1';
    mockPendingScope = null;
    mockCanWrite = false;

    const markup = renderToStaticMarkup(<MetadataEditDialog />);

    expect(markup.match(/data-can-write="false"/g)?.length).toBe(3);
  });

  it('exposes accessible dialog controls for keyboard and screen-reader users', () => {
    mockIsOpen = true;
    mockProgramId = 'P1';
    mockVersion = 'V1';
    mockPendingScope = null;
    mockCanWrite = true;

    const markup = renderToStaticMarkup(<MetadataEditDialog />);

    expect(markup).toContain('aria-label="Close metadata editor"');
    expect(markup).toContain('aria-label="Metadata editor sections"');
    expect(markup).toContain('Event Details for P1 V1');
    expect(markup).toContain('data-testid="metadata-dialog-header"');
    expect(markup).toContain('Event Details');
    expect(markup).toContain('Program ID');
    expect(markup).toContain('Version');
    expect(markup).toContain('Status');
    expect(markup).toContain('>P1<');
    expect(markup).toContain('>V1<');
  });

  it('keeps Assign Channels reachable as a nav button without hiding Edit Metadata content by default', () => {
    mockIsOpen = true;
    mockProgramId = 'P1';
    mockVersion = 'V1';
    mockPendingScope = null;
    mockCanWrite = true;

    const markup = renderToStaticMarkup(<MetadataEditDialog />);

    expect(markup).toMatch(
      /data-testid="metadata-dialog-nav-assign-channels"/,
    );
    expect(markup).toMatch(
      /data-testid="metadata-dialog-nav-edit-metadata"/,
    );
    expect(markup).toContain('type="button"');
    expect(markup).not.toMatch(/data-testid="metadata-dialog-section-edit-metadata"[^>]*hidden=""/);
    expect(markup).toMatch(/data-testid="metadata-dialog-section-assign-channels"[^>]*hidden=""/);
  });

  it('scopes all mounted panels to the active dialog program and version', () => {
    mockIsOpen = true;
    mockProgramId = 'JOB-42';
    mockVersion = 'R3';
    mockPendingScope = null;
    mockCanWrite = true;

    const markup = renderToStaticMarkup(<MetadataEditDialog />);

    expect(markup.match(/JOB-42::R3/g)?.length).toBe(3);
  });

  it('exposes Durability Schedule upload and save affordances through the popup panel', () => {
    mockIsOpen = true;
    mockProgramId = 'P1';
    mockVersion = 'V1';
    mockPendingScope = null;
    mockCanWrite = true;

    const markup = renderToStaticMarkup(<MetadataEditDialog />);

    expect(markup).toContain('data-testid="durability-schedule-upload"');
    expect(markup).toContain('data-testid="durability-schedule-reset"');
    expect(markup).toContain('data-testid="durability-schedule-save"');
    expect(markup).toContain('data-show-upload="true"');
  });

  it('does not render a channel reprocess operation modal inside the metadata editor shell', () => {
    mockIsOpen = true;
    mockProgramId = 'P1';
    mockVersion = 'V1';
    mockPendingScope = null;
    mockCanWrite = true;
    mockChannelReprocessScopeState = {
      taskId: 'task-1',
      status: 'running',
      modalOpen: true,
      wizardStep: 'progress',
      progress: 12,
      progressPhase: 'validating',
      progressMessage: 'Validating artifact 1/3: event_a.csv',
      completionResult: null,
    };

    const markup = renderToStaticMarkup(<MetadataEditDialog />);

    expect(markup).not.toContain('data-testid="derived-data-operation-modal"');
  });

  it('does not render the discard prompt until a close or scope-change action occurs', () => {
    mockIsOpen = true;
    mockProgramId = 'P1';
    mockVersion = 'V1';
    mockPendingScope = { programId: 'P2', version: 'V2' };
    mockCanWrite = true;
    mockScheduleDirty = false;

    const markup = renderToStaticMarkup(<MetadataEditDialog />);

    expect(markup).not.toContain('data-testid="metadata-edit-discard-dialog-root"');
  });
});
