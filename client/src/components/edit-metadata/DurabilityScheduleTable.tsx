'use client';

import type { CSSProperties } from 'react';
import { Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { DurabilityScheduleRow } from '@/features/edit-metadata/lib/build-durability-schedule-rows';

const COL_RSP_FILE = 220;
const COL_RSP_EVENT = 120;
const COL_SCHEDULE_PATTERN = 144;
const COL_WEIGHT = 72;
const COL_REPEATS = 72;
const COL_SCHEDULE_SEQUENCE = 156;
const COL_GLOBAL_MULTIPLIER = 132;

const COLUMN_WIDTHS = [
  COL_RSP_FILE,
  COL_RSP_EVENT,
  COL_SCHEDULE_PATTERN,
  COL_WEIGHT,
  COL_REPEATS,
  COL_SCHEDULE_SEQUENCE,
  COL_GLOBAL_MULTIPLIER,
] as const;

const TABLE_WIDTH = COLUMN_WIDTHS.reduce((sum, width) => sum + width, 0);
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
}: {
  children?: React.ReactNode;
  width: number;
  className?: string;
  title?: string;
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 items-center justify-center whitespace-nowrap border-b border-r border-border bg-muted/40 px-2 text-center text-[11px] leading-none',
        className,
      )}
      style={flexFor(width)}
      title={title}
    >
      {children}
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
}: {
  value: string;
  width: number;
  className?: string;
  inputMode?: 'text' | 'decimal' | 'numeric';
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 items-center border-b border-r border-border bg-muted/40',
        className,
      )}
      style={flexFor(width)}
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
  onRowChange?: (rowId: string, field: DurabilityScheduleEditableField, value: string) => void;
  onMultiplierChange?: (value: string) => void;
  minPaddingRows?: number;
}

export function DurabilityScheduleTable({
  rows,
  globalMultiplier = null,
  editable = false,
  onRowChange,
  onMultiplierChange,
  minPaddingRows = MIN_PADDING_ROWS,
}: DurabilityScheduleTableProps) {
  const paddingRowCount = Math.max(0, minPaddingRows - rows.length);
  const multiplierDisplay = formatCell(globalMultiplier);

  return (
    <div className="w-fit max-w-full shrink-0 overflow-hidden rounded-lg border bg-card">
      <div className="flex items-start gap-1.5 border-b px-3 py-1.5 text-xs leading-5 text-muted-foreground">
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
      <div className="overflow-x-auto">
        <div style={{ width: TABLE_WIDTH }}>
          <div className="sticky top-0 z-10 shrink-0 bg-card">
            <Row>
              <HeaderCell width={COL_RSP_FILE} className="font-medium text-foreground">
                RSP File Name
              </HeaderCell>
              <HeaderCell width={COL_RSP_EVENT} className="font-medium text-foreground">
                RSP Event Name
              </HeaderCell>
              <HeaderCell width={COL_SCHEDULE_PATTERN} className="font-medium text-foreground">
                Schedule Pattern
              </HeaderCell>
              <HeaderCell width={COL_WEIGHT} className="font-medium text-foreground">
                Weight
              </HeaderCell>
              <HeaderCell width={COL_REPEATS} className="font-medium text-foreground">
                Repeats
              </HeaderCell>
              <HeaderCell width={COL_SCHEDULE_SEQUENCE} className="font-medium text-foreground">
                Schedule Sequence
              </HeaderCell>
              <HeaderCell width={COL_GLOBAL_MULTIPLIER} className="border-r-0 font-medium text-foreground">
                Global Multiplier
              </HeaderCell>
            </Row>
          </div>

          <div className="max-h-[min(60vh,640px)] overflow-y-auto">
            {rows.map((row) => (
              <Row key={row.id} className="bg-card transition-colors hover:bg-muted/30">
                <DataCell value={row.rspFileName} width={COL_RSP_FILE} />
                {editable ? (
                  <>
                    <EditableCell
                      value={row.rspEventName}
                      width={COL_RSP_EVENT}
                      onChange={(value) => onRowChange?.(row.id, 'rspEventName', value)}
                    />
                    <EditableCell
                      value={row.schedulePattern}
                      width={COL_SCHEDULE_PATTERN}
                      onChange={(value) => onRowChange?.(row.id, 'schedulePattern', value)}
                    />
                    <EditableCell
                      value={formatCell(row.weight)}
                      width={COL_WEIGHT}
                      inputMode="decimal"
                      onChange={(value) => onRowChange?.(row.id, 'weight', value)}
                    />
                    <EditableCell
                      value={formatCell(row.repeats)}
                      width={COL_REPEATS}
                      inputMode="numeric"
                      onChange={(value) => onRowChange?.(row.id, 'repeats', value)}
                    />
                    <EditableCell
                      value={formatCell(row.scheduleSequence)}
                      width={COL_SCHEDULE_SEQUENCE}
                      inputMode="numeric"
                      onChange={(value) => onRowChange?.(row.id, 'scheduleSequence', value)}
                    />
                    <EditableCell
                      value={multiplierDisplay}
                      width={COL_GLOBAL_MULTIPLIER}
                      inputMode="decimal"
                      className="border-r-0"
                      onChange={(value) => onMultiplierChange?.(value)}
                    />
                  </>
                ) : (
                  <>
                    <DataCell value={row.rspEventName} width={COL_RSP_EVENT} />
                    <DataCell value={row.schedulePattern} width={COL_SCHEDULE_PATTERN} />
                    <DataCell value={row.weight} width={COL_WEIGHT} />
                    <DataCell value={row.repeats} width={COL_REPEATS} />
                    <DataCell value={row.scheduleSequence} width={COL_SCHEDULE_SEQUENCE} />
                    <DataCell
                      value={globalMultiplier}
                      width={COL_GLOBAL_MULTIPLIER}
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
                {COLUMN_WIDTHS.map((width, cellIndex) => (
                  <div
                    key={`padding-cell-${index}-${cellIndex}`}
                    className={cn(
                      'h-8 border-b border-r border-border bg-card',
                      cellIndex === COLUMN_WIDTHS.length - 1 && 'border-r-0',
                    )}
                    style={flexFor(width)}
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
