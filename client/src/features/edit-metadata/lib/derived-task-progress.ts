import type { DerivedTaskStatusEvent } from '@/types/api';

export type ChannelReprocessProgressPhase = 'validating' | 'generating';

export interface DerivedTaskProgressView {
  progress: number;
  progressPhase: ChannelReprocessProgressPhase;
  progressMessage: string;
}

const PHASE_BANDS: Record<
  ChannelReprocessProgressPhase,
  { start: number; end: number }
> = {
  validating: { start: 0, end: 35 },
  generating: { start: 35, end: 95 },
};

function resolveProgressPhase(phase: string): ChannelReprocessProgressPhase {
  if (phase === 'generating') {
    return 'generating';
  }
  return 'validating';
}

function bandProgress(
  phase: ChannelReprocessProgressPhase,
  completedEvents: number,
  totalEvents: number,
): number {
  const band = PHASE_BANDS[phase];
  const ratio =
    totalEvents > 0 ? Math.min(1, Math.max(0, completedEvents / totalEvents)) : 0;
  return Math.round(band.start + (band.end - band.start) * ratio);
}

export function mapDerivedTaskProgress(
  event: DerivedTaskStatusEvent,
): DerivedTaskProgressView {
  if (event.status === 'completed' || event.phase === 'completed') {
    return {
      progress: 100,
      progressPhase: 'generating',
      progressMessage: event.progress_message ?? 'Channel reprocess complete',
    };
  }

  const progressPhase = resolveProgressPhase(event.phase);
  const totalEvents = Math.max(1, event.total_events || 0);
  const completedEvents = Math.max(0, event.completed_events || 0);
  const progress = Math.min(99, bandProgress(progressPhase, completedEvents, totalEvents));

  return {
    progress,
    progressPhase,
    progressMessage:
      event.progress_message ??
      `Processing artifacts: ${completedEvents}/${totalEvents}`,
  };
}
