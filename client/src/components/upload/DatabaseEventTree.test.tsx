import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { DatabaseEventTree } from '@/components/upload/DatabaseEventTree';
import type { DatasetInfo, ProgramVersionSummary } from '@/types/upload';

const openMetadataEditDialog = vi.fn();

vi.mock('@/stores/metadata-edit-dialog-store', () => ({
  openMetadataEditDialog: (...args: unknown[]) => openMetadataEditDialog(...args),
}));

vi.mock('@/components/ui/collapsible', () => ({
  Collapsible: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CollapsibleContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CollapsibleTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const programVersions: ProgramVersionSummary[] = [
  {
    program_id: 'P1',
    version: 'V1',
    event_count: 12,
    statuses: ['Approved'],
    has_channel_map: true,
    missing_channel_map: false,
    pending_artifact_count: 0,
    failed_artifact_count: 0,
  },
];

const datasets: DatasetInfo[] = [
  {
    event_id: 'e1',
    program_id: 'P1',
    version: 'V1',
    status: 'Approved',
    steering: 'LHD',
    rfq: true,
    dv: false,
    pv: false,
    post_prod: false,
    gvw: '4000',
    job_number: 'J1',
    work_order: 'WO1',
    uploaded_at: '2026-01-01T00:00:00Z',
    uploaded_by: 'tester',
    owner_id: 1,
    file_size: 100,
    artifact_status: 'ready',
  },
];

const baseProps = {
  datasets,
  programVersions,
  selectedDatasets: [] as string[],
  onBatchSelect: vi.fn(),
  isDeletingIds: [] as string[],
  columnDefinitions: [{ key: 'status', label: 'Status' }],
  getColumnValue: () => '',
  columnWidths: { status: 120 },
  programIdWidth: 240,
};

describe('DatabaseEventTree metadata edit pencil', () => {
  it('replaces the version-row event count with an accessible pencil action', () => {
    openMetadataEditDialog.mockClear();

    const markup = renderToStaticMarkup(<DatabaseEventTree {...baseProps} />);

    expect(markup).toContain('data-testid="version-metadata-edit-button"');
    expect(markup).toContain(
      'aria-label="Edit metadata for P1 V1 (12 events)"',
    );
    expect(markup).not.toMatch(/V1[\s\S]*\(12\)/);
    expect(markup).toContain('(12)');
  });

  it('keeps the program-row event count text', () => {
    const markup = renderToStaticMarkup(<DatabaseEventTree {...baseProps} />);

    expect(markup).toContain('P1');
    expect(markup).toMatch(/P1[\s\S]*\(12\)/);
  });
});
