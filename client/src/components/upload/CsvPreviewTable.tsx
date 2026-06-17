'use client';

import type { CSSProperties } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { formatCsvPreviewCellValue, parseCsvPreviewLines } from '@/lib/csv-preview-parse';
import { cn } from '@/lib/utils';
import { ColumnResizeHandle } from './ColumnResizeHandle';

const CHAR_PX = 7.2;
const PADDING_PX = 32;
const MIN_COLUMN_PX = 80;
const MAX_COLUMN_PX = 400;
const FALLBACK_COLUMN_PX = 120;

function flexFor(basis: number): CSSProperties {
  return { flex: `${basis} 0 ${basis}px` };
}

function widthForValues(label: string, values: string[]): number {
  const effectiveLabel = label.trim() || '-';
  const longest = values.reduce((max, value) => Math.max(max, value.length), effectiveLabel.length);
  return Math.min(
    MAX_COLUMN_PX,
    Math.max(MIN_COLUMN_PX, Math.ceil(longest * CHAR_PX) + PADDING_PX),
  );
}

function isMissingHeader(header: string): boolean {
  return header.trim().length === 0;
}

function formatHeaderDisplay(header: string): string {
  return isMissingHeader(header) ? '-' : header;
}

export interface CsvPreviewTableProps {
  previewLines: string[];
  maxRows?: number;
  /** Used when preview lines are unavailable but column count is known. */
  columnCount?: number;
  /** Placeholder header columns when preview and columnCount are both empty (channel-map editor). */
  fallbackColumnCount?: number;
  /** Zero-based column index from which numeric cell values render without decimals. */
  dropDecimalsFromColumn?: number;
}

export function CsvPreviewTable({
  previewLines,
  maxRows,
  columnCount = 0,
  fallbackColumnCount = 0,
  dropDecimalsFromColumn,
}: CsvPreviewTableProps) {
  const parsed = useMemo(() => parseCsvPreviewLines(previewLines), [previewLines]);
  const showHeaderGrid = maxRows != null;

  const headers = useMemo(() => {
    if (parsed?.headers.length) {
      return parsed.headers;
    }
    const effectiveCount =
      columnCount > 0 ? columnCount : showHeaderGrid ? fallbackColumnCount : 0;
    if (effectiveCount <= 0) {
      return [];
    }
    return Array.from({ length: effectiveCount }, () => '');
  }, [columnCount, fallbackColumnCount, parsed?.headers, showHeaderGrid]);

  const rows = parsed?.rows ?? [];
  const visibleRows = useMemo(
    () => (maxRows != null ? rows.slice(0, maxRows) : rows),
    [maxRows, rows],
  );
  const paddingRowCount =
    maxRows != null ? Math.max(0, maxRows - visibleRows.length) : 0;

  const [columnWidthOverrides, setColumnWidthOverrides] = useState<Record<number, number>>({});

  const derivedWidths = useMemo(() => {
    return headers.map((header, columnIndex) => {
      const values = rows.map((row) => row[columnIndex] ?? '');
      return widthForValues(header, values);
    });
  }, [headers, rows]);

  const setColumnWidth = useCallback((columnIndex: number, next: number) => {
    setColumnWidthOverrides((prev) =>
      prev[columnIndex] === next ? prev : { ...prev, [columnIndex]: next },
    );
  }, []);

  const widthOf = useCallback(
    (columnIndex: number) =>
      columnWidthOverrides[columnIndex] ??
      derivedWidths[columnIndex] ??
      FALLBACK_COLUMN_PX,
    [columnWidthOverrides, derivedWidths],
  );

  const totalRowWidth = useMemo(
    () => headers.reduce((sum, _, columnIndex) => sum + widthOf(columnIndex), 0),
    [headers, widthOf],
  );

  const emptyStateClassName = maxRows != null ? 'h-full' : 'min-h-[240px] flex-1';

  if (!showHeaderGrid && headers.length === 0) {
    return (
      <div className={`flex ${emptyStateClassName} flex-col items-center justify-center px-4 py-8 text-center`}>
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="mb-1 text-sm font-medium text-foreground">No CSV preview available</h3>
        <p className="max-w-[280px] text-xs text-muted-foreground">
          Upload and retain a CSV artifact to preview its first data rows here.
        </p>
      </div>
    );
  }

  if (!showHeaderGrid && rows.length === 0) {
    return (
      <div className={`flex ${emptyStateClassName} flex-col items-center justify-center px-4 py-8 text-center`}>
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="mb-1 text-sm font-medium text-foreground">No preview rows found</h3>
        <p className="max-w-[280px] text-xs text-muted-foreground">
          The retained artifact includes column titles but no rows under #DATA yet.
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        maxRows != null ? 'h-full overflow-x-auto overflow-y-hidden' : 'min-h-0 flex-1 overflow-auto',
      )}
    >
      <div style={{ minWidth: totalRowWidth }}>
        <div className="sticky top-0 z-10 shrink-0 bg-card">
          <div className="flex h-7 shrink-0 items-center border-b bg-muted/60 px-3 text-xs font-medium tabular-nums leading-none text-muted-foreground">
            {headers.map((_, columnIndex) => {
              const width = widthOf(columnIndex);
              return (
                <div
                  key={`index-${columnIndex}`}
                  className="flex min-w-0 items-center justify-center px-2"
                  style={flexFor(width)}
                >
                  {columnIndex}
                </div>
              );
            })}
          </div>
          <div className="flex h-8 shrink-0 items-center border-b bg-muted/40 px-3 text-xs font-semibold leading-none text-muted-foreground">
            {headers.map((header, columnIndex) => {
              const width = widthOf(columnIndex);
              const missingHeader = isMissingHeader(header);
              const displayHeader = formatHeaderDisplay(header);
              return (
                <div
                  key={`header-${columnIndex}`}
                  className={cn(
                    'relative min-w-0 px-2',
                    missingHeader && 'flex items-center justify-center',
                  )}
                  style={flexFor(width)}
                >
                  <span
                    className={cn(
                      'block',
                      missingHeader
                        ? 'text-center text-muted-foreground'
                        : 'truncate',
                    )}
                    title={missingHeader ? undefined : header}
                  >
                    {displayHeader}
                  </span>
                  <ColumnResizeHandle
                    width={width}
                    onResize={(next) => setColumnWidth(columnIndex, next)}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {visibleRows.map((row, rowIndex) => (
          <div
            key={`row-${rowIndex}`}
            className="flex h-8 shrink-0 items-center border-b px-3 transition-colors odd:bg-card even:bg-muted/10 hover:bg-muted/30"
          >
            {headers.map((_, columnIndex) => {
              const rawValue = row[columnIndex] ?? '';
              const displayValue = formatCsvPreviewCellValue(
                rawValue,
                columnIndex,
                dropDecimalsFromColumn,
              );
              const width = widthOf(columnIndex);
              return (
                <div
                  key={`cell-${rowIndex}-${columnIndex}`}
                  className="min-w-0 px-2 text-right text-xs tabular-nums text-muted-foreground"
                  style={flexFor(width)}
                >
                  <span className="block truncate" title={displayValue}>
                    {displayValue}
                  </span>
                </div>
              );
            })}
          </div>
        ))}

        {Array.from({ length: paddingRowCount }, (_, rowIndex) => (
          <div
            key={`padding-row-${rowIndex}`}
            className="flex h-8 shrink-0 items-center border-b px-3"
            aria-hidden="true"
          >
            {headers.map((_, columnIndex) => {
              const width = widthOf(columnIndex);
              return (
                <div
                  key={`padding-cell-${rowIndex}-${columnIndex}`}
                  className="min-w-0 bg-muted/40 px-2"
                  style={flexFor(width)}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
