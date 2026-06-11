import { describe, expect, it } from 'vitest';

import {
  isDamageCellDisplayable,
  isDamageCellStale,
  resolveInspectDamageViewState,
  toPlotDamageCell,
} from '@/features/inspect-damage/lib/inspect-damage-view-state';
import type { DamageInspectResponse } from '@/types/api';

const baseResponse: DamageInspectResponse = {
  channels: [],
  rows: [],
  has_stale_values: false,
  scopes: [],
};

describe('resolveInspectDamageViewState', () => {
  it('shows empty state with calculate action when prerequisites are current and no current results exist', () => {
    const state = resolveInspectDamageViewState({
      response: {
        ...baseResponse,
        scopes: [
          {
            program_id: 'P1',
            version: 'V1',
            has_current_results: false,
            has_stale_results: false,
            has_active_schedule: true,
            can_start_calculation: true,
          },
        ],
      },
      canWrite: true,
    });

    expect(state.showEmptyState).toBe(true);
    expect(state.showCalculateAction).toBe(true);
    expect(state.showPrerequisiteGuidance).toBe(false);
    expect(state.showStaleWarning).toBe(false);
  });

  it('shows stale warning and keeps calculate action available when stale values exist', () => {
    const state = resolveInspectDamageViewState({
      response: {
        ...baseResponse,
        has_stale_values: true,
        scopes: [
          {
            program_id: 'P1',
            version: 'V1',
            has_current_results: false,
            has_stale_results: true,
            has_active_schedule: true,
            can_start_calculation: true,
          },
        ],
      },
      canWrite: true,
    });

    expect(state.showEmptyState).toBe(false);
    expect(state.showStaleWarning).toBe(true);
    expect(state.showCalculateAction).toBe(true);
  });

  it('directs users to assign channels when prerequisites are missing', () => {
    const state = resolveInspectDamageViewState({
      response: {
        ...baseResponse,
        scopes: [
          {
            program_id: 'P1',
            version: 'V1',
            has_current_results: false,
            has_stale_results: false,
            has_active_schedule: true,
            can_start_calculation: false,
            prerequisite_report: {
              summary: 'Damage calculation prerequisites are not met',
              issues: [
                {
                  field: 'event_id',
                  code: 'missing_raw_load_histories',
                  message: 'Assign channels first',
                },
              ],
            },
          },
        ],
      },
      canWrite: true,
    });

    expect(state.showEmptyState).toBe(true);
    expect(state.showCalculateAction).toBe(false);
    expect(state.showPrerequisiteGuidance).toBe(true);
  });

  it('hides write-only actions for read-only users', () => {
    const state = resolveInspectDamageViewState({
      response: {
        ...baseResponse,
        scopes: [
          {
            program_id: 'P1',
            version: 'V1',
            has_current_results: false,
            has_stale_results: false,
            has_active_schedule: true,
            can_start_calculation: true,
          },
        ],
      },
      canWrite: false,
    });

    expect(state.showCalculateAction).toBe(false);
    expect(state.showPrerequisiteGuidance).toBe(false);
  });

  it('surfaces failure report context from scope state', () => {
    const state = resolveInspectDamageViewState({
      response: {
        ...baseResponse,
        scopes: [
          {
            program_id: 'P1',
            version: 'V1',
            has_current_results: false,
            has_stale_results: true,
            has_active_schedule: true,
            can_start_calculation: true,
            failure_report: {
              summary: 'Schedule validation failed',
              issues: [
                {
                  field: 'repeats',
                  code: 'blank_repeats',
                  message: 'Repeats is required',
                },
              ],
            },
          },
        ],
      },
      canWrite: true,
    });

    expect(state.failureReports).toHaveLength(1);
    expect(state.failureReports[0]?.summary).toBe('Schedule validation failed');
  });
});

describe('damage cell helpers', () => {
  it('marks stale cells for badge rendering', () => {
    expect(
      isDamageCellStale({
        damage: 0.1,
        status: 'stale',
        stale_reason: 'schedule_changed',
      }),
    ).toBe(true);
    expect(isDamageCellStale({ damage: 0.1, status: 'current' })).toBe(false);
  });

  it('maps persisted cells to plot-compatible ok status', () => {
    expect(
      toPlotDamageCell({
        damage: 0.2,
        base_damage: 0.1,
        status: 'current',
      }),
    ).toEqual({ damage: 0.2, status: 'ok', error: null });

    expect(
      toPlotDamageCell({
        damage: 0.2,
        base_damage: 0.1,
        status: 'stale',
        stale_reason: 'schedule_changed',
      }),
    ).toEqual({ damage: 0.2, status: 'ok', error: null });
  });

  it('keeps persisted error cells displayable with their failure message', () => {
    const cell = {
      damage: null,
      status: 'error',
      error: "No measurements found for mapped channel 'BJ X Force'",
    };

    expect(isDamageCellDisplayable(cell)).toBe(true);
    expect(toPlotDamageCell(cell)).toEqual({
      damage: null,
      status: 'error',
      error: "No measurements found for mapped channel 'BJ X Force'",
    });
  });
});
