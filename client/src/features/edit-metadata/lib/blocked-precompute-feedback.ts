import { showShortInfoToast } from '@/lib/feedback/short-info-toast';

import type { DamageFailureReport } from '@/types/api';

const PREREQUISITE_LABELS: Record<string, string> = {
  missing_raw_load_histories: 'channel assignment or channel reprocess',
  missing_cross_plot_data: 'channel assignment or channel reprocess',
  no_scheduled_events: 'a durability schedule with matched events',
};

function prerequisiteLabel(report: DamageFailureReport): string {
  for (const issue of report.issues) {
    const label = PREREQUISITE_LABELS[issue.code];
    if (label) {
      return label;
    }
  }
  return report.summary;
}

export function buildBlockedPrecomputeToastMessage(params: {
  programId: string;
  version: string;
  report: DamageFailureReport;
}): string {
  const prerequisite = prerequisiteLabel(params.report);
  return `Automatic damage calculation is waiting for ${prerequisite} (${params.programId} / ${params.version}).`;
}

export function emitBlockedPrecomputeToast(params: {
  programId: string;
  version: string;
  report: DamageFailureReport;
}): void {
  showShortInfoToast(buildBlockedPrecomputeToastMessage(params));
}
