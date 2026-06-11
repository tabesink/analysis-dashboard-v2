import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { DatabaseDerivedDataOperationModals } from '@/features/edit-metadata/DatabaseDerivedDataOperationModals';

const mockChannelReprocessScopes: Record<
  string,
  {
    taskId: string;
    status: 'running' | 'completed' | 'failed';
    modalOpen: boolean;
    wizardStep: 'progress' | 'summary';
    progress: number;
    progressPhase: 'validating' | 'extracting' | 'generating';
    progressMessage: string;
    completionResult: null;
  }
> = {};

const mockDamageCalculationScopes: Record<
  string,
  {
    taskId: string;
    status: 'running' | 'completed' | 'failed';
    modalOpen: boolean;
    wizardStep: 'progress' | 'summary';
    progress: number;
    progressPhase: 'validating' | 'calculating';
    progressMessage: string;
    completionResult: null;
    scheduleDamageReport: null;
  }
> = {};

vi.mock('@/stores/channel-reprocess-store', () => ({
  closeChannelReprocessSummary: vi.fn(),
  dismissChannelReprocessModal: vi.fn(),
  useChannelReprocessStore: <T,>(selector: (state: { scopes: typeof mockChannelReprocessScopes }) => T) =>
    selector({ scopes: mockChannelReprocessScopes }),
}));

vi.mock('@/stores/damage-calculation-store', () => ({
  closeDamageCalculationSummary: vi.fn(),
  dismissDamageCalculationModal: vi.fn(),
  useDamageCalculationStore: <T,>(selector: (state: { scopes: typeof mockDamageCalculationScopes }) => T) =>
    selector({ scopes: mockDamageCalculationScopes }),
}));

vi.mock('@/features/edit-metadata/DerivedDataOperationModal', () => ({
  DerivedDataOperationModal: ({
    open,
    taskKind,
  }: {
    open: boolean;
    taskKind?: string;
  }) =>
    open ? (
      <div
        data-testid="derived-data-operation-modal"
        data-task-kind={taskKind ?? 'channel_reprocess'}
      />
    ) : null,
}));

describe('DatabaseDerivedDataOperationModals', () => {
  it('renders a shell-mounted channel reprocess modal for active scoped store state', () => {
    Object.keys(mockChannelReprocessScopes).forEach((key) => {
      delete mockChannelReprocessScopes[key];
    });
    Object.keys(mockDamageCalculationScopes).forEach((key) => {
      delete mockDamageCalculationScopes[key];
    });

    mockChannelReprocessScopes['P1::V1'] = {
      taskId: 'task-1',
      status: 'running',
      modalOpen: true,
      wizardStep: 'progress',
      progress: 12,
      progressPhase: 'validating',
      progressMessage: 'Validating artifact 1/3: event_a.csv',
      completionResult: null,
    };

    const markup = renderToStaticMarkup(<DatabaseDerivedDataOperationModals />);

    expect(markup).toContain('data-testid="derived-data-operation-modal"');
    expect(markup).toContain('data-task-kind="channel_reprocess"');
  });

  it('does not render duplicate modals when metadata editor would also track the same scope', () => {
    Object.keys(mockChannelReprocessScopes).forEach((key) => {
      delete mockChannelReprocessScopes[key];
    });
    Object.keys(mockDamageCalculationScopes).forEach((key) => {
      delete mockDamageCalculationScopes[key];
    });

    mockChannelReprocessScopes['JOB-42::R3'] = {
      taskId: 'task-42',
      status: 'running',
      modalOpen: true,
      wizardStep: 'progress',
      progress: 30,
      progressPhase: 'generating',
      progressMessage: 'Generating cross-plot data: event_042 - bj_xy_force_plot (4,872 points)',
      completionResult: null,
    };

    const markup = renderToStaticMarkup(<DatabaseDerivedDataOperationModals />);
    const modalCount = (markup.match(/data-testid="derived-data-operation-modal"/g) ?? []).length;

    expect(modalCount).toBe(1);
  });
});
