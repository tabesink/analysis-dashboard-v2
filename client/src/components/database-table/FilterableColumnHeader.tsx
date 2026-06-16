'use client';

import { ArrowDownIcon, ArrowUpIcon, FilterIcon } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ColumnResizeHandle } from '@/features/database/datasets';
import type { SortDirection } from '@/lib/database-table/shared';

export type FilterableColumnHeaderProps = {
  label: string;
  field: string;
  width: number;
  sortField: string;
  sortDirection: SortDirection;
  onSort: (field: string) => void;
  columnFilters: Record<string, string[]>;
  onColumnFilterChange: (column: string, value: string, checked: boolean) => void;
  uniqueValues: Record<string, string[]>;
  onResize: (next: number) => void;
};

// fallow-ignore-next-line complexity
export function FilterableColumnHeader({
  label,
  field,
  width,
  sortField,
  sortDirection,
  onSort,
  columnFilters,
  onColumnFilterChange,
  uniqueValues,
  onResize,
}: FilterableColumnHeaderProps) {
  return (
    <div
      key={field}
      className="relative shrink-0 px-2"
      style={{ width }}
    >
      <div className="flex items-center justify-center gap-1">
        <button
          type="button"
          onClick={() => onSort(field)}
          className="flex items-center justify-center gap-1 hover:text-foreground transition-colors text-center min-w-0"
        >
          <span className="truncate">{label}</span>
          {sortField === field && (
            <span className="text-primary shrink-0">
              {sortDirection === 'asc' ? (
                <ArrowUpIcon size={10} />
              ) : (
                <ArrowDownIcon size={10} />
              )}
            </span>
          )}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={`shrink-0 p-1 rounded hover:bg-accent transition-colors ${
                columnFilters[field]?.length > 0
                  ? 'text-primary'
                  : 'text-muted-foreground/50 hover:text-muted-foreground'
              }`}
              onClick={(event) => event.stopPropagation()}
            >
              <FilterIcon size={10} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-48 max-h-[280px] overflow-y-auto rounded-lg shadow-lg"
          >
            {uniqueValues[field]?.length > 0 ? (
              uniqueValues[field].map((value) => (
                <DropdownMenuCheckboxItem
                  key={value}
                  checked={columnFilters[field]?.includes(value) || false}
                  onCheckedChange={(checked: boolean) =>
                    onColumnFilterChange(field, value, checked)
                  }
                  className="text-xs"
                >
                  {value}
                </DropdownMenuCheckboxItem>
              ))
            ) : (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                No values
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <ColumnResizeHandle width={width} onResize={onResize} />
    </div>
  );
}
