'use client';

import type { CSSProperties } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import { ColumnResizeHandle } from '@/features/database/datasets';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { DurabilityScheduleRow } from '@/features/edit-metadata/lib/build-durability-schedule-rows';

const COLUMN_KEYS = [
  'rspFileName',
  'rspEventName',
  'schedulePattern',
  'weight',
  'repeats',
  'scheduleSequence',
  'globalMultiplier',
] as const;

type ColumnKey = (typeof COLUMN_KEYS)[number];

const DEFAULT_COLUMN_WIDTHS: Record<ColumnKey, number> = {
  rspFileName: 330,
  rspEventName: 120,
  schedulePattern: 144,
  weight: 72,
  repeats: 72,
  scheduleSequence: 156,
  globalMultiplier: 132,
};

const MIN_COLUMN_PX = 60;
const MAX_COLUMN_PX = 600;
const MIN_PADDING_ROWS = 4;

export type DurabilityScheduleEditableField =
  | 'rspEventName'
  | 'schedulePattern'
  | 'weight'
  | 'repeats'
  | 'scheduleSequence';

function flexFor(basis: number): CSSProperties {
  return { flex: `${basis} 0 ${basis}px` };
}

function formatCell(value: string | number | null | undefined): string {
  if (value == null || value === '') {
    return '';
  }
  return String(value);
}

function Row({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex h-8 shrink-0 items-stretch', className)}>
      {children}
    </div>
  );
}

function HeaderCell({
  children,
  width,
  className,
  title,
  onResize,
}: {
  children?: React.ReactNode;
  width: number;
  className?: string;
  title?: string;
  onResize: (next: number) => void;
}) {
  return (
    <div
      className={cn(
        'relative flex min-w-0 items-center justify-center whitespace-nowrap border-b border-r border-border bg-muted/40 px-2 text-center text-[11px] leading-none',
        className,
      )}
      style={flexFor(width)}
      title={title}
    >
      {children}
      <ColumnResizeHandle
        width={width}
        onResize={onResize}
        min={MIN_COLUMN_PX}
        max={MAX_COLUMN_PX}
      />
    </div>
  );
}

function DataCell({
  value,
  width,
  className,
}: {
  value: string | number | null | undefined;
  width: number;
  className?: string;
}) {
  const display = formatCell(value);
  return (
    <div
      className={cn(
        'flex min-w-0 items-center justify-center border-b border-r border-border px-2 text-center text-xs tabular-nums leading-none text-foreground/80',
        className,
      )}
      style={flexFor(width)}
      title={display || undefined}
    >
      <span className="truncate">{display}</span>
    </div>
  );
}

function EditableCell({
  value,
  width,
  className,
  inputMode,
  onChange,
  disabled,
  highlighted,
}: {
  value: string;
  width: number;
  className?: string;
  inputMode?: 'text' | 'decimal' | 'numeric';
  onChange: (value: string) => void;
  disabled?: boolean;
  highlighted?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 items-center border-b border-r border-border bg-muted/40',
        highlighted && 'bg-destructive/10 ring-1 ring-inset ring-destructive/40',
        className,
      )}
      style={flexFor(width)}
      data-highlighted={highlighted ? 'true' : undefined}
    >
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        inputMode={inputMode}
        className="h-8 w-full rounded-none border-0 bg-transparent px-2 text-center text-xs tabular-nums leading-none text-foreground shadow-none focus-visible:border-transparent focus-visible:ring-0"
      />
    </div>
  );
}

export interface DurabilityScheduleTableProps {
  rows: DurabilityScheduleRow[];
  globalMultiplier?: number | null;
  editable?: boolean;
  highlightedFieldsByRowId?: Record<string, DurabilityScheduleEditableField[]>;
  onRowChange?: (rowId: string, field: DurabilityScheduleEditableField, value: string) => void;
  onMultiplierChange?: (value: string) => void;
  minPaddingRows?: number;
}

function isFieldHighlighted(
  highlightedFieldsByRowId: Record<string, DurabilityScheduleEditableField[]> | undefined,
  rowId: string,
  field: DurabilityScheduleEditableField,
): boolean {
  return highlightedFieldsByRowId?.[rowId]?.includes(field) ?? false;
}

export function DurabilityScheduleTable({
  rows,
  globalMultiplier = null,
  editable = false,
  highlightedFieldsByRowId,
  onRowChange,
  onMultiplierChange,
  minPaddingRows = MIN_PADDING_ROWS,
}: DurabilityScheduleTableProps) {
  const paddingRowCount = Math.max(0, minPaddingRows - rows.length);
  const multiplierDisplay = formatCell(globalMultiplier);
  const [columnWidthOverrides, setColumnWidthOverrides] = useState<
    Partial<Record<ColumnKey, number>>
  >({});

  const setColumnWidth = useCallback((key: ColumnKey, next: number) => {
    setColumnWidthOverrides((prev) => (prev[key] === next ? prev : { ...prev, [key]: next }));
  }, []);

  const widthOf = useCallback(
    (key: ColumnKey) => columnWidthOverrides[key] ?? DEFAULT_COLUMN_WIDTHS[key],
    [columnWidthOverrides],
  );

  const tableWidth = useMemo(
    () => COLUMN_KEYS.reduce((sum, key) => sum + widthOf(key), 0),
    [widthOf],
  );

  return (
    <div className="flex min-h-0 w-full max-w-full flex-1 flex-col overflow-hidden rounded-lg border bg-card">
      <div className="flex shrink-0 items-start gap-1.5 border-b px-3 py-1.5 text-xs leading-5 text-muted-foreground">
        <Info
          className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <p className="min-w-0">
          {editable
            ? 'Edit schedule fields inline, then Save to persist corrections.'
            : 'Review matched schedule fields for each RSP event in this program/version.'}
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <div style={{ width: tableWidth }}>
          <div className="sticky top-0 z-10 shrink-0 bg-card">
            <Row>
              <HeaderCell
                width={widthOf('rspFileName')}
                className="font-medium text-foreground"
                onResize={(next) => setColumnWidth('rspFileName', next)}
              >
                RSP File Name
              </HeaderCell>
              <HeaderCell
                width={widthOf('rspEventName')}
                className="font-medium text-foreground"
                onResize={(next) => setColumnWidth('rspEventName', next)}
              >
                RSP Event Name
              </HeaderCell>
              <HeaderCell
                width={widthOf('schedulePattern')}
                className="font-medium text-foreground"
                onResize={(next) => setColumnWidth('schedulePattern', next)}
              >
                Schedule Pattern
              </HeaderCell>
              <HeaderCell
                width={widthOf('weight')}
                className="font-medium text-foreground"
                onResize={(next) => setColumnWidth('weight', next)}
              >
                Weight
              </HeaderCell>
              <HeaderCell
                width={widthOf('repeats')}
                className="font-medium text-foreground"
                onResize={(next) => setColumnWidth('repeats', next)}
              >
                Repeats
              </HeaderCell>
              <HeaderCell
                width={widthOf('scheduleSequence')}
                className="font-medium text-foreground"
                onResize={(next) => setColumnWidth('scheduleSequence', next)}
              >
                Schedule Sequence
              </HeaderCell>
              <HeaderCell
                width={widthOf('globalMultiplier')}
                className="border-r-0 font-medium text-foreground"
                onResize={(next) => setColumnWidth('globalMultiplier', next)}
              >
                Global Multiplier
              </HeaderCell>
            </Row>
          </div>

          <div>
            {rows.map((row) => (
              <Row key={row.id} className="bg-card transition-colors hover:bg-muted/30">
                <DataCell value={row.rspFileName} width={widthOf('rspFileName')} />
                {editable ? (
                  <>
                    <EditableCell
                      value={row.rspEventName}
                      width={widthOf('rspEventName')}
                      highlighted={isFieldHighlighted(
                        highlightedFieldsByRowId,
                        row.id,
                        'rspEventName',
                      )}
                      onChange={(value) => onRowChange?.(row.id, 'rspEventName', value)}
                    />
                    <EditableCell
                      value={row.schedulePattern}
                      width={widthOf('schedulePattern')}
                      highlighted={isFieldHighlighted(
                        highlightedFieldsByRowId,
                        row.id,
                        'schedulePattern',
                      )}
                      onChange={(value) => onRowChange?.(row.id, 'schedulePattern', value)}
                    />
                    <EditableCell
                      value={formatCell(row.weight)}
                      width={widthOf('weight')}
                      inputMode="decimal"
                      highlighted={isFieldHighlighted(highlightedFieldsByRowId, row.id, 'weight')}
                      onChange={(value) => onRowChange?.(row.id, 'weight', value)}
                    />
                    <EditableCell
                      value={formatCell(row.repeats)}
                      width={widthOf('repeats')}
                      inputMode="numeric"
                      highlighted={isFieldHighlighted(highlightedFieldsByRowId, row.id, 'repeats')}
                      onChange={(value) => onRowChange?.(row.id, 'repeats', value)}
                    />
                    <EditableCell
                      value={formatCell(row.scheduleSequence)}
                      width={widthOf('scheduleSequence')}
                      inputMode="numeric"
                      onChange={(value) => onRowChange?.(row.id, 'scheduleSequence', value)}
                    />
                    <EditableCell
                      value={multiplierDisplay}
                      width={widthOf('globalMultiplier')}
                      inputMode="decimal"
                      className="border-r-0"
                      onChange={(value) => onMultiplierChange?.(value)}
                    />
                  </>
                ) : (
                  <>
                    <DataCell value={row.rspEventName} width={widthOf('rspEventName')} />
                    <DataCell value={row.schedulePattern} width={widthOf('schedulePattern')} />
                    <DataCell value={row.weight} width={widthOf('weight')} />
                    <DataCell value={row.repeats} width={widthOf('repeats')} />
                    <DataCell value={row.scheduleSequence} width={widthOf('scheduleSequence')} />
                    <DataCell
                      value={globalMultiplier}
                      width={widthOf('globalMultiplier')}
                      className="border-r-0"
                    />
                  </>
                )}
              </Row>
            ))}

            {rows.length === 0 ? (
              <div className="flex h-8 items-center justify-center border-b px-3 text-xs text-muted-foreground">
                No RSP events matched this schedule for the selected program/version.
              </div>
            ) : null}

            {Array.from({ length: paddingRowCount }, (_, index) => (
              <Row key={`padding-${index}`} aria-hidden="true">
                {COLUMN_KEYS.map((key, cellIndex) => (
                  <div
                    key={`padding-cell-${index}-${key}`}
                    className={cn(
                      'h-8 border-b border-r border-border bg-card',
                      cellIndex === COLUMN_KEYS.length - 1 && 'border-r-0',
                    )}
                    style={flexFor(widthOf(key))}
                  />
                ))}
              </Row>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
