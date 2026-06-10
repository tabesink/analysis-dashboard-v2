import type { FilterOptionEntry } from '@/types/api';

export function isStatusField(
  displayName: string,
  config: Pick<FilterOptionEntry, 'column'>
): boolean {
  return displayName.toLowerCase() === 'status' || config.column === 'status';
}
