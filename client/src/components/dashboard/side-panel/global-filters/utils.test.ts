import { describe, expect, it } from 'vitest';
import type { EventMetadata, GlobalFilters } from '@/types/api';
import {
  buildActiveFilterChips,
  buildCountsByField,
  isGlobalFiltersActive,
  normalizeFilters,
  removeFilterField,
  upsertFilterValue,
} from './utils';

function makeEvent(
  overrides: Partial<EventMetadata> = {},
): EventMetadata {
  return {
    event_id: 'E-1',
    program_id: 'P-1',
    version: 'V-1',
    status: 'Approved',
    ...overrides,
  };
}

describe('global filter utils', () => {
  it('detects active filters for arrays and query text', () => {
    expect(isGlobalFiltersActive({})).toBe(false);
    expect(isGlobalFiltersActive({ status: [] })).toBe(false);
    expect(isGlobalFiltersActive({ event_id_query: '   ' })).toBe(false);
    expect(isGlobalFiltersActive({ status: ['Approved'] })).toBe(true);
    expect(isGlobalFiltersActive({ event_id_query: 'EVT-1' })).toBe(true);
  });

  it('normalizes by removing empty fields and trimming query text', () => {
    const filters: GlobalFilters = {
      status: [],
      work_order: ['WO-1'],
      event_id_query: '  EVT-1  ',
      ignored_text: '',
    };

    expect(normalizeFilters(filters)).toEqual({
      work_order: ['WO-1'],
      event_id_query: 'EVT-1',
    });
  });

  it('upserts and removes values while keeping arrays unique', () => {
    const start: GlobalFilters = { status: ['Approved'] };

    const added = upsertFilterValue(start, 'status', 'Pending', true);
    expect(added).toEqual({ status: ['Approved', 'Pending'] });

    const duplicateIgnored = upsertFilterValue(added, 'status', 'Pending', true);
    expect(duplicateIgnored).toEqual({ status: ['Approved', 'Pending'] });

    const removed = upsertFilterValue(duplicateIgnored, 'status', 'Approved', false);
    expect(removed).toEqual({ status: ['Pending'] });

    const removedLast = upsertFilterValue(removed, 'status', 'Pending', false);
    expect(removedLast).toEqual({});
  });

  it('removes a field from global filters', () => {
    const filters: GlobalFilters = {
      status: ['Approved'],
      event_id_query: 'EVT-1',
    };
    expect(removeFilterField(filters, 'status')).toEqual({ event_id_query: 'EVT-1' });
  });

  it('builds count indexes across core and custom metadata fields', () => {
    const events: EventMetadata[] = [
      makeEvent({
        status: 'Approved',
        work_order: 'WO-1',
        rfq: true,
        custom_fields: { plant: 'A' },
      }),
      makeEvent({
        event_id: 'E-2',
        status: 'Pending',
        work_order: 'WO-1',
        rfq: false,
        custom_fields: { plant: 'B' },
      }),
      makeEvent({
        event_id: 'E-3',
        status: 'Approved',
        work_order: 'WO-2',
      }),
    ];

    const result = buildCountsByField(events, ['status', 'work_order', 'rfq', 'plant']);

    expect(Object.fromEntries(result.status.entries())).toEqual({
      Approved: 2,
      Pending: 1,
    });
    expect(Object.fromEntries(result.work_order.entries())).toEqual({
      'WO-1': 2,
      'WO-2': 1,
    });
    expect(Object.fromEntries(result.rfq.entries())).toEqual({
      Applicable: 1,
      'Not Applicable': 1,
    });
    expect(Object.fromEntries(result.plant.entries())).toEqual({
      A: 1,
      B: 1,
    });
  });

  it('builds active filter chips with display-name mapping', () => {
    const chips = buildActiveFilterChips(
      {
        status: ['Approved', 'Pending'],
        work_order: ['WO-1'],
        event_id_query: '  EVT-42 ',
      },
      {
        status: 'Status',
        work_order: 'Work Order',
      },
    );

    expect(chips).toEqual([
      { field: 'status', displayName: 'Status', value: 'Approved' },
      { field: 'status', displayName: 'Status', value: 'Pending' },
      { field: 'work_order', displayName: 'Work Order', value: 'WO-1' },
      { field: 'event_id_query', displayName: 'Event ID', value: 'EVT-42' },
    ]);
  });
});
