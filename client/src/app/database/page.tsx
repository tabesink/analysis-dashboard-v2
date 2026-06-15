'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FileSpreadsheet,
  Loader2,
  Trash2,
  Columns,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useUploadOperation } from '@/hooks/use-upload-operation';
import { damageApi, dashboardApi } from '@/lib/api';
import { useUploadedDatasets, useScopeDeleteOperation } from '@/hooks';
import { useEventCatalog } from '@/hooks/use-event-catalog';
import { ScopeDeleteOperationModal } from '@/features/database-scope-delete/ScopeDeleteOperationModal';
import { UploadOperationModal } from '@/features/database-upload/UploadOperationModal';
import { DatabaseChannelReprocessBanners } from '@/features/edit-metadata/DatabaseChannelReprocessBanners';
import { DatabaseDerivedDataOperationModals } from '@/features/edit-metadata/DatabaseDerivedDataOperationModals';
import { DamageTableView } from '@/features/inspect-damage/components/DamageTableView';
import { FilterableColumnHeader } from '@/components/database-table';
import { cn } from '@/lib/utils';
import {
  filterRowsByColumnFilters,
  MIN_COLUMN_PX,
  parseColumnLayoutPreferences,
  PROGRAM_ID_DEFAULT_PX,
  PROGRAM_ID_KEY,
  toggleSortField,
  updateColumnFilter,
  widthForValues,
  type SortDirection,
} from '@/lib/database-table/shared';
import {
  parseInspectDamageTablePreferences,
  serializeInspectDamageTablePreferences,
  type InspectDamageTablePreferences,
} from '@/lib/inspect-damage-table-preferences';
import { resolveInspectDamageViewState } from '@/features/inspect-damage/lib/inspect-damage-view-state';
import {
  DatabaseSidePanel,
  DatabaseEventTree,
  ColumnResizeHandle,
} from '@/components/upload';
import { MetadataEditDialog } from '@/components/edit-metadata';
import { DEFAULT_FILTER_OPTIONS } from '@/config/filters';
import type { DamageInspectResponse, EventMetadata, FilterOptions } from '@/types/api';
import type { DatasetInfo, UploadMetadata } from '@/types/upload';
import { selectCanWrite, useAuthStore } from '@/stores/auth-store';
import { isDamageCalculationActive } from '@/stores/damage-calculation-store';
import { useUIStore } from '@/stores/ui-store';

type FilterState = Record<string, string>;

const REQUIRED_UPLOAD_FIELDS = ['Program ID', 'Load Version', 'Job Number', 'Work Order'];

const channelMapBasename = (file: File): string => {
  const path = (file.webkitRelativePath || file.name).replace(/\\/g, '/');
  return (path.split('/').pop() ?? path).toLowerCase();
};

const isChannelMapFile = (file: File): boolean => {
  const baseName = channelMapBasename(file);
  return baseName === 'channel_map.yaml' || baseName === 'channel_map.yml';
};

const getDataFileExtension = (file: File): '.csv' | '.rsp' | null => {
  const filename = file.name.toLowerCase();
  if (filename.endsWith('.csv')) return '.csv';
  if (filename.endsWith('.rsp')) return '.rsp';
  return null;
};

const DYNAMIC_LABEL_OVERRIDES: Record<string, string> = {
  'FGAWR Range (lbs)': 'FGAWR (lbs)',
  'RGAWR Range (lbs)': 'RGAWR (lbs)',
};

type SortField = string;

const DATABASE_TABLE_PREFS_STORAGE_KEY = 'database_table_prefs_v1';
const DATABASE_DAMAGE_TABLE_PREFS_STORAGE_KEY = 'database_damage_table_prefs_v1';

type DatabaseCentralTab = 'datasets' | 'damage';

type DatabaseTablePreferences = {
  visibleColumns: Record<string, boolean>;
  columnWidths: Record<string, number>;
  updatedAt: string;
};

export default function DatabasePage() {
  const router = useRouter();
  // Query client for cache invalidation
  const queryClient = useQueryClient();
  const authStatus = useAuthStore((s) => s.status);
  const authUser = useAuthStore((s) => s.user);
  const isAdmin = authUser?.role === 'admin';
  const canWrite = useAuthStore(selectCanWrite);
  const folderUploadInProgress = useUIStore((s) => s.folderUploadInProgress);

  useEffect(() => {
    if (authStatus === 'unauthenticated' && !folderUploadInProgress) {
      router.replace('/login');
      return;
    }
    if (authStatus === 'authenticated' && !canWrite) {
      router.replace('/dashboard');
    }
  }, [authStatus, canWrite, folderUploadInProgress, router]);
  
  // Fetch filter options from server
  const [filterOptions, setFilterOptions] =
    useState<FilterOptions>(DEFAULT_FILTER_OPTIONS);

  useEffect(() => {
    dashboardApi
      .getFilterOptions()
      .then(setFilterOptions)
      .catch(() => {
        // Use defaults on error
      });
  }, []);

  // Use hooks for data management
  const {
    datasets: rawDatasets,
    isLoading: isDatasetsLoading,
    isRefreshing: isDatasetsRefreshing,
    refetch: refetchDatasets,
    deleteDatasets,
    isDeletingIds,
    total,
    facets,
    programVersions,
  } = useUploadedDatasets({
    onError: (error) => toast.error(error),
  });

  const datasets = rawDatasets;

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filters, setFilters] = useState<FilterState>({
    'Program ID': '',
    'Load Version': '',
    'Job Number': '',
    'Work Order': '',
    GVW: '',
    FGAWR: '',
    RGAWR: '',
    Status: 'Pending',
  });
  const [selectedDatasets, setSelectedDatasets] = useState<string[]>([]);

  const handleDeleteComplete = useCallback(async () => {
    setSelectedDatasets([]);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['program-ids'] }),
      queryClient.invalidateQueries({ queryKey: ['versions'] }),
      queryClient.invalidateQueries({ queryKey: ['filter-options'] }),
      queryClient.invalidateQueries({ queryKey: ['all-events'] }),
      queryClient.invalidateQueries({ queryKey: ['event-catalog'] }),
    ]);
    refetchDatasets();
    dashboardApi
      .getFilterOptions()
      .then(setFilterOptions)
      .catch(() => {
        // Keep existing options on failure
      });
  }, [queryClient, refetchDatasets]);

  const { openDeleteFlow, modalProps: scopeDeleteModalProps, isBusy: isScopeDeleteBusy } =
    useScopeDeleteOperation({
      programVersions,
      deleteDatasets,
      onComplete: handleDeleteComplete,
    });
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [sidePanelCollapsed, setSidePanelCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<DatabaseCentralTab>('datasets');
  const [damageTablePreferences, setDamageTablePreferences] = useState<
    Omit<InspectDamageTablePreferences, 'updatedAt'> | null
  >(null);
  const [damageTablePreferencesLoaded, setDamageTablePreferencesLoaded] = useState(false);
  const { events: catalogEvents, isLoading: isCatalogLoading } = useEventCatalog();

  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({
    suspension_component: [],
    axle_location: [],
    gross_vehicle_weight_range_lbs: [],
    drive_type: [],
    material_construction: [],
    steering_position: [],
    vehicle_type: [],
    status: [],
  });

  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    work_order: true,
    job_number: true,
    suspension_component: true,
    axle_location: true,
    gross_vehicle_weight_range_lbs: true,
    drive_type: true,
    material_construction: true,
    steering_position: true,
    vehicle_type: true,
    status: true,
  });
  const [storedTablePreferences, setStoredTablePreferences] =
    useState<DatabaseTablePreferences | null>(null);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [preferencesHydrated, setPreferencesHydrated] = useState(false);

  const staticColumnDefinitions = [
    { key: 'work_order', label: 'Work Order' },
    { key: 'job_number', label: 'Program ID' },
    { key: 'suspension_component', label: 'Component' },
    { key: 'axle_location', label: 'Axle Location' },
    { key: 'gross_vehicle_weight_range_lbs', label: 'GVW (lbs)' },
    { key: 'drive_type', label: 'Drive Type' },
    { key: 'material_construction', label: 'Material' },
    { key: 'steering_position', label: 'L/R' },
    { key: 'vehicle_type', label: 'Vehicle Type' },
  ] as const;
  const coveredMetadataColumns = useMemo(
    () =>
      new Set([
        'work_order',
        'job_number',
        'suspension_component',
        'axle_location',
        'gross_vehicle_weight_range_lbs',
        'drive_type',
        'material_construction',
        'steering_position',
        'vehicle_type',
        'status',
      ]),
    []
  );
  const dynamicMetadataColumns = useMemo(
    () =>
      Object.entries(filterOptions)
        .filter(([, config]) => config.source !== 'custom')
        .filter(([, config]) => !coveredMetadataColumns.has(config.column))
        .sort((a, b) => a[1].order - b[1].order)
        .map(([displayName, config]) => ({
          key: config.column,
          label: DYNAMIC_LABEL_OVERRIDES[displayName] ?? displayName,
        })),
    [coveredMetadataColumns, filterOptions]
  );
  const defaultHiddenMetadataColumns = useMemo(
    () => new Set(['rfq', 'dv', 'pv', 'post_prod']),
    []
  );
  const columnDefinitions = useMemo(
    () => [
      ...staticColumnDefinitions,
      ...dynamicMetadataColumns,
      { key: 'status', label: 'Status' },
    ],
    [dynamicMetadataColumns]
  );
  const toggleableColumnDefinitions = useMemo(
    () => columnDefinitions.filter((column) => column.key !== 'status'),
    [columnDefinitions]
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const stored = parseColumnLayoutPreferences(
      window.localStorage.getItem(DATABASE_TABLE_PREFS_STORAGE_KEY),
    );
    setStoredTablePreferences(stored);
    setPreferencesLoaded(true);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const raw = window.localStorage.getItem(DATABASE_DAMAGE_TABLE_PREFS_STORAGE_KEY);
    const parsed = parseInspectDamageTablePreferences(raw);
    if (parsed) {
      setDamageTablePreferences({
        visibleColumns: parsed.visibleColumns,
        columnWidths: parsed.columnWidths,
        expandedPrograms: parsed.expandedPrograms,
        expandedVersions: parsed.expandedVersions,
        sortField: parsed.sortField,
        sortDirection: parsed.sortDirection,
        columnFilters: parsed.columnFilters,
      });
    }
    setDamageTablePreferencesLoaded(true);
  }, []);

  useEffect(() => {
    if (dynamicMetadataColumns.length === 0 && !preferencesLoaded) {
      return;
    }
    const availableColumnKeys = new Set(columnDefinitions.map((column) => column.key));
    let didHydrateInThisRun = false;
    setColumnFilters((prev) => {
      const next = { ...prev };
      let changed = false;
      dynamicMetadataColumns.forEach((column) => {
        if (!next[column.key]) {
          next[column.key] = [];
          changed = true;
        }
      });
      return changed ? next : prev;
    });
    setVisibleColumns((prev) => {
      const next: Record<string, boolean> = {};
      columnDefinitions.forEach((column) => {
        if (preferencesHydrated && column.key in prev) {
          next[column.key] = prev[column.key];
          return;
        }
        if (storedTablePreferences?.visibleColumns[column.key] !== undefined) {
          next[column.key] = storedTablePreferences.visibleColumns[column.key];
          return;
        }
        next[column.key] =
          column.key === 'status' || !defaultHiddenMetadataColumns.has(column.key);
      });
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
    setStoredTablePreferences((prev) => {
      if (!prev) {
        return prev;
      }
      const prunedVisibleColumns = Object.fromEntries(
        Object.entries(prev.visibleColumns).filter(([key]) =>
          availableColumnKeys.has(key),
        ),
      );
      const prunedColumnWidths = Object.fromEntries(
        Object.entries(prev.columnWidths).filter(
          ([key]) => key === PROGRAM_ID_KEY || availableColumnKeys.has(key),
        ),
      );
      const visibleUnchanged =
        Object.keys(prunedVisibleColumns).length ===
          Object.keys(prev.visibleColumns).length &&
        Object.entries(prunedVisibleColumns).every(
          ([key, value]) => prev.visibleColumns[key] === value,
        );
      const widthsUnchanged =
        Object.keys(prunedColumnWidths).length ===
          Object.keys(prev.columnWidths).length &&
        Object.entries(prunedColumnWidths).every(
          ([key, value]) => prev.columnWidths[key] === value,
        );
      if (visibleUnchanged && widthsUnchanged) {
        return prev;
      }
      return {
        ...prev,
        visibleColumns: prunedVisibleColumns,
        columnWidths: prunedColumnWidths,
      };
    });
  }, [
    columnDefinitions,
    defaultHiddenMetadataColumns,
    dynamicMetadataColumns,
    preferencesHydrated,
    preferencesLoaded,
    storedTablePreferences,
  ]);

  const getColumnValue = useCallback((dataset: DatasetInfo, columnKey: string): string => {
    const value = (dataset as unknown as Record<string, unknown>)[columnKey];
    if (typeof value === 'boolean') {
      return value ? 'Applicable' : 'Not Applicable';
    }
    return typeof value === 'string' ? value : '';
  }, []);

  const handleColumnVisibilityToggle = (columnKey: string, checked: boolean) => {
    if (columnKey === 'status') {
      return;
    }
    const currentVisibleCount = Object.values(visibleColumns).filter(Boolean).length;
    
    // Prevent unchecking if it would leave no columns visible
    if (!checked && currentVisibleCount <= 1) {
      toast.error('At least one column must be visible');
      return;
    }
    
    setVisibleColumns((prev) => ({ ...prev, [columnKey]: checked }));
  };

  const clearFilters = useCallback(() => {
    setFilters({
      'Program ID': '',
      'Load Version': '',
      'Job Number': '',
      'Work Order': '',
      GVW: '',
      FGAWR: '',
      RGAWR: '',
      Status: 'Pending',
    });
  }, []);

  const { startUpload, modalProps: uploadModalProps, isBusy: isUploadBusy } = useUploadOperation({
    onComplete: async () => {
      setSelectedFiles([]);
      clearFilters();
      await refetchDatasets();
      queryClient.invalidateQueries({ queryKey: ['all-events'] });
      queryClient.invalidateQueries({ queryKey: ['program-ids'] });
      queryClient.invalidateQueries({ queryKey: ['versions'] });
      queryClient.invalidateQueries({ queryKey: ['filter-options'] });
      queryClient.invalidateQueries({ queryKey: ['event-catalog'] });
    },
  });

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    const programId = filters['Program ID'];
    const version = filters['Load Version'];
    const jobNumber = filters['Job Number'];
    const workOrder = filters['Work Order'];
    const statusValue = filters['Status'];

    // Validate mandatory fields
    if (!programId) {
      toast.error('Please enter a Job ID');
      return;
    }
    if (!version) {
      toast.error('Please enter a Load Version');
      return;
    }
    if (!jobNumber) {
      toast.error('Please enter a Program ID');
      return;
    }
    if (!workOrder) {
      toast.error('Please enter a Work Order');
      return;
    }

    const channelMapFile = selectedFiles.find(isChannelMapFile);

    const dataFiles = selectedFiles.filter((file) => getDataFileExtension(file) !== null);

    if (dataFiles.length === 0) {
      toast.error('No CSV or RSP files found');
      return;
    }

    const dataExtensions = new Set(dataFiles.map(getDataFileExtension));
    if (dataExtensions.size > 1) {
      toast.error('Upload either CSV files or RSP files, not both');
      return;
    }

    const ignoredCount = selectedFiles.filter(
      (file) => getDataFileExtension(file) === null && !isChannelMapFile(file),
    ).length;
    if (ignoredCount > 0) {
      toast.info(`${ignoredCount} unrelated file${ignoredCount === 1 ? '' : 's'} will be ignored`);
    }

    const metadataPayload: UploadMetadata = {
      program_id: programId,
      version,
      job_number: jobNumber,
      work_order: workOrder,
    };
    const optionalFieldMap = {
      'Suspension Component': 'suspension_component',
      'Axle Location': 'axle_location',
      GVW: 'gvw',
      FGAWR: 'fgawr',
      RGAWR: 'rgawr',
      'Drive Type': 'drive_type',
      "Mat'l & Const": 'material_construction',
      Material: 'material_construction',
      Steering: 'steering_position',
      'Steering Position': 'steering_position',
      'Damper Type': 'damper_type',
      'Vehicle Type': 'vehicle_type',
    } as const;
    Object.entries(optionalFieldMap).forEach(([displayName, metadataKey]) => {
      const value = filters[displayName]?.trim();
      if (value) {
        metadataPayload[metadataKey] = value;
      }
    });
    if (isAdmin && statusValue?.trim()) {
      metadataPayload.status = statusValue.trim();
    }

    await startUpload(dataFiles, channelMapFile, {
      ...metadataPayload,
    });
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const hasActiveFilters = () => {
    return Object.entries(filters).some(([key, value]) =>
      key === 'Status' ? value !== '' && value !== 'Pending' : value !== ''
    );
  };

  // Count missing required fields for upload validation
  const missingFieldsCount = useMemo(() => {
    return REQUIRED_UPLOAD_FIELDS.filter((field) => !filters[field]).length;
  }, [filters]);

  const handleSort = (field: SortField) => {
    const next = toggleSortField(sortField, sortDirection, field, 'desc');
    setSortField(next.sortField);
    setSortDirection(next.sortDirection);
  };

  const getUniqueValues = useMemo(() => {
    const uniqueValues: Record<string, string[]> = {};
    columnDefinitions.forEach((column) => {
      if (facets[column.key]) {
        uniqueValues[column.key] = facets[column.key];
      } else {
        const values = new Set<string>();
        datasets.forEach((ds) => {
          const value = getColumnValue(ds, column.key);
          if (value && value !== '') values.add(value);
        });
        uniqueValues[column.key] = Array.from(values).sort();
      }
    });
    return uniqueValues;
  }, [columnDefinitions, datasets, facets, getColumnValue]);

  const filteredDatasets = useMemo(
    () => filterRowsByColumnFilters(datasets, columnFilters, getColumnValue),
    [columnFilters, datasets, getColumnValue],
  );

  const sortedDatasets = useMemo(() => {
    return [...filteredDatasets].sort((a, b) => {
      let valueA: string | number;
      let valueB: string | number;

      if (sortField === 'created_at') {
        valueA = a.created_at ? new Date(a.created_at).getTime() : 0;
        valueB = b.created_at ? new Date(b.created_at).getTime() : 0;
      } else {
        valueA = getColumnValue(a, sortField);
        valueB = getColumnValue(b, sortField);
      }

      const sortMultiplier = sortDirection === 'asc' ? 1 : -1;
      if (typeof valueA === 'string' && typeof valueB === 'string') {
        return sortMultiplier * valueA.localeCompare(valueB);
      }
      return sortMultiplier * (valueA > valueB ? 1 : valueA < valueB ? -1 : 0);
    });
  }, [filteredDatasets, getColumnValue, sortField, sortDirection]);

  const handleColumnFilterChange = (
    column: string,
    value: string,
    checked: boolean,
  ) => {
    setColumnFilters((prev) => updateColumnFilter(prev, column, value, checked));
  };

  const clearAllColumnFilters = () => {
    setColumnFilters((prev) => {
      const next: Record<string, string[]> = {};
      Object.keys(prev).forEach((key) => {
        next[key] = [];
      });
      return next;
    });
  };

  const handleBatchSelect = (eventIds: string[], checked: boolean) => {
    setSelectedDatasets((prev) => {
      const prevSet = new Set(prev);
      if (checked) {
        eventIds.forEach((id) => prevSet.add(id));
      } else {
        eventIds.forEach((id) => prevSet.delete(id));
      }
      return [...prevSet];
    });
  };

  const handleDeleteSelected = () => {
    if (!authUser) return;
    if (selectedDatasets.length === 0) {
      toast.error('No datasets selected');
      return;
    }
    openDeleteFlow(selectedDatasets);
  };

  const isDeleteBusy = isScopeDeleteBusy || isDeletingIds.length > 0;

  const visibleColumnDefs = useMemo(
    () => columnDefinitions.filter((col) => visibleColumns[col.key]),
    [columnDefinitions, visibleColumns],
  );

  // Pixel widths per column. Seeded from the longest known value in
  // filterOptions and persisted in browser-local preferences.
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const defaultColumnWidths = useMemo(() => {
    const next: Record<string, number> = {
      [PROGRAM_ID_KEY]: PROGRAM_ID_DEFAULT_PX,
    };
    for (const col of columnDefinitions) {
      const entry = Object.values(filterOptions).find((o) => o.column === col.key);
      next[col.key] = widthForValues(col.label, entry?.values ?? []);
    }
    return next;
  }, [columnDefinitions, filterOptions]);

  useEffect(() => {
    if (!preferencesLoaded) {
      return;
    }
    setColumnWidths((prev) => {
      const next: Record<string, number> = {};
      next[PROGRAM_ID_KEY] =
        prev[PROGRAM_ID_KEY] ??
        storedTablePreferences?.columnWidths[PROGRAM_ID_KEY] ??
        defaultColumnWidths[PROGRAM_ID_KEY];
      for (const col of columnDefinitions) {
        const existing = preferencesHydrated ? prev[col.key] : undefined;
        const stored = storedTablePreferences?.columnWidths[col.key];
        const fallback = defaultColumnWidths[col.key];
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
    storedTablePreferences,
  ]);

  const setColumnWidth = useCallback((key: string, next: number) => {
    setColumnWidths((prev) =>
      prev[key] === next ? prev : { ...prev, [key]: next },
    );
  }, []);

  const resetTablePreferences = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(DATABASE_TABLE_PREFS_STORAGE_KEY);
    }
    setStoredTablePreferences(null);
    setVisibleColumns(() => {
      const next: Record<string, boolean> = {};
      columnDefinitions.forEach((column) => {
        next[column.key] =
          column.key === 'status' || !defaultHiddenMetadataColumns.has(column.key);
      });
      return next;
    });
    setColumnWidths(defaultColumnWidths);
    setPreferencesHydrated(true);
  }, [columnDefinitions, defaultColumnWidths, defaultHiddenMetadataColumns]);

  useEffect(() => {
    if (!preferencesHydrated || typeof window === 'undefined') {
      return;
    }
    const payload: DatabaseTablePreferences = {
      visibleColumns,
      columnWidths,
      updatedAt: new Date().toISOString(),
    };
    try {
      window.localStorage.setItem(
        DATABASE_TABLE_PREFS_STORAGE_KEY,
        JSON.stringify(payload),
      );
      setStoredTablePreferences(payload);
    } catch {
      // Keep table usable if storage is blocked or full.
    }
  }, [columnWidths, preferencesHydrated, visibleColumns]);

  const setPersistedDamageTablePreferences = useCallback(
    (payload: Omit<InspectDamageTablePreferences, 'updatedAt'>) => {
      setDamageTablePreferences(payload);
      if (typeof window === 'undefined') return;
      try {
        window.localStorage.setItem(
          DATABASE_DAMAGE_TABLE_PREFS_STORAGE_KEY,
          serializeInspectDamageTablePreferences({
            ...payload,
            updatedAt: new Date().toISOString(),
          }),
        );
      } catch {
        // Keep table usable if storage is blocked or full.
      }
    },
    [],
  );

  const resetPersistedDamageTablePreferences = useCallback(() => {
    setDamageTablePreferences(null);
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(DATABASE_DAMAGE_TABLE_PREFS_STORAGE_KEY);
  }, []);

  const {
    data: damageResponse = null,
    isLoading: isDamageInspectLoading,
    isFetching: isDamageInspectFetching,
    error: damageInspectError,
  } = useQuery({
    queryKey: ['damage-inspect', 'all-calculated'],
    queryFn: () => damageApi.inspectCalculated(),
    refetchInterval: (query) => {
      const data = query.state.data as DamageInspectResponse | undefined;
      if (!data) return false;
      const hasRunningScope = (data.scopes ?? []).some((scope) =>
        isDamageCalculationActive({ programId: scope.program_id, version: scope.version }),
      );
      return hasRunningScope ? 2000 : false;
    },
  });
  const runningDamageScopes = useMemo(
    () =>
      (damageResponse?.scopes ?? []).filter((scope) =>
        isDamageCalculationActive({ programId: scope.program_id, version: scope.version }),
      ),
    [damageResponse?.scopes],
  );
  const damageViewState = useMemo(
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
  const damageChannelMetadata = useMemo(() => {
    const map = new Map<string, DamageInspectResponse['channels'][number]>();
    for (const channel of damageResponse?.channels ?? []) {
      map.set(channel.channel_key, channel);
    }
    return map;
  }, [damageResponse]);
  const allDamageEvents = useMemo<EventMetadata[]>(() => {
    const byId = new Map(catalogEvents.map((event) => [event.event_id, event]));
    const orderedEvents: EventMetadata[] = [];
    for (const row of damageResponse?.rows ?? []) {
      const event = byId.get(row.event_id);
      if (event) orderedEvents.push(event);
    }
    return orderedEvents;
  }, [catalogEvents, damageResponse?.rows]);
  const isDamageTableLoading =
    isDamageInspectLoading || isDamageInspectFetching || isCatalogLoading;

  const dataColumnsTotalWidth = useMemo(
    () =>
      visibleColumnDefs.reduce(
        (sum, col) => sum + (columnWidths[col.key] ?? MIN_COLUMN_PX),
        0,
      ),
    [visibleColumnDefs, columnWidths],
  );
  const programIdWidth = columnWidths[PROGRAM_ID_KEY] ?? PROGRAM_ID_DEFAULT_PX;
  const totalRowWidth = programIdWidth + dataColumnsTotalWidth;

  if (authStatus === 'loading' || authStatus === 'idle') {
    return <div className="flex-1 p-4">Loading...</div>;
  }

  return (
    <div className="flex-1 p-4 min-h-[calc(100vh-3.5rem)]">
      <DatabaseChannelReprocessBanners />
      <div className="flex gap-0 h-[calc(100vh-7rem)]">

        {/* Side Panel */}
        <DatabaseSidePanel
          isCollapsed={sidePanelCollapsed}
          onToggleCollapse={() => setSidePanelCollapsed(!sidePanelCollapsed)}
          uploadDataProps={{
            selectedFiles,
            onFilesChange: setSelectedFiles,
            isUploading: isUploadBusy,
            onUpload: handleUpload,
            filters,
            onFilterChange: (key: string, value: string) => handleFilterChange(key, value),
            filterOptions,
            isAdmin,
            hasActiveFilters: hasActiveFilters(),
            onClearFilters: clearFilters,
            missingFieldsCount,
          }}
        />

        {/* Right Panel - Data Table */}
        <div className="flex-1 min-w-0 min-h-0">
          <Card className="h-full rounded-r-lg rounded-l-none flex flex-col gap-0 overflow-hidden shadow-subtle border py-0">
            <div className="shrink-0 flex items-center justify-between border-b px-4 py-3">
              <div className="flex min-h-9 items-center gap-2">
                <div
                  role="tablist"
                  aria-label="Database table views"
                  className="inline-flex items-center rounded-md bg-muted/70 p-0.5"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'datasets'}
                    onClick={() => setActiveTab('datasets')}
                    className={cn(
                      'text-sm font-medium rounded-sm px-2.5 py-0.5 transition-colors',
                      activeTab === 'datasets'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    Datasets
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'damage'}
                    onClick={() => setActiveTab('damage')}
                    className={cn(
                      'text-sm font-medium rounded-sm px-2.5 py-0.5 transition-colors',
                      activeTab === 'damage'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    Damage Table
                  </button>
                </div>
                {activeTab === 'datasets' && isDatasetsRefreshing && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Refreshing datasets...
                  </div>
                )}
              </div>
              {activeTab === 'datasets' ? (
                <div className="flex items-center gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        aria-label="Column visibility"
                        className="min-w-[5.75rem] justify-center"
                      >
                        <Columns className="size-4" />
                        Cols
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-3" align="end">
                      <div className="space-y-3">
                        <div className="text-xs font-semibold">Column Visibility</div>
                        <div className="space-y-2 bg-muted/70 rounded-md p-2">
                          {toggleableColumnDefinitions.map((col) => {
                            const isChecked = visibleColumns[col.key];
                            const isDisabled = false;

                            return (
                              <div
                                key={col.key}
                                className="flex items-center space-x-2"
                              >
                                <Checkbox
                                  id={col.key}
                                  checked={isChecked}
                                  onCheckedChange={(checked) =>
                                    handleColumnVisibilityToggle(col.key, checked as boolean)
                                  }
                                  disabled={isDisabled}
                                  className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                />
                                <label
                                  htmlFor={col.key}
                                  className={`text-xs cursor-pointer flex-1 ${
                                    isDisabled ? 'text-muted-foreground opacity-50' : ''
                                  }`}
                                >
                                  {col.label}
                                </label>
                              </div>
                            );
                          })}
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
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleDeleteSelected}
                    disabled={selectedDatasets.length === 0 || isDeleteBusy}
                    className={cn(
                      'min-w-[5.75rem] justify-center',
                      selectedDatasets.length > 0 &&
                        'text-destructive border-destructive/30 hover:bg-destructive/10',
                    )}
                  >
                    {isDeleteBusy ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="size-4" />
                        Delete
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="min-h-9" />
              )}
            </div>
            {activeTab === 'datasets' ? (
              <CardContent className="flex-1 min-h-0 overflow-auto p-0">
                {programVersions.length > 0 ? (
                  <div style={{ minWidth: totalRowWidth }}>
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
                        {visibleColumnDefs.map((col) => (
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
                      </div>
                    </div>
                    <DatabaseEventTree
                      datasets={sortedDatasets}
                      programVersions={programVersions}
                      selectedDatasets={selectedDatasets}
                      onBatchSelect={handleBatchSelect}
                      isDeletingIds={isDeletingIds}
                      columnDefinitions={visibleColumnDefs}
                      getColumnValue={getColumnValue}
                      columnWidths={columnWidths}
                      programIdWidth={programIdWidth}
                    />
                  </div>
                ) : isDatasetsLoading ? (
                  <div className="flex flex-col items-center justify-center h-[400px] text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
                    <p className="text-xs text-muted-foreground">
                      Refreshing datasets...
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[400px] text-center">
                    <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                      <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-sm font-medium text-foreground mb-1">
                      No datasets yet
                    </h3>
                    <p className="text-xs text-muted-foreground max-w-[280px]">
                      Upload CSV or RSP files with a
                      channel_map.yaml to get started.
                    </p>
                  </div>
                )}
              </CardContent>
            ) : (
              <DamageTableView
                title="Damage Table"
                events={allDamageEvents}
                damageRowsByEventId={damageRowsByEventId}
                channelMetadata={damageChannelMetadata}
                isLoading={isDamageTableLoading}
                inspectError={damageInspectError}
                viewState={damageViewState}
                isCalculatingDamage={runningDamageScopes.length > 0}
                preferencesLoaded={damageTablePreferencesLoaded}
                tablePreferences={damageTablePreferences}
                onSetTablePreferences={setPersistedDamageTablePreferences}
                onResetTablePreferences={resetPersistedDamageTablePreferences}
                emptyStateTitle="No calculated damage available"
                emptyStateDescription="Run a damage calculation to populate the table with all program/version results."
              />
            )}
          </Card>
        </div>
      </div>
      <ScopeDeleteOperationModal {...scopeDeleteModalProps} />
      <UploadOperationModal {...uploadModalProps} />
      <DatabaseDerivedDataOperationModals />
      <MetadataEditDialog />
    </div>
  );
}
