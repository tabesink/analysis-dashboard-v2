'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, AlertTriangle, Columns, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { DamageEventTree } from '@/components/damage/DamageEventTree';
import { FilterableColumnHeader } from '@/components/database-table';
import { ColumnResizeHandle } from '@/components/upload/ColumnResizeHandle';
import { cn } from '@/lib/utils';
import {
  filterRowsByColumnFilters,
  MIN_COLUMN_PX,
  PROGRAM_ID_DEFAULT_PX,
  PROGRAM_ID_KEY,
  toggleSortField,
  type SortDirection,
  updateColumnFilter,
  widthForValues,
} from '@/lib/database-table/shared';
import {
  getDefaultColumnFilters,
  mergeTreeExpansionWithTreeKeys,
  resolvePersistedExpansion,
  tablePreferencesUiEqual,
  treeKeysFromEvents,
  type InspectDamageTablePreferences,
} from '@/lib/inspect-damage-table-preferences';
import {
  isDamageCellDisplayable,
  isDamageCellStale,
  type InspectDamageViewState,
} from '@/features/inspect-damage/lib/inspect-damage-view-state';
import type { DamageInspectResponse, EventMetadata } from '@/types/api';
import { formatDamage } from '@/lib/inspect-damage-format';

const CHANNEL_COL_WIDTH = 56;
const METADATA_COLUMNS = [
  { key: 'work_order', label: 'Work Order' },
  { key: 'job_number', label: 'Program ID' },
] as const;

type ColumnDefinition = {
  key: string;
  label: string;
};

type SortField = string;
type TablePreferencesPayload = Omit<InspectDamageTablePreferences, 'updatedAt'>;

function getColumnValue(event: EventMetadata, columnKey: string): string {
  if (columnKey === 'work_order') return event.work_order ?? '';
  if (columnKey === 'job_number') return event.job_number ?? '';
  return '';
}

export function DamageTableView({
  title = 'Damage Table',
  events,
  damageRowsByEventId,
  channelMetadata,
  isLoading,
  inspectError,
  viewState,
  isCalculatingDamage,
  preferencesLoaded,
  tablePreferences,
  onSetTablePreferences,
  onResetTablePreferences,
  emptyStateTitle = 'No calculated damage available',
  emptyStateDescription = 'No persisted damage results are available yet. Run a damage calculation to populate this table.',
}: {
  title?: string;
  events: EventMetadata[];
  damageRowsByEventId: Map<string, DamageInspectResponse['rows'][number]>;
  channelMetadata: Map<string, DamageInspectResponse['channels'][number]>;
  isLoading: boolean;
  inspectError: Error | null;
  viewState: InspectDamageViewState;
  isCalculatingDamage: boolean;
  preferencesLoaded: boolean;
  tablePreferences: TablePreferencesPayload | null;
  onSetTablePreferences: (payload: TablePreferencesPayload) => void;
  onResetTablePreferences: () => void;
  emptyStateTitle?: string;
  emptyStateDescription?: string;
}) {
  const channelColumnDefinitions = useMemo<ColumnDefinition[]>(
    () =>
      Array.from(channelMetadata.values()).map((channel) => ({
        key: channel.channel_key,
        label: channel.channel_name || channel.channel_key,
      })),
    [channelMetadata],
  );
  const channelKeys = useMemo(
    () => new Set(channelColumnDefinitions.map((col) => col.key)),
    [channelColumnDefinitions],
  );
  const columnDefinitions = useMemo<ColumnDefinition[]>(
    () => [...METADATA_COLUMNS, ...channelColumnDefinitions],
    [channelColumnDefinitions],
  );

  const [sortField, setSortField] = useState<SortField>('job_number');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>(
    getDefaultColumnFilters,
  );
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    const next: Record<string, boolean> = {};
    for (const col of columnDefinitions) {
      next[col.key] = true;
    }
    return next;
  });
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [expandedPrograms, setExpandedPrograms] = useState<Set<string>>(new Set());
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(new Set());
  const [preferencesHydrated, setPreferencesHydrated] = useState(false);
  const expansionInitializedRef = useRef(false);
  const expansionTreeHydratedRef = useRef(false);
  const expandedProgramsRef = useRef(expandedPrograms);
  const expandedVersionsRef = useRef(expandedVersions);

  useEffect(() => {
    expandedProgramsRef.current = expandedPrograms;
    expandedVersionsRef.current = expandedVersions;
  }, [expandedPrograms, expandedVersions]);

  const defaultColumnWidths = useMemo(() => {
    const next: Record<string, number> = {
      [PROGRAM_ID_KEY]: PROGRAM_ID_DEFAULT_PX,
    };
    for (const col of METADATA_COLUMNS) {
      const values = events
        .map((event) => getColumnValue(event, col.key))
        .filter((value) => value !== '');
      next[col.key] = widthForValues(col.label, values);
    }
    for (const col of channelColumnDefinitions) {
      next[col.key] = Math.max(CHANNEL_COL_WIDTH, widthForValues(col.label, []));
    }
    return next;
  }, [channelColumnDefinitions, events]);

  const treeKeySignature = useMemo(() => {
    const { programIds, versionKeys } = treeKeysFromEvents(events);
    return JSON.stringify({ programIds, versionKeys });
  }, [events]);

  useEffect(() => {
    if (!preferencesLoaded || preferencesHydrated) return;
    if (!tablePreferences) return;
    setSortField(tablePreferences.sortField);
    setSortDirection(tablePreferences.sortDirection);
    setColumnFilters(tablePreferences.columnFilters);
  }, [preferencesHydrated, preferencesLoaded, tablePreferences]);

  useEffect(() => {
    if (!preferencesLoaded) return;
    const { programIds, versionKeys } = JSON.parse(treeKeySignature) as {
      programIds: string[];
      versionKeys: string[];
    };
    if (programIds.length === 0) return;

    const stored = expansionInitializedRef.current
      ? {
          expandedPrograms: [...expandedProgramsRef.current],
          expandedVersions: [...expandedVersionsRef.current],
        }
      : {
          expandedPrograms: tablePreferences?.expandedPrograms ?? [],
          expandedVersions: tablePreferences?.expandedVersions ?? [],
        };

    const merged = mergeTreeExpansionWithTreeKeys(stored, programIds, versionKeys);
    const nextPrograms = new Set(merged.expandedPrograms);
    const nextVersions = new Set(merged.expandedVersions);

    setExpandedPrograms((prev) => {
      if (prev.size === nextPrograms.size && [...prev].every((id) => nextPrograms.has(id))) {
        return prev;
      }
      return nextPrograms;
    });
    setExpandedVersions((prev) => {
      if (prev.size === nextVersions.size && [...prev].every((key) => nextVersions.has(key))) {
        return prev;
      }
      return nextVersions;
    });
    expansionInitializedRef.current = true;
    expansionTreeHydratedRef.current = true;
  }, [preferencesLoaded, tablePreferences, treeKeySignature]);

  useEffect(() => {
    if (!preferencesLoaded) return;
    let didHydrateInThisRun = false;

    setVisibleColumns((prev) => {
      const next: Record<string, boolean> = {};
      for (const col of columnDefinitions) {
        if (preferencesHydrated && col.key in prev) {
          next[col.key] = prev[col.key];
          continue;
        }
        if (tablePreferences?.visibleColumns[col.key] !== undefined) {
          next[col.key] = tablePreferences.visibleColumns[col.key];
          continue;
        }
        next[col.key] = true;
      }
      if (!preferencesHydrated && preferencesLoaded) {
        didHydrateInThisRun = true;
      }
      const nextEntries = Object.entries(next);
      if (
        nextEntries.length === Object.keys(prev).length &&
        nextEntries.every(([key, value]) => prev[key] === value)
      ) {
        return prev;
      }
      return next;
    });

    if (didHydrateInThisRun) {
      setPreferencesHydrated(true);
    }
  }, [columnDefinitions, preferencesHydrated, preferencesLoaded, tablePreferences]);

  useEffect(() => {
    if (!preferencesLoaded) return;
    setColumnWidths((prev) => {
      const next: Record<string, number> = {};
      next[PROGRAM_ID_KEY] =
        (preferencesHydrated ? prev[PROGRAM_ID_KEY] : undefined) ??
        tablePreferences?.columnWidths[PROGRAM_ID_KEY] ??
        defaultColumnWidths[PROGRAM_ID_KEY];
      for (const col of columnDefinitions) {
        const existing = preferencesHydrated ? prev[col.key] : undefined;
        const stored = tablePreferences?.columnWidths[col.key];
        const fallback = defaultColumnWidths[col.key] ?? MIN_COLUMN_PX;
        next[col.key] = existing ?? stored ?? fallback;
      }
      const nextEntries = Object.entries(next);
      if (
        nextEntries.length === Object.keys(prev).length &&
        nextEntries.every(([key, value]) => prev[key] === value)
      ) {
        return prev;
      }
      return next;
    });
  }, [
    columnDefinitions,
    defaultColumnWidths,
    preferencesHydrated,
    preferencesLoaded,
    tablePreferences,
  ]);

  useEffect(() => {
    if (!preferencesHydrated) return;
    const persistedExpansion = resolvePersistedExpansion(
      expansionTreeHydratedRef.current,
      {
        expandedPrograms: [...expandedPrograms],
        expandedVersions: [...expandedVersions],
      },
      tablePreferences ?? undefined,
    );
    const nextPayload = {
      visibleColumns,
      columnWidths,
      expandedPrograms: persistedExpansion.expandedPrograms,
      expandedVersions: persistedExpansion.expandedVersions,
      sortField,
      sortDirection,
      columnFilters,
    };
    if (tablePreferencesUiEqual(tablePreferences, nextPayload)) return;
    onSetTablePreferences(nextPayload);
  }, [
    columnFilters,
    columnWidths,
    expandedPrograms,
    expandedVersions,
    onSetTablePreferences,
    preferencesHydrated,
    sortDirection,
    sortField,
    tablePreferences,
    visibleColumns,
  ]);

  const setColumnWidth = useCallback((key: string, next: number) => {
    setColumnWidths((prev) => (prev[key] === next ? prev : { ...prev, [key]: next }));
  }, []);

  const handleSort = useCallback(
    (field: SortField) => {
      const next = toggleSortField(sortField, sortDirection, field);
      setSortField(next.sortField);
      setSortDirection(next.sortDirection);
    },
    [sortDirection, sortField],
  );

  const handleColumnFilterChange = useCallback(
    (column: string, value: string, checked: boolean) => {
      setColumnFilters((prev) => updateColumnFilter(prev, column, value, checked));
    },
    [],
  );

  const handleColumnVisibilityToggle = useCallback(
    (columnKey: string, checked: boolean) => {
      const currentVisibleCount = Object.values(visibleColumns).filter(Boolean).length;
      if (!checked && currentVisibleCount <= 1) {
        toast.error('At least one column must be visible');
        return;
      }
      setVisibleColumns((prev) => ({ ...prev, [columnKey]: checked }));
    },
    [visibleColumns],
  );

  const resetTablePreferences = useCallback(() => {
    onResetTablePreferences();
    const nextVisible: Record<string, boolean> = {};
    for (const col of columnDefinitions) {
      nextVisible[col.key] = true;
    }
    setVisibleColumns(nextVisible);
    setColumnWidths({
      ...defaultColumnWidths,
      [PROGRAM_ID_KEY]: PROGRAM_ID_DEFAULT_PX,
    });
    setSortField('job_number');
    setSortDirection('asc');
    setColumnFilters(getDefaultColumnFilters());
    const { programIds, versionKeys } = treeKeysFromEvents(events);
    const merged = mergeTreeExpansionWithTreeKeys(
      { expandedPrograms: [], expandedVersions: [] },
      programIds,
      versionKeys,
    );
    setExpandedPrograms(new Set(merged.expandedPrograms));
    setExpandedVersions(new Set(merged.expandedVersions));
    expansionInitializedRef.current = programIds.length > 0;
    expansionTreeHydratedRef.current = programIds.length > 0;
    setPreferencesHydrated(true);
  }, [columnDefinitions, defaultColumnWidths, events, onResetTablePreferences]);

  const toggleProgramExpanded = useCallback((programId: string) => {
    setExpandedPrograms((prev) => {
      const next = new Set(prev);
      if (next.has(programId)) {
        next.delete(programId);
      } else {
        next.add(programId);
      }
      return next;
    });
  }, []);

  const toggleVersionExpanded = useCallback((versionKey: string) => {
    setExpandedVersions((prev) => {
      const next = new Set(prev);
      if (next.has(versionKey)) {
        next.delete(versionKey);
      } else {
        next.add(versionKey);
      }
      return next;
    });
  }, []);

  const getUniqueValues = useMemo(() => {
    const uniqueValues: Record<string, string[]> = {};
    for (const col of METADATA_COLUMNS) {
      const values = new Set<string>();
      events.forEach((event) => {
        const value = getColumnValue(event, col.key);
        if (value) values.add(value);
      });
      uniqueValues[col.key] = Array.from(values).sort();
    }
    return uniqueValues;
  }, [events]);

  const filteredEvents = useMemo(
    () => filterRowsByColumnFilters(events, columnFilters, getColumnValue),
    [columnFilters, events],
  );

  const sortedEvents = useMemo(() => {
    return [...filteredEvents].sort((a, b) => {
      const valueA = getColumnValue(a, sortField);
      const valueB = getColumnValue(b, sortField);
      const sortMultiplier = sortDirection === 'asc' ? 1 : -1;
      return sortMultiplier * valueA.localeCompare(valueB);
    });
  }, [filteredEvents, sortDirection, sortField]);

  const visibleColumnDefs = useMemo(
    () => columnDefinitions.filter((col) => visibleColumns[col.key]),
    [columnDefinitions, visibleColumns],
  );

  const visibleMetadataColumns = useMemo(
    () => visibleColumnDefs.filter((col) =>
      METADATA_COLUMNS.some((meta) => meta.key === col.key),
    ),
    [visibleColumnDefs],
  );

  const visibleChannelColumns = useMemo(
    () => visibleColumnDefs.filter((col) => channelKeys.has(col.key)),
    [channelKeys, visibleColumnDefs],
  );

  const programIdWidth = columnWidths[PROGRAM_ID_KEY] ?? PROGRAM_ID_DEFAULT_PX;
  const totalRowWidth = useMemo(() => {
    const metadataAndChannelWidth = visibleColumnDefs.reduce(
      (sum, col) => sum + (columnWidths[col.key] ?? MIN_COLUMN_PX),
      0,
    );
    return programIdWidth + metadataAndChannelWidth;
  }, [columnWidths, programIdWidth, visibleColumnDefs]);

  return (
    <>
      <div className="shrink-0 flex items-center justify-between border-b px-4 py-3">
        <div className="flex min-h-9 items-center gap-2">
          <p className="text-sm font-medium">{title}</p>
          {(isLoading || isCalculatingDamage) && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {isCalculatingDamage ? 'Calculation running...' : 'Loading saved damage results...'}
            </div>
          )}
        </div>
        <div className="flex min-h-9 items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                aria-label="Column visibility"
                className={cn('min-w-[5.75rem] justify-center')}
              >
                <Columns className="size-4" />
                Cols
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-3" align="end">
              <div className="space-y-3">
                <div className="text-xs font-semibold">Column Visibility</div>
                <div className="space-y-2 bg-muted/70 rounded-md p-2 max-h-[280px] overflow-y-auto">
                  {columnDefinitions.map((col) => (
                    <div key={col.key} className="flex items-center space-x-2">
                      <Checkbox
                        id={`damage-col-${col.key}`}
                        checked={visibleColumns[col.key]}
                        onCheckedChange={(checked) =>
                          handleColumnVisibilityToggle(col.key, checked as boolean)
                        }
                        className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                      />
                      <label
                        htmlFor={`damage-col-${col.key}`}
                        className="text-xs cursor-pointer flex-1"
                      >
                        {col.label}
                      </label>
                    </div>
                  ))}
                </div>
                <div className="text-xs text-muted-foreground pt-2 border-t">
                  {Object.values(visibleColumns).filter(Boolean).length} columns visible
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={resetTablePreferences}
                  className="h-7 w-full justify-start px-2 text-xs"
                >
                  Reset table preferences
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <CardContent className="min-h-0 flex-1 overflow-auto p-0">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[400px] text-center">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Activity className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-sm font-medium text-foreground mb-1">{emptyStateTitle}</h3>
            <p className="text-xs text-muted-foreground max-w-[280px]">
              {emptyStateDescription}
            </p>
          </div>
        ) : (
          <div style={{ minWidth: totalRowWidth }}>
            {inspectError ? (
              <div className="m-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {inspectError.message}
              </div>
            ) : null}
            {viewState.runningScopes.length > 0 ? (
              <div className="m-3 flex items-start gap-2 rounded-lg border border-blue-500/40 bg-blue-500/10 px-4 py-3 text-sm text-blue-950">
                <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
                <div className="flex-1">
                  <p className="font-medium">Calculation running</p>
                  <p className="mt-1 text-xs text-blue-900/80">
                    Loading saved damage results while processing continues for:
                  </p>
                  <p className="mt-2 text-xs font-medium text-blue-900">
                    {viewState.runningScopes
                      .map((scope) => `${scope.program_id} / ${scope.version}`)
                      .join(', ')}
                  </p>
                </div>
              </div>
            ) : null}
            {viewState.failureReports.map((report) => (
              <div
                key={report.summary}
                className="m-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm"
              >
                <p className="font-medium text-foreground">Latest damage attempt failed</p>
                <p className="mt-1 text-xs text-muted-foreground">{report.summary}</p>
              </div>
            ))}
            <div className="sticky top-0 z-10 flex items-center py-2 px-3 border-b bg-card text-xs font-semibold text-foreground/70">
              <div
                className="relative flex items-center gap-2 shrink-0 pl-1"
                style={{ width: programIdWidth }}
              >
                <span>Job ID</span>
                <ColumnResizeHandle
                  width={programIdWidth}
                  onResize={(next) => setColumnWidth(PROGRAM_ID_KEY, next)}
                />
              </div>
              <div className="flex items-center">
                {visibleMetadataColumns.map((col) => (
                  <FilterableColumnHeader
                    key={col.key}
                    label={col.label}
                    field={col.key}
                    width={columnWidths[col.key] ?? MIN_COLUMN_PX}
                    sortField={sortField}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                    columnFilters={columnFilters}
                    onColumnFilterChange={handleColumnFilterChange}
                    uniqueValues={getUniqueValues}
                    onResize={(next) => setColumnWidth(col.key, next)}
                  />
                ))}
                {visibleChannelColumns.map((col) => {
                  const metadata = channelMetadata.get(col.key);
                  const title = metadata
                    ? `${metadata.channel_name}${metadata.unit ? ` (${metadata.unit})` : ''}`
                    : col.label;
                  const width = columnWidths[col.key] ?? CHANNEL_COL_WIDTH;
                  const columnHasStaleValues = events.some((event) =>
                    isDamageCellStale(damageRowsByEventId.get(event.event_id)?.damages[col.key]),
                  );
                  return (
                    <div
                      key={col.key}
                      title={title}
                      className="relative shrink-0 px-2 text-center"
                      style={{ width }}
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.label}
                        {columnHasStaleValues ? (
                          <span className="rounded bg-amber-500/15 px-1 text-[10px] font-medium text-amber-800">
                            Outdated
                          </span>
                        ) : null}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            <DamageEventTree
              events={sortedEvents}
              columnDefinitions={visibleMetadataColumns}
              channelKeys={visibleChannelColumns.map((col) => col.key)}
              columnWidths={columnWidths}
              programIdWidth={programIdWidth}
              expandedPrograms={expandedPrograms}
              expandedVersions={expandedVersions}
              onToggleProgramExpanded={toggleProgramExpanded}
              onToggleVersionExpanded={toggleVersionExpanded}
              getColumnValue={getColumnValue}
              renderChannelCell={(eventId, channelKey) => {
                const row = damageRowsByEventId.get(eventId);
                const cell = row?.damages[channelKey];
                if (isLoading && !cell) return '...';
                if (!cell || !isDamageCellDisplayable(cell)) return '';
                if (cell.status === 'error') {
                  return (
                    <span
                      className="inline-flex items-center gap-1 rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive"
                      title={cell.error ?? 'Damage calculation failed'}
                    >
                      <AlertTriangle className="size-3" />
                      Error
                    </span>
                  );
                }
                if (cell.status === 'unavailable') {
                  return (
                    <span
                      className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                      title={cell.error ?? 'No mapped channel data is available for this event'}
                    >
                      Unavailable
                    </span>
                  );
                }
                const value = formatDamage(cell.damage);
                if (!isDamageCellStale(cell)) return value;
                return (
                  <span className="inline-flex items-center gap-1">
                    <span>{value}</span>
                    <span className="rounded bg-amber-500/15 px-1 text-[10px] font-medium text-amber-800">
                      Outdated
                    </span>
                  </span>
                );
              }}
            />
          </div>
        )}
      </CardContent>
    </>
  );
}
