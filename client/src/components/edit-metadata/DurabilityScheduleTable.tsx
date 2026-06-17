'use client';

import { cn } from '@/lib/utils';
import { Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
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

const COLUMN_HEADERS: Record<(typeof COLUMN_KEYS)[number], string> = {
  rspFileName: 'RSP File Name',
  rspEventName: 'RSP Event Name',
  schedulePattern: 'Schedule Pattern',
  weight: 'Weight',
  repeats: 'Repeats',
  scheduleSequence: 'Schedule Sequence',
  globalMultiplier: 'Global Multiplier',
};

/** Full-width grid: flexible text columns + compact numeric columns */
const DURABILITY_SCHEDULE_GRID_COLS =
  'grid-cols-[minmax(0,3.25fr)_minmax(0,0.75fr)_minmax(5rem,1fr)_3.5rem_3.5rem_minmax(5.5rem,1fr)_minmax(5.5rem,1fr)]';

const MIN_PADDING_ROWS = 4;

const TABLE_ROW_BORDER = 'border-b border-border/50';
const TABLE_CELL_DIVIDER = 'border-r border-border/50';

const HEADER_CELL_CLASS =
  `flex min-w-0 items-center whitespace-nowrap ${TABLE_CELL_DIVIDER} bg-muted/40 px-3 text-xs font-medium leading-none text-foreground`;
const LABEL_CELL_CLASS =
  `flex min-w-0 items-center ${TABLE_CELL_DIVIDER} bg-muted/40 px-3`;
const EDITABLE_CELL_CLASS = `flex min-w-0 items-center ${TABLE_CELL_DIVIDER} bg-muted/40`;
const TABLE_INPUT_BASE_CLASS =
  'h-8 w-full rounded-none border-0 bg-transparent text-xs md:text-xs leading-none text-foreground shadow-none focus-visible:border-transparent focus-visible:ring-0';
const NUMERIC_INPUT_CLASS = `${TABLE_INPUT_BASE_CLASS} px-1 text-center tabular-nums`;
const TEXT_INPUT_CLASS = `${TABLE_INPUT_BASE_CLASS} px-3 text-left`;

export type DurabilityScheduleEditableField =
  | 'rspEventName'
  | 'schedulePattern'
  | 'weight'
  | 'repeats'
  | 'scheduleSequence';

function formatCell(value: string | number | null | undefined): string {
  if (value == null || value === '') {
    return '';
  }
  return String(value);
}

function Row({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'grid h-8 shrink-0 items-stretch transition-colors hover:bg-muted/30',
        TABLE_ROW_BORDER,
        DURABILITY_SCHEDULE_GRID_COLS,
        className,
      )}
    >
      {children}
    </div>
  );
}

function HeaderCell({
  children,
  className,
  title,
}: {
  children?: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <div className={cn(HEADER_CELL_CLASS, className)} title={title}>
      {children}
    </div>
  );
}

function LabelCell({
  value,
  className,
}: {
  value: string | number | null | undefined;
  className?: string;
}) {
  const display = formatCell(value);
  return (
    <div className={cn(LABEL_CELL_CLASS, className)} title={display || undefined}>
      <span className="block w-full truncate whitespace-nowrap text-xs leading-none text-foreground">
        {display}
      </span>
    </div>
  );
}

function DataCell({
  value,
  className,
  numeric = false,
}: {
  value: string | number | null | undefined;
  className?: string;
  numeric?: boolean;
}) {
  const display = formatCell(value);
  return (
    <div
      className={cn(EDITABLE_CELL_CLASS, numeric && 'justify-center', className)}
      title={display || undefined}
    >
      <span
        className={cn(
          'block w-full truncate text-xs leading-none text-foreground',
          numeric ? 'text-center tabular-nums' : 'whitespace-nowrap',
        )}
      >
        {display}
      </span>
    </div>
  );
}

function EditableCell({
  value,
  className,
  inputMode,
  onChange,
  disabled,
  highlighted,
  numeric = false,
}: {
  value: string;
  className?: string;
  inputMode?: 'text' | 'decimal' | 'numeric';
  onChange: (value: string) => void;
  disabled?: boolean;
  highlighted?: boolean;
  numeric?: boolean;
}) {
  return (
    <div
      className={cn(
        EDITABLE_CELL_CLASS,
        highlighted && 'bg-destructive/10 ring-1 ring-inset ring-destructive/40',
        className,
      )}
      data-highlighted={highlighted ? 'true' : undefined}
    >
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        inputMode={inputMode}
        className={numeric ? NUMERIC_INPUT_CLASS : TEXT_INPUT_CLASS}
      />
    </div>
  );
}

export interface DurabilityScheduleTableProps {
  rows: DurabilityScheduleRow[];
  globalMultiplier?: number | null;
  editable?: boolean;
  helperText?: string;
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
  helperText,
  highlightedFieldsByRowId,
  onRowChange,
  onMultiplierChange,
  minPaddingRows = MIN_PADDING_ROWS,
}: DurabilityScheduleTableProps) {
  const paddingRowCount = Math.max(0, minPaddingRows - rows.length);
  const multiplierDisplay = formatCell(globalMultiplier);

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-lg border bg-card">
      {helperText ? (
        <div className="flex shrink-0 items-start gap-1.5 border-b border-border/50 px-3 py-1.5 text-xs leading-5 text-muted-foreground">
          <Info
            className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <p className="min-w-0">{helperText}</p>
        </div>
      ) : null}
      <div className="min-h-0 w-full flex-1 overflow-hidden bg-card">
        <div className="sticky top-0 z-10 shrink-0 bg-card">
          <Row className="hover:bg-transparent">
            <HeaderCell>{COLUMN_HEADERS.rspFileName}</HeaderCell>
            <HeaderCell>{COLUMN_HEADERS.rspEventName}</HeaderCell>
            <HeaderCell title={COLUMN_HEADERS.schedulePattern}>
              {COLUMN_HEADERS.schedulePattern}
            </HeaderCell>
            <HeaderCell className="justify-center text-center">{COLUMN_HEADERS.weight}</HeaderCell>
            <HeaderCell className="justify-center text-center">{COLUMN_HEADERS.repeats}</HeaderCell>
            <HeaderCell className="justify-center text-center">
              {COLUMN_HEADERS.scheduleSequence}
            </HeaderCell>
            <HeaderCell className="justify-center border-r-0 text-center">
              {COLUMN_HEADERS.globalMultiplier}
            </HeaderCell>
          </Row>
        </div>

        <div>
          {rows.map((row) => (
            <Row key={row.id}>
              <LabelCell value={row.rspFileName} />
              {editable ? (
                <>
                  <EditableCell
                    value={row.rspEventName}
                    highlighted={isFieldHighlighted(
                      highlightedFieldsByRowId,
                      row.id,
                      'rspEventName',
                    )}
                    onChange={(value) => onRowChange?.(row.id, 'rspEventName', value)}
                  />
                  <EditableCell
                    value={row.schedulePattern}
                    highlighted={isFieldHighlighted(
                      highlightedFieldsByRowId,
                      row.id,
                      'schedulePattern',
                    )}
                    onChange={(value) => onRowChange?.(row.id, 'schedulePattern', value)}
                  />
                  <EditableCell
                    value={formatCell(row.weight)}
                    inputMode="decimal"
                    numeric
                    highlighted={isFieldHighlighted(highlightedFieldsByRowId, row.id, 'weight')}
                    onChange={(value) => onRowChange?.(row.id, 'weight', value)}
                  />
                  <EditableCell
                    value={formatCell(row.repeats)}
                    inputMode="numeric"
                    numeric
                    highlighted={isFieldHighlighted(highlightedFieldsByRowId, row.id, 'repeats')}
                    onChange={(value) => onRowChange?.(row.id, 'repeats', value)}
                  />
                  <EditableCell
                    value={formatCell(row.scheduleSequence)}
                    inputMode="numeric"
                    numeric
                    onChange={(value) => onRowChange?.(row.id, 'scheduleSequence', value)}
                  />
                  <EditableCell
                    value={multiplierDisplay}
                    inputMode="decimal"
                    numeric
                    className="border-r-0"
                    onChange={(value) => onMultiplierChange?.(value)}
                  />
                </>
              ) : (
                <>
                  <DataCell value={row.rspEventName} />
                  <DataCell value={row.schedulePattern} />
                  <DataCell value={row.weight} numeric />
                  <DataCell value={row.repeats} numeric />
                  <DataCell value={row.scheduleSequence} numeric />
                  <DataCell value={globalMultiplier} className="border-r-0" numeric />
                </>
              )}
            </Row>
          ))}

          {rows.length === 0 ? (
            <div className="flex h-8 items-center justify-center border-b border-border/50 px-3 text-xs leading-none text-muted-foreground">
              No RSP events matched this schedule for the selected program/version.
            </div>
          ) : null}

          {Array.from({ length: paddingRowCount }, (_, index) => (
            <Row key={`padding-${index}`} aria-hidden="true" className="hover:bg-transparent">
              {COLUMN_KEYS.map((key, cellIndex) => (
                <div
                  key={`padding-cell-${index}-${key}`}
                  className={cn(
                    'h-8 bg-muted/40',
                    TABLE_CELL_DIVIDER,
                    cellIndex === COLUMN_KEYS.length - 1 && 'border-r-0',
                  )}
                />
              ))}
            </Row>
          ))}
        </div>
      </div>
    </div>
  );
}
