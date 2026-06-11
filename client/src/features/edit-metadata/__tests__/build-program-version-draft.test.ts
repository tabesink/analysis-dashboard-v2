import { describe, expect, it } from 'vitest';

import type { EventMetadata, FilterOptions } from '@/types/api';

import {
  buildProgramVersionDraftValues,
  buildProgramVersionPhaseDraftValues,
  toClearedDraftValues,
  toClearedPhaseDraftValues,
} from '../lib/build-program-version-draft';

const filterOptions: FilterOptions = {
  'Steering Position': {
    column: 'steering_position',
    values: ['LHD', 'RHD'],
    order: 1,
    source: 'core',
  },
  Status: { column: 'status', values: ['Pending', 'Approved'], order: 0, source: 'core' },
};

const baseEvent: EventMetadata = {
  event_id: 'e1',
  program_id: 'P1',
  version: 'V1',
  steering_position: 'LHD',
  status: 'Pending',
  rfq: true,
  dv: false,
  pv: false,
  post_prod: false,
  gvw: '4000',
  fgawr: undefined,
  rgawr: undefined,
};

describe('buildProgramVersionDraftValues', () => {
  it('initializes draft and baseline when all events share the same value', () => {
    const { draft, baseline } = buildProgramVersionDraftValues(filterOptions, [
      baseEvent,
      { ...baseEvent, event_id: 'e2' },
    ]);

    expect(draft['Steering Position']).toBe('LHD');
    expect(baseline['Steering Position']).toBe('LHD');
    expect(draft['GVW (lbs)']).toBe('4000');
    expect(baseline['GVW (lbs)']).toBe('4000');
  });

  it('shows mixed-value placeholder when events disagree', () => {
    const { draft, baseline } = buildProgramVersionDraftValues(filterOptions, [
      baseEvent,
      { ...baseEvent, event_id: 'e2', steering_position: 'RHD' },
    ]);

    expect(draft['Steering Position']).toBe('');
    expect(baseline['Steering Position']).toBe('');
  });

  it('shows value with empty baseline when some events are null', () => {
    const { draft, baseline } = buildProgramVersionDraftValues(filterOptions, [
      baseEvent,
      { ...baseEvent, event_id: 'e2', steering_position: undefined },
    ]);

    expect(draft['Steering Position']).toBe('LHD');
    expect(baseline['Steering Position']).toBe('');
  });
});

describe('buildProgramVersionPhaseDraftValues', () => {
  it('checks a phase only when every event has it enabled', () => {
    const allRfq = buildProgramVersionPhaseDraftValues([
      baseEvent,
      { ...baseEvent, event_id: 'e2', rfq: true },
    ]);
    expect(allRfq.rfq).toBe(true);

    const mixedRfq = buildProgramVersionPhaseDraftValues([
      baseEvent,
      { ...baseEvent, event_id: 'e2', rfq: false },
    ]);
    expect(mixedRfq.rfq).toBe(false);
  });
});

describe('toClearedDraftValues', () => {
  it('returns empty strings for every configured field', () => {
    const cleared = toClearedDraftValues(filterOptions);
    expect(cleared['Steering Position']).toBe('');
    expect(cleared['GVW (lbs)']).toBe('');
  });
});

describe('toClearedPhaseDraftValues', () => {
  it('returns every phase unchecked', () => {
    expect(toClearedPhaseDraftValues()).toEqual({
      rfq: false,
      dv: false,
      pv: false,
      post_prod: false,
    });
  });
});
