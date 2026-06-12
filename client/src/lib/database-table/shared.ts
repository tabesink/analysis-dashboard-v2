/** Shared constants and helpers for hierarchical database-style table pages. */

export const CHAR_PX = 7.2;
export const PADDING_PX = 32;
export const MIN_COLUMN_PX = 80;
export const MAX_COLUMN_PX = 400;
export const PROGRAM_ID_DEFAULT_PX = 250;
export const PROGRAM_ID_KEY = 'programId';

export type SortDirection = 'asc' | 'desc';

export type ColumnLayoutPreferences = {
  visibleColumns: Record<string, boolean>;
  columnWidths: Record<string, number>;
  updatedAt: string;
};

export function widthForValues(label: string, values: string[]): number {
  const longest = values.reduce(
    (max, value) => Math.max(max, value.length),
    label.length,
  );
  return Math.min(
    MAX_COLUMN_PX,
    Math.max(MIN_COLUMN_PX, Math.ceil(longest * CHAR_PX) + PADDING_PX),
  );
}

export function toggleSortField(
  currentField: string,
  currentDirection: SortDirection,
  field: string,
  newFieldDirection: SortDirection = 'asc',
): { sortField: string; sortDirection: SortDirection } {
  if (currentField === field) {
    return {
      sortField: field,
      sortDirection: currentDirection === 'asc' ? 'desc' : 'asc',
    };
  }
  return { sortField: field, sortDirection: newFieldDirection };
}

export function updateColumnFilter(
  prev: Record<string, string[]>,
  column: string,
  value: string,
  checked: boolean,
): Record<string, string[]> {
  const currentFilters = prev[column] || [];
  if (checked) {
    return { ...prev, [column]: [...currentFilters, value] };
  }
  return {
    ...prev,
    [column]: currentFilters.filter((item) => item !== value),
  };
}

export function filterRowsByColumnFilters<T>(
  rows: T[],
  columnFilters: Record<string, string[]>,
  getValue: (row: T, column: string) => string,
): T[] {
  return rows.filter((row) => {
    for (const [column, selectedValues] of Object.entries(columnFilters)) {
      if (selectedValues.length === 0) continue;
      const rowValue = getValue(row, column);
      if (!selectedValues.includes(rowValue)) return false;
    }
    return true;
  });
}

// fallow-ignore-next-line complexity
export function parseColumnLayoutPreferences(
  raw: string | null,
): ColumnLayoutPreferences | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    const visibleColumns =
      typeof parsed.visibleColumns === 'object' && parsed.visibleColumns !== null
        ? (parsed.visibleColumns as Record<string, boolean>)
        : {};
    const columnWidths =
      typeof parsed.columnWidths === 'object' && parsed.columnWidths !== null
        ? (parsed.columnWidths as Record<string, number>)
        : {};
    return {
      visibleColumns,
      columnWidths,
      updatedAt:
        typeof parsed.updatedAt === 'string'
          ? parsed.updatedAt
          : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}
