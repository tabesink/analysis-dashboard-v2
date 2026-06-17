import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import type { DamageComparisonState } from '@/types/damage-comparison';
import type { EventMetadata } from '@/types/api';
import { ComparisonLoadDataSections } from './ComparisonLoadDataSections';

type CapturedSectionProps = {
  sectionTitle: string;
  selectedEventIds: string[];
  emptyMessage: string;
  emptySelectionSubtitle: string;
  colorProps?: Record<string, unknown>;
  onSelectedEventIdsChange: (selectedEventIds: string[]) => void;
};

const capturedSections: CapturedSectionProps[] = [];

vi.mock('./LoadDataSection', () => ({
  LoadDataEventTreeSection: (props: CapturedSectionProps) => {
    capturedSections.push(props);
    return <div data-section-title={props.sectionTitle} />;
  },
}));
const toastInfo = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    info: (...args: unknown[]) => toastInfo(...args),
  },
}));

const baseComparison: DamageComparisonState = {
  reference: { selected_event_ids: [] },
  target: { selected_event_ids: [] },
  selected_channel_keys: ['bj_x_force', 'bj_y_force'],
  value_mode: 'absolute',
  aggregation_event_scope: 'selected_only',
};

const events: EventMetadata[] = [
  {
    event_id: 'event-1',
    program_id: 'P1',
    version: 'V1',
    status: 'Approved',
  },
  {
    event_id: 'event-2',
    program_id: 'P1',
    version: 'V1',
    status: 'Approved',
  },
  {
    event_id: 'event-3',
    program_id: 'P1',
    version: 'V2',
    status: 'Approved',
  },
];

describe('ComparisonLoadDataSections', () => {
  it('renders independent Reference and Target sections with distinct labels and subtitles', () => {
    capturedSections.length = 0;
    renderToStaticMarkup(
      <ComparisonLoadDataSections
        comparison={baseComparison}
        events={events}
        isLoading={false}
        onUpdateComparison={() => {}}
      />,
    );

    expect(capturedSections).toHaveLength(2);
    expect(capturedSections[0]?.sectionTitle).toBe('Load Data (Reference)');
    expect(capturedSections[0]?.emptySelectionSubtitle).toBe(
      'Select Reference events for comparison',
    );
    expect(capturedSections[1]?.sectionTitle).toBe('Load Data (Target)');
    expect(capturedSections[1]?.emptySelectionSubtitle).toBe(
      'Select Target events for comparison',
    );
  });

  it('does not pass color swatch props so damage trees hide controls but keep reserved spacing', () => {
    capturedSections.length = 0;
    renderToStaticMarkup(
      <ComparisonLoadDataSections
        comparison={baseComparison}
        events={events}
        isLoading={false}
        onUpdateComparison={() => {}}
      />,
    );

    expect(capturedSections[0]?.colorProps).toBeUndefined();
    expect(capturedSections[1]?.colorProps).toBeUndefined();
  });

  it('updates only reference selected event ids when reference section changes', () => {
    capturedSections.length = 0;
    const onUpdateComparison = vi.fn();

    renderToStaticMarkup(
      <ComparisonLoadDataSections
        comparison={baseComparison}
        events={events}
        isLoading={false}
        onUpdateComparison={onUpdateComparison}
      />,
    );

    capturedSections[0]?.onSelectedEventIdsChange(['event-1']);

    expect(onUpdateComparison).toHaveBeenCalledWith({
      reference: { selected_event_ids: ['event-1'] },
    });
  });

  it('updates only target selected event ids when target section changes', () => {
    capturedSections.length = 0;
    const onUpdateComparison = vi.fn();

    renderToStaticMarkup(
      <ComparisonLoadDataSections
        comparison={baseComparison}
        events={events}
        isLoading={false}
        onUpdateComparison={onUpdateComparison}
      />,
    );

    capturedSections[1]?.onSelectedEventIdsChange(['event-1']);

    expect(onUpdateComparison).toHaveBeenCalledWith({
      target: { selected_event_ids: ['event-1'] },
    });
  });

  it('provides empty guidance based on filtered catalog availability', () => {
    capturedSections.length = 0;

    renderToStaticMarkup(
      <ComparisonLoadDataSections
        comparison={baseComparison}
        events={[]}
        isLoading={false}
        onUpdateComparison={() => {}}
      />,
    );

    expect(capturedSections[0]?.emptyMessage).toBe('No events match current filters');
    expect(capturedSections[1]?.emptyMessage).toBe('No events match current filters');
  });

  it('keeps same-scope selections for reference side', () => {
    capturedSections.length = 0;
    const onUpdateComparison = vi.fn();

    renderToStaticMarkup(
      <ComparisonLoadDataSections
        comparison={baseComparison}
        events={events}
        isLoading={false}
        onUpdateComparison={onUpdateComparison}
      />,
    );

    capturedSections[0]?.onSelectedEventIdsChange(['event-1', 'event-2']);

    expect(onUpdateComparison).toHaveBeenCalledWith({
      reference: { selected_event_ids: ['event-1', 'event-2'] },
    });
  });

  it('replaces reference selection when a different program/version scope is selected', () => {
    capturedSections.length = 0;
    const onUpdateComparison = vi.fn();

    renderToStaticMarkup(
      <ComparisonLoadDataSections
        comparison={{
          ...baseComparison,
          reference: { selected_event_ids: ['event-1'] },
        }}
        events={events}
        isLoading={false}
        onUpdateComparison={onUpdateComparison}
      />,
    );

    capturedSections[0]?.onSelectedEventIdsChange(['event-1', 'event-3']);

    expect(onUpdateComparison).toHaveBeenCalledWith({
      reference: { selected_event_ids: ['event-3'] },
    });
  });

  it('resets active scope when reference selection is cleared', () => {
    capturedSections.length = 0;
    const onUpdateComparison = vi.fn();

    renderToStaticMarkup(
      <ComparisonLoadDataSections
        comparison={{
          ...baseComparison,
          reference: { selected_event_ids: ['event-1'] },
        }}
        events={events}
        isLoading={false}
        onUpdateComparison={onUpdateComparison}
      />,
    );

    capturedSections[0]?.onSelectedEventIdsChange([]);

    expect(onUpdateComparison).toHaveBeenCalledWith({
      reference: { selected_event_ids: [] },
    });
  });

  it('replaces target selection when a different program/version scope is selected', () => {
    capturedSections.length = 0;
    const onUpdateComparison = vi.fn();

    renderToStaticMarkup(
      <ComparisonLoadDataSections
        comparison={{
          ...baseComparison,
          target: { selected_event_ids: ['event-1'] },
        }}
        events={events}
        isLoading={false}
        onUpdateComparison={onUpdateComparison}
      />,
    );

    capturedSections[1]?.onSelectedEventIdsChange(['event-1', 'event-3']);

    expect(onUpdateComparison).toHaveBeenCalledWith({
      target: { selected_event_ids: ['event-3'] },
    });
  });

});
