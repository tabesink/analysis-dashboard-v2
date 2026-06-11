import { describe, expect, it } from 'vitest';

import {
  mapDerivedTaskProgress,
  type ChannelReprocessProgressPhase,
} from '@/features/edit-metadata/lib/derived-task-progress';
import type { DerivedTaskStatusEvent } from '@/types/api';

function event(
  overrides: Partial<DerivedTaskStatusEvent> = {},
): DerivedTaskStatusEvent {
  return {
    task_id: 'task-1',
    task_kind: 'channel_reprocess',
    status: 'running',
    phase: 'validating',
    completed_events: 0,
    total_events: 4,
    ...overrides,
  };
}

describe('mapDerivedTaskProgress', () => {
  it('uses the server progress message for validating artifacts', () => {
    const mapped = mapDerivedTaskProgress(
      event({
        phase: 'validating',
        sub_phase: 'artifact_validation',
        progress_message: 'Validating artifact 2/4: event_042.csv',
        completed_events: 1,
      }),
    );

    expect(mapped.progressMessage).toBe('Validating artifact 2/4: event_042.csv');
    expect(mapped.progressPhase).toBe('validating');
    expect(mapped.progress).toBeGreaterThan(0);
    expect(mapped.progress).toBeLessThan(30);
  });

  it('maps obsolete extraction events back to validation', () => {
    const mapped = mapDerivedTaskProgress(
      event({
        phase: 'extracting',
        sub_phase: 'raw_load_histories',
        progress_message: 'Legacy extraction phase',
        completed_events: 1,
      }),
    );

    expect(mapped.progressMessage).toBe('Legacy extraction phase');
    expect(mapped.progressPhase).toBe('validating');
    expect(mapped.progress).toBeLessThan(36);
  });

  it('uses locked copy for cross-plot generation', () => {
    const mapped = mapDerivedTaskProgress(
      event({
        phase: 'generating',
        sub_phase: 'cross_plot_lttb',
        progress_message:
          'Generating cross-plot data: event_042 - bj_xy_force_plot (4,872 points)',
        completed_events: 2,
      }),
    );

    expect(mapped.progressMessage).toBe(
      'Generating cross-plot data: event_042 - bj_xy_force_plot (4,872 points)',
    );
    expect(mapped.progressPhase).toBe('generating');
    expect(mapped.progress).toBeGreaterThan(35);
    expect(mapped.progress).toBeLessThan(96);
  });

  it('maps completed tasks to 100 percent progress', () => {
    const mapped = mapDerivedTaskProgress(
      event({
        status: 'completed',
        phase: 'completed',
        completed_events: 4,
        progress_message: null,
      }),
    );

    expect(mapped.progress).toBe(100);
    expect(mapped.progressPhase).toBe('generating');
  });

  it('advances progress with completed event counts within a phase band', () => {
    const early = mapDerivedTaskProgress(
      event({ phase: 'generating', completed_events: 0, total_events: 10 }),
    );
    const later = mapDerivedTaskProgress(
      event({ phase: 'generating', completed_events: 5, total_events: 10 }),
    );

    expect(later.progress).toBeGreaterThan(early.progress);
  });
});
