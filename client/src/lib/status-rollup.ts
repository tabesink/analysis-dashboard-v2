import { getStatusBadgeClassName } from '@/lib/status-badge';

export type StatusRollupValue = 'Approved' | 'Obsolete' | 'Pending';

const STATUS_PRIORITY: StatusRollupValue[] = ['Obsolete', 'Pending', 'Approved'];

export interface StatusRollupResult {
  label: string;
  className: string;
}

export function rollUpStatusFromValues(statusValues: string[]): StatusRollupResult {
  const unique = [...new Set(statusValues.filter(Boolean))];
  if (unique.length === 0) {
    return { label: '-', className: getStatusBadgeClassName(undefined) };
  }
  if (unique.length === 1) {
    return { label: unique[0], className: getStatusBadgeClassName(unique[0]) };
  }
  for (const priority of STATUS_PRIORITY) {
    if (unique.includes(priority)) {
      return { label: priority, className: getStatusBadgeClassName(priority) };
    }
  }
  const fallback = unique[0];
  return { label: fallback, className: getStatusBadgeClassName(fallback) };
}
