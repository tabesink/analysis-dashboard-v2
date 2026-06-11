import type {
  DamageFailureField,
  DamageFailureIssue,
  DamageFailureReport,
} from '@/types/api';
import type { DurabilityScheduleEditableField } from '@/components/edit-metadata/DurabilityScheduleTable';

const REPORT_FIELD_TO_EDITOR_FIELD: Partial<
  Record<DamageFailureField, DurabilityScheduleEditableField>
> = {
  repeats: 'repeats',
  weight: 'weight',
  rspEventName: 'rspEventName',
  schedulePattern: 'schedulePattern',
};

export function formatDamageReportIssue(issue: DamageFailureIssue): string {
  const eventLabel = issue.event_name ?? issue.event_id ?? 'Schedule row';
  return `${eventLabel} · ${issue.field}: ${issue.message}`;
}

export function buildDamageFieldHighlights(
  report: DamageFailureReport | null | undefined,
): Record<string, DurabilityScheduleEditableField[]> {
  if (!report) {
    return {};
  }

  const highlights: Record<string, Set<DurabilityScheduleEditableField>> = {};

  for (const issue of report.issues) {
    const editorField = REPORT_FIELD_TO_EDITOR_FIELD[issue.field];
    if (!editorField || !issue.event_id) {
      continue;
    }
    const current = highlights[issue.event_id] ?? new Set<DurabilityScheduleEditableField>();
    current.add(editorField);
    highlights[issue.event_id] = current;
  }

  return Object.fromEntries(
    Object.entries(highlights).map(([rowId, fields]) => [rowId, [...fields]]),
  );
}
