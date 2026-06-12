import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import type { EventMetadata } from '@/types/api';
import { LoadDataSection } from './LoadDataSection';

const updateDataState = vi.fn();
const useFilterStateMock = vi.fn();
const useEventCatalogMock = vi.fn();
const useEventTreeColorPropsMock = vi.fn(() => ({}));

type CapturedTreeProps = {
  onToggleEvent: (eventId: string) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
  emptyMessage: string;
};

let capturedTreeProps: CapturedTreeProps | null = null;

vi.mock('@/hooks/use-filter-state', () => ({
  useFilterState: () => useFilterStateMock(),
}));

vi.mock('@/hooks/use-event-catalog', () => ({
  useEventCatalog: () => useEventCatalogMock(),
}));

vi.mock('@/hooks/use-event-tree-color-props', () => ({
  useEventTreeColorProps: () => useEventTreeColorPropsMock(),
}));

vi.mock('@/components/dashboard/shared/HierarchicalEventTree', () => ({
  HierarchicalEventTree: (props: CapturedTreeProps) => {
    capturedTreeProps = props;
    return <div data-testid="hierarchical-event-tree" />;
  },
}));

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
    selectable_for_plotting: false,
  },
];

describe('LoadDataSection', () => {
  it('keeps single-pool selection behavior for toggle/select-all/select-none', () => {
    updateDataState.mockClear();
    capturedTreeProps = null;
    useFilterStateMock.mockReturnValue({
      dataState: { selected_event_ids: ['event-1'], program_ids: ['P1'], versions: ['V1'] },
      updateDataState,
    });
    useEventCatalogMock.mockReturnValue({
      events,
      isLoading: false,
    });

    renderToStaticMarkup(<LoadDataSection />);
    expect(capturedTreeProps).not.toBeNull();

    capturedTreeProps?.onToggleEvent('event-1');
    expect(updateDataState).toHaveBeenCalledWith({ selected_event_ids: [] });

    capturedTreeProps?.onSelectAll();
    expect(updateDataState).toHaveBeenCalledWith({ selected_event_ids: ['event-1'] });

    capturedTreeProps?.onSelectNone();
    expect(updateDataState).toHaveBeenCalledWith({
      selected_event_ids: [],
      program_ids: [],
      versions: [],
    });
  });

  it('passes the default empty message through to the event tree', () => {
    updateDataState.mockClear();
    capturedTreeProps = null;
    useFilterStateMock.mockReturnValue({
      dataState: { selected_event_ids: [], program_ids: [], versions: [] },
      updateDataState,
    });
    useEventCatalogMock.mockReturnValue({
      events: [],
      isLoading: false,
    });

    renderToStaticMarkup(<LoadDataSection />);
    expect(capturedTreeProps?.emptyMessage).toBe('No events available');
  });
});
