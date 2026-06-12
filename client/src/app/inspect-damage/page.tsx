'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Columns,
  Loader2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { LoadingSpinner, SidePanelLayout } from '@/components/shared';
import { Skeleton } from '@/components/ui/skeleton';
import { GlobalFilters } from '@/components/dashboard/side-panel/GlobalFilters';
import {
  ComparisonLoadDataSections,
} from '@/components/dashboard/side-panel';
import { DamageEventTree } from '@/components/damage/DamageEventTree';
import { FilterableColumnHeader } from '@/components/database-table';
import { ColumnResizeHandle } from '@/components/upload/ColumnResizeHandle';
import { useEventCatalog } from '@/hooks/use-event-catalog';
import { useInspectDamageState } from '@/hooks/use-inspect-damage-state';
import { useInspectDamageSelectedEvents } from '@/hooks/use-inspect-damage-selected-events';
import { useDashboardWorkspace } from '@/modules/dashboard-workspace';
import { selectCanWrite, useAuthStore } from '@/stores/auth-store';
import {
  closeDamageCalculationSummary,
  dismissDamageCalculationModal,
  getDamageCalculationScopeState,
  isDamageCalculationActive,
} from '@/stores/damage-calculation-store';
import type { InspectDamageViewState } from '@/features/inspect-damage/lib/inspect-damage-view-state';
import { DAMAGE_CHANNELS } from '@/features/inspect-damage-3d/lib/damage-channel-axis';
import { DamagePlotView } from '@/features/inspect-damage-3d/components/DamagePlotView';
import {
  InspectDamageCentralTabSwitcher,
  type InspectDamageCentralTab,
} from '@/features/inspect-damage/components/InspectDamageCentralTabSwitcher';
import { DerivedDataOperationModal } from '@/features/edit-metadata/DerivedDataOperationModal';
import { applyInspectDamageCalculateResponse } from '@/features/inspect-damage/lib/apply-inspect-damage-calculate';
import {
  buildDamageComparisonViewModel,
  getComparisonInspectEventIds,
  type DamageComparisonViewModel,
} from '@/features/inspect-damage/lib/build-damage-comparison-view-model';
import {
  isDamageCellDisplayable,
  isDamageCellStale,
  resolveInspectDamageViewState,
} from '@/features/inspect-damage/lib/inspect-damage-view-state';
import { damageApi } from '@/lib/api';
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
} from '@/lib/inspect-damage-table-preferences';
import type {
  DamageInspectResponse,
  DamageInspectScopeState,
  EventMetadata,
} from '@/types/api';
import type { DamageComparisonState } from '@/types/damage-comparison';
import { formatDamage } from '../../lib/inspect-damage-format';

const CHANNEL_COL_WIDTH = 56;
const DEFAULT_COMPARISON_CHANNEL_KEYS = DAMAGE_CHANNELS.map((channel) => channel.key);

const METADATA_COLUMNS = [
  { key: 'work_order', label: 'Work Order' },
  { key: 'job_number', label: 'Program ID' },
] as const;

type ColumnDefinition = {
  key: string;
  label: string;
};

type SortField = string;

function getColumnValue(event: EventMetadata, columnKey: string): string {
  if (columnKey === 'work_order') return event.work_order ?? '';
  if (columnKey === 'job_number') return event.job_number ?? '';
  return '';
}

export default function InspectDamagePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const authStatus = useAuthStore((s) => s.status);
  const canWrite = useAuthStore(selectCanWrite);
  const [sidePanelCollapsed, setSidePanelCollapsed] = useState(false);
  const [centralTab, setCentralTab] = useState<InspectDamageCentralTab>('table');
  const [activeCalculateScope, setActiveCalculateScope] = useState<DamageInspectScopeState | null>(
    null,
  );
  const { comparison, updateComparison, isSessionReady } = useInspectDamageState();
  const { events, isLoading: isEventsLoading } = useEventCatalog();
  useDashboardWorkspace();
  const effectiveComparison = useMemo<DamageComparisonState>(
    () =>
      comparison.selected_channel_keys.length > 0
        ? comparison
        : {
            ...comparison,
            selected_channel_keys: DEFAULT_COMPARISON_CHANNEL_KEYS,
          },
    [comparison],
  );
  const comparisonInspectEventIds = useMemo(
    () => getComparisonInspectEventIds(effectiveComparison),
    [effectiveComparison],
  );
  const inspectEventIds = comparisonInspectEventIds;
  const { selectedEvents } = useInspectDamageSelectedEvents(
    inspectEventIds,
    events,
  );
  const isPanelReady = isSessionReady && !isEventsLoading;
  const expandSidePanel = () => setSidePanelCollapsed(false);
  const inspectScopes = useMemo(
    () =>
      Array.from(
        new Map(
          selectedEvents.map((event) => [
            `${event.program_id}::${event.version}`,
            { programId: event.program_id, version: event.version },
          ]),
        ).values(),
      ),
    [selectedEvents],
  );
  const isDamageCalculationRunning = inspectScopes.some((scope) =>
    isDamageCalculationActive(scope),
  );
  const {
    data: damageResponse = null,
    isFetching: isInspectFetching,
    isLoading: isInspectLoading,
    error: inspectError,
  } = useQuery({
    queryKey: ['damage-inspect', inspectEventIds],
    queryFn: () => damageApi.inspect(inspectEventIds),
    enabled: inspectEventIds.length > 0,
    refetchInterval: isDamageCalculationRunning ? 2000 : false,
  });
  const viewState = useMemo(
    () => resolveInspectDamageViewState({ response: damageResponse, canWrite }),
    [canWrite, damageResponse],
  );
  const damageRowsByEventId = useMemo(() => {
    const map = new Map<string, DamageInspectResponse['rows'][number]>();
    for (const row of damageResponse?.rows ?? []) {
      map.set(row.event_id, row);
    }
    return map;
  }, [damageResponse]);
  const channelMetadata = useMemo(() => {
    const map = new Map<string, DamageInspectResponse['channels'][number]>();
    for (const channel of damageResponse?.channels ?? []) {
      map.set(channel.channel_key, channel);
    }
    return map;
  }, [damageResponse]);
  const comparisonViewModel = useMemo(
    () =>
      buildDamageComparisonViewModel({
        comparison: effectiveComparison,
        response: damageResponse,
      }),
    [damageResponse, effectiveComparison],
  );

  const calculateMutation = useMutation({
    mutationFn: (scope: DamageInspectScopeState) =>
      damageApi.calculate(scope.program_id, scope.version),
    onSuccess: (response, scope) => {
      const result = applyInspectDamageCalculateResponse({
        scope: { programId: scope.program_id, version: scope.version },
        response,
        queryClient,
      });
      setActiveCalculateScope(scope);
      if (result === 'damage_task') {
        toast.success('Damage calculation started');
      }
    },
  });
  const activeModalScope = activeCalculateScope
    ? {
        programId: activeCalculateScope.program_id,
        version: activeCalculateScope.version,
      }
    : null;
  const activeModalState = activeModalScope
    ? getDamageCalculationScopeState(activeModalScope)
    : null;

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.replace('/login');
    }
  }, [authStatus, router]);

  if (authStatus === 'loading' || authStatus === 'idle') {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[calc(100vh-3.5rem)]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 min-h-[calc(100vh-3.5rem)]">
      <div className="flex gap-0 h-[calc(100vh-7rem)]">
        <SidePanelLayout
          isCollapsed={sidePanelCollapsed}
          onToggleCollapse={() => setSidePanelCollapsed((prev) => !prev)}
          expandedWidth="w-[320px]"
        >
          <div className="flex-1 min-h-0 flex flex-col w-full">
            <ScrollArea className="flex-1 min-h-0 w-full">
              <div className="p-5 space-y-5">
                {!isPanelReady ? (
                  <div className="space-y-4">
                    <Skeleton className="h-5 w-32 rounded" />
                    <Skeleton className="h-24 w-full rounded-lg" />
                  </div>
                ) : (
                  <>
                    <GlobalFilters
                      isCollapsed={sidePanelCollapsed}
                      onExpand={expandSidePanel}
                    />
                    <div className="py-1">
                      <Separator className="bg-border/70" />
                    </div>
                    <ComparisonLoadDataSections
                      comparison={comparison}
                      events={events}
                      isLoading={isEventsLoading}
                      onUpdateComparison={updateComparison}
                      isCollapsed={sidePanelCollapsed}
                      onExpand={expandSidePanel}
                    />
                  </>
                )}
              </div>
            </ScrollArea>
          </div>
        </SidePanelLayout>

        <div className="flex-1 min-w-0 min-h-0">
          <Card className="h-full rounded-none flex flex-col gap-0 overflow-hidden shadow-subtle border-y border-l py-0">
            <DamageTable
              events={selectedEvents}
              damageRowsByEventId={damageRowsByEventId}
              channelMetadata={channelMetadata}
              comparison={effectiveComparison}
              comparisonViewModel={comparisonViewModel}
              onUpdateComparison={updateComparison}
              centralTab={centralTab}
              onCentralTabChange={setCentralTab}
              isLoading={isInspectLoading || isInspectFetching}
              inspectError={inspectError}
              viewState={viewState}
              isCalculatingDamage={calculateMutation.isPending || isDamageCalculationRunning}
            />
          </Card>
        </div>
      </div>
      {activeModalState && activeModalScope ? (
        <DerivedDataOperationModal
          open={activeModalState.modalOpen}
          onOpenChange={(open) => {
            if (!open) {
              dismissDamageCalculationModal(activeModalScope);
            }
          }}
          taskKind="damage_calculation"
          wizardStep={activeModalState.wizardStep}
          progress={activeModalState.progress}
          progressPhase={activeModalState.progressPhase}
          progressMessage={activeModalState.progressMessage}
          completionResult={activeModalState.completionResult}
          onDismissProgress={() => dismissDamageCalculationModal(activeModalScope)}
          onCloseSummary={() => closeDamageCalculationSummary(activeModalScope)}
        />
      ) : null}
    </div>
  );
}

function DamageTable({
  events,
  damageRowsByEventId,
  channelMetadata,
  comparison,
  comparisonViewModel,
  onUpdateComparison,
  centralTab,
  onCentralTabChange,
  isLoading,
  inspectError,
  viewState,
  isCalculatingDamage,
}: {
  events: EventMetadata[];
  damageRowsByEventId: Map<string, DamageInspectResponse['rows'][number]>;
  channelMetadata: Map<string, DamageInspectResponse['channels'][number]>;
  comparison: DamageComparisonState;
  comparisonViewModel: DamageComparisonViewModel;
  onUpdateComparison: (patch: Partial<DamageComparisonState>) => void;
  centralTab: InspectDamageCentralTab;
  onCentralTabChange: (tab: InspectDamageCentralTab) => void;
  isLoading: boolean;
  inspectError: Error | null;
  viewState: InspectDamageViewState;
  isCalculatingDamage: boolean;
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
  const {
    isSessionReady,
    tablePreferencesUi,
    setTablePreferences,
    resetTablePreferences: resetSessionTablePreferences,
  } = useInspectDamageState();
  const sessionTablePreferences = tablePreferencesUi;
  const preferencesLoaded = isSessionReady;
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
    if (!sessionTablePreferences) return;
    setSortField(sessionTablePreferences.sortField);
    setSortDirection(sessionTablePreferences.sortDirection);
    setColumnFilters(sessionTablePreferences.columnFilters);
  }, [preferencesHydrated, preferencesLoaded, sessionTablePreferences]);

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
          expandedPrograms: sessionTablePreferences?.expandedPrograms ?? [],
          expandedVersions: sessionTablePreferences?.expandedVersions ?? [],
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
  }, [preferencesLoaded, sessionTablePreferences, treeKeySignature]);

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
        if (sessionTablePreferences?.visibleColumns[col.key] !== undefined) {
          next[col.key] = sessionTablePreferences.visibleColumns[col.key];
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
  }, [columnDefinitions, preferencesHydrated, preferencesLoaded, sessionTablePreferences]);

  useEffect(() => {
    if (!preferencesLoaded) return;
    setColumnWidths((prev) => {
      const next: Record<string, number> = {};
      next[PROGRAM_ID_KEY] =
        (preferencesHydrated ? prev[PROGRAM_ID_KEY] : undefined) ??
        sessionTablePreferences?.columnWidths[PROGRAM_ID_KEY] ??
        defaultColumnWidths[PROGRAM_ID_KEY];
      for (const col of columnDefinitions) {
        const existing = preferencesHydrated ? prev[col.key] : undefined;
        const stored = sessionTablePreferences?.columnWidths[col.key];
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
    sessionTablePreferences,
  ]);

  useEffect(() => {
    if (!preferencesHydrated) return;
    const persistedExpansion = resolvePersistedExpansion(
      expansionTreeHydratedRef.current,
      {
        expandedPrograms: [...expandedPrograms],
        expandedVersions: [...expandedVersions],
      },
      sessionTablePreferences ?? undefined,
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
    if (tablePreferencesUiEqual(tablePreferencesUi, nextPayload)) return;
    setTablePreferences(nextPayload);
  }, [
    columnFilters,
    columnWidths,
    expandedPrograms,
    expandedVersions,
    preferencesHydrated,
    setTablePreferences,
    sessionTablePreferences,
    sortDirection,
    sortField,
    tablePreferencesUi,
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

  const handleColumnVisibilityToggle = useCallback((columnKey: string, checked: boolean) => {
    const currentVisibleCount = Object.values(visibleColumns).filter(Boolean).length;
    if (!checked && currentVisibleCount <= 1) {
      toast.error('At least one column must be visible');
      return;
    }
    setVisibleColumns((prev) => ({ ...prev, [columnKey]: checked }));
  }, [visibleColumns]);

  const resetTablePreferences = useCallback(() => {
    resetSessionTablePreferences();
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
  }, [columnDefinitions, defaultColumnWidths, events, resetSessionTablePreferences]);

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
          <InspectDamageCentralTabSwitcher
            activeTab={centralTab}
            onTabChange={onCentralTabChange}
          />
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
                aria-hidden={centralTab !== 'table'}
                tabIndex={centralTab !== 'table' ? -1 : undefined}
                className={cn(
                  'min-w-[5.75rem] justify-center',
                  centralTab !== 'table' && 'invisible pointer-events-none',
                )}
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

      <CardContent
        className={
          centralTab === 'inspect'
            ? 'flex min-h-0 flex-1 flex-col overflow-hidden p-0'
            : 'min-h-0 flex-1 overflow-auto p-0'
        }
      >
        {centralTab === 'inspect' ? (
          inspectError ? (
            <div className="m-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {inspectError.message}
            </div>
          ) : (
            <DamagePlotView
              comparison={comparison}
              comparisonViewModel={comparisonViewModel}
              onUpdateComparison={onUpdateComparison}
            />
          )
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[400px] text-center">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Activity className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-sm font-medium text-foreground mb-1">
              No events selected
            </h3>
            <p className="text-xs text-muted-foreground max-w-[280px]">
              Select load data from the side panel to inspect persisted schedule damage.
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
