import { describe, expect, it } from 'vitest';

import { applyUploadTaskProgress } from '@/hooks/use-upload';
import type { UploadTaskEvent } from '@/types/upload';

describe('applyUploadTaskProgress', () => {
  const baseState = {
    progress: 65,
    progressPhase: 'writing' as const,
    message: 'Processed 6/10: event_06',
  };

  const baseEvent: UploadTaskEvent = {
    task_id: 'task-1',
    status: 'running',
    phase: 'writing',
    completed_events: 7,
    total_events: 10,
    current_event: 'event_07',
  };

  it('keeps upload phase/progress monotonic when polling regresses', () => {
    const outOfOrderEvent: UploadTaskEvent = {
      ...baseEvent,
      phase: 'validating',
      completed_events: 2,
      total_events: 10,
    };

    const next = applyUploadTaskProgress(outOfOrderEvent, baseState);

    expect(next.progressPhase).toBe('writing');
    expect(next.progress).toBeGreaterThanOrEqual(baseState.progress);
  });

  it('does not render downstream task updates as folder-upload progress', () => {
    const downstreamEvent: UploadTaskEvent = {
      ...baseEvent,
      task_kind: 'damage_calculation',
      phase: 'calculating',
      progress_message: 'Calculating damage...',
    };

    const next = applyUploadTaskProgress(downstreamEvent, baseState);

    expect(next.progress).toBe(baseState.progress);
    expect(next.progressPhase).toBe(baseState.progressPhase);
    expect(next.message).toBe('Waiting for folder upload status...');
  });

  it('maps backend converting phase without skipping backend order', () => {
    const convertingEvent: UploadTaskEvent = {
      ...baseEvent,
      phase: 'converting',
      completed_events: 1,
      total_events: 4,
    };

    const next = applyUploadTaskProgress(convertingEvent, {
      progress: 5,
      progressPhase: 'upload_received',
      message: 'Upload received by server...',
    });

    expect(next.progressPhase).toBe('converting');
    expect(next.progress).toBeGreaterThan(5);
  });

  it('shows cancelling-safe copy while server status is cancelling', () => {
    const cancellingEvent: UploadTaskEvent = {
      ...baseEvent,
      status: 'cancelling',
      progress_message: 'Cancelling safely...',
    };

    const next = applyUploadTaskProgress(cancellingEvent, baseState);

    expect(next.progress).toBe(baseState.progress);
    expect(next.progressPhase).toBe(baseState.progressPhase);
    expect(next.message).toBe('Cancelling safely...');
  });
});
