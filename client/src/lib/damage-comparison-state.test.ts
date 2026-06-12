import { describe, expect, it } from 'vitest';

import {
  deriveProgramVersionScopeFromComparisonState,
  getDefaultDamageComparisonState,
  mergeDamageComparisonState,
  pruneMissingChannelKeys,
  pruneMissingEventIds,
} from './damage-comparison-state';

describe('damage comparison state defaults and merge', () => {
  it('returns the canonical default comparison state', () => {
    expect(getDefaultDamageComparisonState()).toEqual({
      reference: { selected_event_ids: [] },
      target: { selected_event_ids: [] },
      selected_channel_keys: [],
      value_mode: 'absolute',
      aggregation_event_scope: 'selected_only',
    });
  });

  it('merges partial updates without dropping unrelated comparison fields', () => {
    const merged = mergeDamageComparisonState(
      {
        reference: { selected_event_ids: ['event-ref-1'] },
        target: { selected_event_ids: ['event-target-1'] },
        selected_channel_keys: ['channel-a', 'channel-b'],
        value_mode: 'absolute',
        aggregation_event_scope: 'selected_only',
      },
      {
        target: { selected_event_ids: ['event-target-2'] },
        value_mode: 'normalized',
      },
    );

    expect(merged).toEqual({
      reference: { selected_event_ids: ['event-ref-1'] },
      target: { selected_event_ids: ['event-target-2'] },
      selected_channel_keys: ['channel-a', 'channel-b'],
      value_mode: 'normalized',
      aggregation_event_scope: 'selected_only',
    });
  });
});

describe('damage comparison prune helpers', () => {
  const state = {
    reference: { selected_event_ids: ['event-1', 'event-missing', 'event-2'] },
    target: { selected_event_ids: ['event-2', 'event-missing'] },
    selected_channel_keys: ['max', 'damage', 'missing'],
    value_mode: 'absolute' as const,
    aggregation_event_scope: 'selected_only' as const,
  };

  it('prunes missing event ids from both reference and target selections', () => {
    const pruned = pruneMissingEventIds(state, new Set(['event-1', 'event-2']));

    expect(pruned.reference.selected_event_ids).toEqual(['event-1', 'event-2']);
    expect(pruned.target.selected_event_ids).toEqual(['event-2']);
  });

  it('prunes missing channel keys deterministically', () => {
    const pruned = pruneMissingChannelKeys(state, new Set(['damage', 'max']));

    expect(pruned.selected_channel_keys).toEqual(['max', 'damage']);
  });
});

describe('program/version scope derivation', () => {
  it('derives program and version scope from selected comparison event ids', () => {
    const scope = deriveProgramVersionScopeFromComparisonState(
      {
        reference: { selected_event_ids: ['event-1', 'event-2'] },
        target: { selected_event_ids: ['event-2', 'event-3', 'event-unknown'] },
        selected_channel_keys: [],
        value_mode: 'absolute',
        aggregation_event_scope: 'selected_only',
      },
      [
        { event_id: 'event-1', program_id: 'P2', version: 'V1' },
        { event_id: 'event-2', program_id: 'P1', version: 'V2' },
        { event_id: 'event-3', program_id: 'P1', version: 'V1' },
      ],
    );

    expect(scope).toEqual({
      program_ids: ['P1', 'P2'],
      versions: ['V1', 'V2'],
      program_version_keys: ['P1::V1', 'P1::V2', 'P2::V1'],
    });
  });
});
