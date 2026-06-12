import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { DurabilitySchedulePanel } from '@/components/edit-metadata/DurabilitySchedulePanel';

const mockUseQuery = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    loading: vi.fn(),
  },
}));

vi.mock('@/lib/api', () => ({
  dashboardApi: {
    getProgramVersionSchedule: vi.fn(),
    getEvents: vi.fn(),
    attachProgramVersionSchedule: vi.fn(),
    saveProgramVersionSchedule: vi.fn(),
  },
  APIError: class APIError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));

vi.mock('@/components/edit-metadata/DurabilityScheduleTable', () => ({
  DurabilityScheduleTable: ({
    editable,
    highlightedFieldsByRowId,
  }: {
    editable?: boolean;
    highlightedFieldsByRowId?: Record<string, string[]>;
  }) => (
    <div
      data-testid="durability-schedule-table"
      data-editable={String(Boolean(editable))}
      data-highlighted-rows={JSON.stringify(highlightedFieldsByRowId ?? {})}
    />
  ),
}));

vi.mock('@/stores/damage-calculation-store', () => ({
  useDamageCalculationStore: (selector: (state: { scopes: Record<string, unknown> }) => unknown) =>
    selector({ scopes: {} }),
}));

vi.mock('@/components/edit-metadata/ScheduleUploadDialog', () => ({
  ScheduleUploadDialog: () => <div data-testid="schedule-upload-dialog" />,
}));

const attachedSchedule = {
  program_id: 'P1',
  version: 'V1',
  schedule_id: 9,
  artifact_uri: 'uri',
  schedule_sha256: 'sha',
  source_filename: 'test.sch',
  parse_preview: {
    schedule_id: 'SCH-1',
    multiplier: 2,
    entry_count: 1,
    entries: [{ pattern: 'P1', repeats: 1, weight: 1 }],
    entries_preview: [],
    event_rows: [
      {
        event_id: 'row-1',
        rsp_file_name: 'event.rsp',
        rsp_event_name: 'event',
        pattern: 'P1',
        repeats: 1,
        weight: 1,
        schedule_sequence: 1,
      },
    ],
    delimiter_token: 'bt1cc',
  },
};

function mockQueries({
  scheduleData = attachedSchedule as typeof attachedSchedule | null,
  scheduleLoading = false,
  eventsLoading = false,
}: {
  scheduleData?: typeof attachedSchedule | null;
  scheduleLoading?: boolean;
  eventsLoading?: boolean;
} = {}) {
  mockUseQuery.mockImplementation(({ queryKey }: { queryKey: string[] }) => {
    if (queryKey[0] === 'program-version-schedule') {
      return {
        data: scheduleData,
        isLoading: scheduleLoading,
      };
    }
    if (queryKey[0] === 'program-version-events') {
      return {
        data: { events: [] },
        isLoading: eventsLoading,
      };
    }
    return { data: undefined, isLoading: false };
  });
}

describe('DurabilitySchedulePanel', () => {
  it('prompts for scope when program and version are missing', () => {
    mockQueries();

    const markup = renderToStaticMarkup(
      <DurabilitySchedulePanel scope={{ programId: '', version: '' }} canWrite />,
    );

    expect(markup).toContain('data-testid="durability-schedule-panel"');
    expect(markup).toContain('Select a Program ID and Version to edit its durability schedule.');
  });

  it('renders scoped loading state for the selected program/version', () => {
    mockQueries({ scheduleLoading: true });

    const markup = renderToStaticMarkup(
      <DurabilitySchedulePanel scope={{ programId: 'P1', version: 'V1' }} canWrite />,
    );

    expect(markup).toContain('data-scope="P1::V1"');
    expect(markup).toContain('Loading durability schedule...');
  });

  it('shows the no-schedule state when nothing is attached', () => {
    mockQueries({ scheduleData: null });

    const markup = renderToStaticMarkup(
      <DurabilitySchedulePanel scope={{ programId: 'P1', version: 'V1' }} canWrite />,
    );

    expect(markup).toContain('No durability schedule is attached for this program/version.');
    expect(markup).toContain('data-testid="durability-schedule-upload"');
  });

  it('shows the active schedule summary and table when a schedule is attached', () => {
    mockQueries();

    const markup = renderToStaticMarkup(
      <DurabilitySchedulePanel scope={{ programId: 'P1', version: 'V1' }} canWrite />,
    );

    expect(markup).toContain('Active schedule:');
    expect(markup).toContain('SCH-1');
    expect(markup).toContain('1 pattern');
    expect(markup).toContain('multiplier 2');
    expect(markup).toContain('data-testid="durability-schedule-table"');
  });

  it('reports clean dirty state when draft matches the loaded baseline', () => {
    mockQueries();

    const markup = renderToStaticMarkup(
      <DurabilitySchedulePanel scope={{ programId: 'P1', version: 'V1' }} canWrite />,
    );

    expect(markup).toContain('data-is-dirty="false"');
  });

  it('disables Reset and Save when there are no unsaved edits', () => {
    mockQueries();

    const markup = renderToStaticMarkup(
      <DurabilitySchedulePanel scope={{ programId: 'P1', version: 'V1' }} canWrite />,
    );

    expect(markup).toContain('data-testid="durability-schedule-reset"');
    expect(markup).toMatch(/data-testid="durability-schedule-reset"[^>]*disabled=""/);
    expect(markup).toContain('data-testid="durability-schedule-save"');
    expect(markup).toMatch(/data-testid="durability-schedule-save"[^>]*disabled=""/);
  });

  it('hides upload, reset, and save for read-only users when no schedule is attached', () => {
    mockQueries({ scheduleData: null });

    const markup = renderToStaticMarkup(
      <DurabilitySchedulePanel scope={{ programId: 'P1', version: 'V1' }} canWrite={false} />,
    );

    expect(markup).toContain('data-can-write="false"');
    expect(markup).not.toContain('data-testid="durability-schedule-upload"');
    expect(markup).not.toContain('data-testid="durability-schedule-reset"');
    expect(markup).not.toContain('data-testid="durability-schedule-save"');
  });

  it('keeps schedule review read-only when write access is denied', () => {
    mockQueries();

    const markup = renderToStaticMarkup(
      <DurabilitySchedulePanel scope={{ programId: 'P1', version: 'V1' }} canWrite={false} />,
    );

    expect(markup).toContain('data-can-write="false"');
    expect(markup).toContain('data-editable="false"');
    expect(markup).not.toContain('data-testid="durability-schedule-reset"');
    expect(markup).not.toContain('data-testid="durability-schedule-save"');
  });

  it('hides inline upload when the parent shell owns schedule upload', () => {
    mockQueries({ scheduleData: null });

    const markup = renderToStaticMarkup(
      <DurabilitySchedulePanel
        scope={{ programId: 'P1', version: 'V1' }}
        canWrite
        showUploadAffordance={false}
      />,
    );

    expect(markup).not.toContain('data-testid="durability-schedule-upload"');
    expect(markup).toContain('Upload a `.sch` file in the side panel and click Extract to attach a schedule.');
  });

  it('renders Upload alongside Reset and Save for write users', () => {
    mockQueries();

    const markup = renderToStaticMarkup(
      <DurabilitySchedulePanel scope={{ programId: 'P1', version: 'V1' }} canWrite />,
    );

    expect(markup).toContain('data-testid="durability-schedule-upload"');
    expect(markup).toContain('data-testid="durability-schedule-reset"');
    expect(markup).toContain('data-testid="durability-schedule-save"');
  });
});
