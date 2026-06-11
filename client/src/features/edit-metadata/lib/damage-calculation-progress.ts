import type { DerivedTaskStatusEvent } from '@/types/api';

export type DamageCalculationProgressPhase = 'validating' | 'calculating';

export interface DamageCalculationProgressView {
  progress: number;
  progressPhase: DamageCalculationProgressPhase;
  progressMessage: string;
}

const PHASE_BANDS: Record<
  DamageCalculationProgressPhase,
  { start: number; end: number }
> = {
  validating: { start: 0, end: 25 },
  calculating: { start: 25, end: 95 },
};

function resolveProgressPhase(phase: string): DamageCalculationProgressPhase {
  if (phase === 'calculating') {
    return 'calculating';
  }
  return 'validating';
}

function bandProgress(
  phase: DamageCalculationProgressPhase,
  completedEvents: number,
  totalEvents: number,
): number {
  const band = PHASE_BANDS[phase];
  const ratio =
    totalEvents > 0 ? Math.min(1, Math.max(0, completedEvents / totalEvents)) : 0;
  return Math.round(band.start + (band.end - band.start) * ratio);
}

export function mapDamageCalculationProgress(
  event: DerivedTaskStatusEvent,
): DamageCalculationProgressView {
  if (event.status === 'completed' || event.phase === 'completed') {
    return {
      progress: 100,
      progressPhase: 'calculating',
      progressMessage: event.progress_message ?? 'Damage calculation complete',
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
      `Calculating damage: ${completedEvents}/${totalEvents} events`,
  };
}
