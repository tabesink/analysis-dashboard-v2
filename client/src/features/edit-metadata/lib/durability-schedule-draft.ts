import type { DurabilityScheduleRow } from '@/features/edit-metadata/lib/build-durability-schedule-rows';

export function parseOptionalScheduleNumber(rawValue: string): number | null {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isDurabilityScheduleDirty(
  draftRows: DurabilityScheduleRow[],
  baselineRows: DurabilityScheduleRow[],
  draftMultiplier: number | null,
  baselineMultiplier: number | null,
): boolean {
  if (draftMultiplier !== baselineMultiplier) {
    return true;
  }
  return JSON.stringify(draftRows) !== JSON.stringify(baselineRows);
}
