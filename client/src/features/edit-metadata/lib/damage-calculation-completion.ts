import type { DamageFailureReport, DerivedTaskStatusEvent } from '@/types/api';

export interface DamageCalculationCompletionResult {
  success: boolean;
  title: string;
  message: string;
  detailLines?: string[];
  failureReport?: DamageFailureReport;
  primaryAction?: {
    label: string;
    testId: string;
  };
}

function readFailureReport(event: DerivedTaskStatusEvent): DamageFailureReport | undefined {
  const payload = event.result;
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }
  const report = (payload as { failure_report?: DamageFailureReport }).failure_report;
  if (!report || typeof report !== 'object') {
    return undefined;
  }
  return report;
}

function readProcessedEvents(event: DerivedTaskStatusEvent): number {
  const payload = event.result;
  if (!payload || typeof payload !== 'object') {
    return Number(event.completed_events ?? 0);
  }
  const processed = (payload as { processed_events?: number }).processed_events;
  return Number(processed ?? event.completed_events ?? 0);
}

export function buildDamageCalculationCompletionResult(
  event: DerivedTaskStatusEvent,
): DamageCalculationCompletionResult {
  if (event.status === 'failed') {
    const failureReport = readFailureReport(event);
    return {
      success: false,
      title: 'Damage calculation failed',
      message: event.error ?? failureReport?.summary ?? 'Damage calculation failed',
      failureReport,
      primaryAction: failureReport
        ? {
            label: 'Open schedule editor',
            testId: 'damage-calculation-open-schedule-editor',
          }
        : undefined,
    };
  }

  const processedEvents = readProcessedEvents(event);
  return {
    success: true,
    title: 'Damage calculation complete',
    message: 'Load-history damage was calculated for the active schedule.',
    detailLines: [
      `Processed ${processedEvents} scheduled event${processedEvents === 1 ? '' : 's'}`,
    ],
  };
}
