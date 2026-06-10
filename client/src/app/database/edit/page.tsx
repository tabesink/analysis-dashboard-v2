'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertCircle,
  Clipboard,
  ClipboardPaste,
  Info,
  Loader2,
  RotateCcw,
  RotateCw,
  Save,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { selectCanWrite, useAuthStore } from '@/stores/auth-store';
import { useFilterOptions } from '@/hooks/use-filter-options';
import type { ChannelMapEditorEntry, EventMetadata, FilterOptions } from '@/types/api';
import { dashboardApi } from '@/lib/api';
import { invalidateQueriesAfterMetadataSave } from '@/lib/metadata-save-cache';
import { getPlotDisplayTitle } from '@/config/constants';
import { EditMetadataSidePanel, DurabilityScheduleTable } from '@/components/edit-metadata';
import { CsvPreviewTable } from '@/components/upload/CsvPreviewTable';
import {
  EXCLUDED_METADATA_COLUMNS,
  isStatusField,
  PHASE_FIELDS,
  RAW_WEIGHT_FIELDS,
  type SelectionMetadata,
} from '@/features/edit-metadata';
import {
  buildDurabilityScheduleRows,
  discoverEventDelimiter,
  rowsFromSavedEventRows,
  rowsToSavePayload,
  type DurabilityScheduleRow,
} from '@/features/edit-metadata/lib/build-durability-schedule-rows';
import type { DurabilityScheduleEditableField } from '@/components/edit-metadata/DurabilityScheduleTable';
import { APIError } from '@/lib/api';

type MetadataDraftValues = Record<string, string>;
type PhaseDraftValues = {
  rfq: boolean;
  dv: boolean;
  pv: boolean;
  post_prod: boolean;
};

const FIXED_CHANNEL_MAP_PLOTS = [
  'bj_xy_force_plot',
  'bj_xz_force_plot',
  'shock_xy_force_plot',
  'shock_xz_force_plot',
  'bushing_f_xy_force_plot',
  'bushing_f_xz_force_plot',
  'bushing_r_xy_force_plot',
  'bushing_r_xz_force_plot',
] as const;

const DEFAULT_CHANNEL_MAP_DRAFT: Record<string, { x_col: string; y_col: string }> =
  Object.fromEntries(FIXED_CHANNEL_MAP_PLOTS.map((plotKey) => [plotKey, { x_col: '', y_col: '' }]));

const CHANNEL_MAP_DATA_ROW_COUNT = 12;
const CHANNEL_MAP_PADDING_ROW_COUNT = CHANNEL_MAP_DATA_ROW_COUNT - FIXED_CHANNEL_MAP_PLOTS.length;
const CHANNEL_MAP_TABLE_HEIGHT_PX = 28 + 32 + CHANNEL_MAP_DATA_ROW_COUNT * 32;
const CHANNEL_MAP_PREVIEW_FALLBACK_COLUMN_COUNT = 26;

function toTimestamp(value: string | undefined | null): number {
  if (!value) {
    return 0;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function toClearedDraftValues(options: FilterOptions): MetadataDraftValues {
  const nextDrafts: MetadataDraftValues = {};
  for (const [displayName] of Object.entries(options)) {
    nextDrafts[displayName] = '';
  }
  for (const field of RAW_WEIGHT_FIELDS) {
    nextDrafts[field.label] = '';
  }
  return nextDrafts;
}

function toClearedPhaseDraftValues(): PhaseDraftValues {
  return {
    rfq: false,
    dv: false,
    pv: false,
    post_prod: false,
  };
}

function buildProgramVersionDraftValues(
  options: FilterOptions,
  events: EventMetadata[]
): { draft: MetadataDraftValues; baseline: MetadataDraftValues } {
  const draft: MetadataDraftValues = {};
  const baseline: MetadataDraftValues = {};

  const resolveField = (key: string, rawValues: (string | null | undefined)[]) => {
    const values = new Set<string>();
    let hasEmpty = false;
    for (const raw of rawValues) {
      const normalized = typeof raw === 'string' ? raw.trim() : '';
      if (normalized) {
        values.add(normalized);
      } else {
        hasEmpty = true;
      }
    }
    if (values.size === 1 && !hasEmpty) {
      draft[key] = Array.from(values)[0];
      baseline[key] = Array.from(values)[0];
      return;
    }
    if (values.size === 1 && hasEmpty) {
      // Some events have the value, others are null. Show the value so the
      // user sees it, but keep baseline empty so clicking Save propagates
      // the value to the null events.
      draft[key] = Array.from(values)[0];
      baseline[key] = '';
      return;
    }
    draft[key] = '';
    baseline[key] = '';
  };

  for (const [displayName, config] of Object.entries(options)) {
    if (EXCLUDED_METADATA_COLUMNS.has(config.column)) {
      continue;
    }
    resolveField(
      displayName,
      events.map((event) => event[config.column as keyof EventMetadata] as string | null | undefined)
    );
  }
  for (const field of RAW_WEIGHT_FIELDS) {
    resolveField(
      field.label,
      events.map((event) => event[field.key as keyof EventMetadata] as string | null | undefined)
    );
  }

  return { draft, baseline };
}

function buildProgramVersionPhaseDraftValues(events: EventMetadata[]): PhaseDraftValues {
  const fieldValues: PhaseDraftValues = toClearedPhaseDraftValues();
  for (const field of PHASE_FIELDS) {
    const allTrue = events.every((event) => Boolean(event[field.key as keyof EventMetadata]));
    fieldValues[field.key] = allTrue;
  }
  return fieldValues;
}

// REF-12-10: rename default export to EditMetadataPage (route stays /database/edit).
export default function FilterValuesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const authStatus = useAuthStore((s) => s.status);
  const authUser = useAuthStore((s) => s.user);
  const canWrite = useAuthStore(selectCanWrite);
  const { data: serverOptions, isLoading } = useFilterOptions();
  const [draftValues, setDraftValues] = useState<MetadataDraftValues>({});
  const [baselineDraftValues, setBaselineDraftValues] = useState<MetadataDraftValues>(
    {}
  );
  const [phaseDraftValues, setPhaseDraftValues] = useState<PhaseDraftValues>(
    toClearedPhaseDraftValues()
  );
  const [baselinePhaseDraftValues, setBaselinePhaseDraftValues] =
    useState<PhaseDraftValues>(toClearedPhaseDraftValues());
  const [dirtyFields, setDirtyFields] = useState<Set<string>>(new Set());
  const [dirtyPhases, setDirtyPhases] = useState<Set<keyof PhaseDraftValues>>(
    new Set(),
  );
  const [preResetSnapshot, setPreResetSnapshot] = useState<{
    values: MetadataDraftValues;
    phases: PhaseDraftValues;
    dirtyFields: Set<string>;
    dirtyPhases: Set<keyof PhaseDraftValues>;
  } | null>(null);
  const [copyClipboard, setCopyClipboard] = useState<MetadataDraftValues | null>(
    null,
  );
  const [selectedProgramId, setSelectedProgramId] = useState('');
  const [selectedVersion, setSelectedVersion] = useState('');
  const [sidePanelCollapsed, setSidePanelCollapsed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingChannelMap, setIsSavingChannelMap] = useState(false);
  const [isExtractingSchedule, setIsExtractingSchedule] = useState(false);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [scheduleUploadKey, setScheduleUploadKey] = useState(0);
  const [scheduleDraftRows, setScheduleDraftRows] = useState<DurabilityScheduleRow[]>([]);
  const [baselineScheduleRows, setBaselineScheduleRows] = useState<DurabilityScheduleRow[]>([]);
  const [scheduleDraftMultiplier, setScheduleDraftMultiplier] = useState<number | null>(null);
  const [baselineScheduleMultiplier, setBaselineScheduleMultiplier] = useState<number | null>(null);
  const [scheduleDelimiterToken, setScheduleDelimiterToken] = useState<string | null>(null);
  const [baselineScheduleDelimiterToken, setBaselineScheduleDelimiterToken] =
    useState<string | null>(null);
  const scheduleInitKeyRef = useRef<string | null>(null);
  const scheduleRowsHydratedRef = useRef(false);
  const [channelMapDraft, setChannelMapDraft] = useState(DEFAULT_CHANNEL_MAP_DRAFT);
  const [selectedEventMetadata, setSelectedEventMetadata] =
    useState<SelectionMetadata | null>(null);
  const lastInitKeyRef = useRef<string | null>(null);
  const dirtyFieldsRef = useRef<Set<string>>(new Set());
  const dirtyPhasesRef = useRef<Set<keyof PhaseDraftValues>>(new Set());
  const isAdmin = authUser?.role === 'admin';

  const { data: programIdsData, isLoading: isProgramIdsLoading } = useQuery({
    queryKey: ['program-ids'],
    queryFn: () => dashboardApi.getProgramIds(),
  });

  const { data: versionsData, isLoading: isVersionsLoading } = useQuery({
    queryKey: ['versions', selectedProgramId],
    queryFn: () => dashboardApi.getVersions(selectedProgramId),
    enabled: Boolean(selectedProgramId),
  });

  const programIds = programIdsData?.program_ids ?? [];
  const versions = versionsData?.versions ?? [];

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.replace('/login');
      return;
    }
    if (authStatus === 'authenticated' && !canWrite) {
      router.replace('/dashboard');
    }
  }, [authStatus, canWrite, router]);

  const sortedOptions = useMemo(() => {
    if (!serverOptions) {
      return [];
    }

    return Object.entries(serverOptions).sort(
      (a, b) => a[1].order - b[1].order
    );
  }, [serverOptions]);
  const metadataOptions = useMemo(
    () =>
      sortedOptions.filter(
        ([, config]) =>
          config.source !== 'custom' && !EXCLUDED_METADATA_COLUMNS.has(config.column)
      ),
    [sortedOptions]
  );

  useEffect(() => {
    if (!serverOptions) {
      return;
    }

    const addMissingKeys = (prev: MetadataDraftValues): MetadataDraftValues => {
      const next = { ...prev };
      let changed = false;
      for (const displayName of Object.keys(serverOptions)) {
        if (!(displayName in next)) {
          next[displayName] = '';
          changed = true;
        }
      }
      for (const field of RAW_WEIGHT_FIELDS) {
        if (!(field.label in next)) {
          next[field.label] = '';
          changed = true;
        }
      }
      return changed ? next : prev;
    };

    setDraftValues(addMissingKeys);
    setBaselineDraftValues(addMissingKeys);
  }, [serverOptions]);

  const eventsQuery = useQuery({
    queryKey: ['program-version-events', selectedProgramId, selectedVersion],
    queryFn: () =>
      dashboardApi.getEvents(
        {
          program_ids: [selectedProgramId],
          versions: [selectedVersion],
          global_filters: {},
        },
        500,
      ),
    enabled: Boolean(selectedProgramId && selectedVersion && serverOptions),
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  const channelMapQuery = useQuery({
    queryKey: ['channel-map-editor', selectedProgramId, selectedVersion],
    queryFn: () => dashboardApi.getChannelMapEditor(selectedProgramId, selectedVersion),
    enabled: Boolean(selectedProgramId && selectedVersion),
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  const scheduleQuery = useQuery({
    queryKey: ['program-version-schedule', selectedProgramId, selectedVersion],
    queryFn: async () => {
      try {
        return await dashboardApi.getProgramVersionSchedule(selectedProgramId, selectedVersion);
      } catch (error) {
        if (error instanceof APIError && error.status === 404) {
          return null;
        }
        throw error;
      }
    },
    enabled: Boolean(selectedProgramId && selectedVersion),
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  const hasAttachedSchedule = scheduleQuery.data != null;

  const isDurabilityScheduleLoading =
    scheduleQuery.isLoading || (hasAttachedSchedule && eventsQuery.isLoading);

  const isScheduleDirty = useMemo(() => {
    if (scheduleDraftMultiplier !== baselineScheduleMultiplier) {
      return true;
    }
    return JSON.stringify(scheduleDraftRows) !== JSON.stringify(baselineScheduleRows);
  }, [
    scheduleDraftRows,
    baselineScheduleRows,
    scheduleDraftMultiplier,
    baselineScheduleMultiplier,
  ]);

  const isPrefillLoading = eventsQuery.isFetching;

  useEffect(() => {
    dirtyFieldsRef.current = dirtyFields;
  }, [dirtyFields]);

  useEffect(() => {
    dirtyPhasesRef.current = dirtyPhases;
  }, [dirtyPhases]);

  useEffect(() => {
    if (!selectedProgramId || !selectedVersion || !serverOptions) {
      if (serverOptions) {
        const clearedDraft = toClearedDraftValues(serverOptions);
        setDraftValues(clearedDraft);
        setBaselineDraftValues(clearedDraft);
        const clearedPhases = toClearedPhaseDraftValues();
        setPhaseDraftValues(clearedPhases);
        setBaselinePhaseDraftValues(clearedPhases);
      }
      setPreResetSnapshot(null);
      setDirtyFields(new Set());
      setDirtyPhases(new Set());
      setSelectedEventMetadata(null);
      lastInitKeyRef.current = null;
    }
  }, [selectedProgramId, selectedVersion, serverOptions]);

  useEffect(() => {
    if (eventsQuery.error) {
      const message =
        eventsQuery.error instanceof Error
          ? eventsQuery.error.message
          : 'Failed to prefill filter values for the selected program/version';
      toast.error(message);
      setSelectedEventMetadata(null);
    }
  }, [eventsQuery.error]);

  useEffect(() => {
    if (!selectedProgramId || !selectedVersion) {
      setScheduleDraftRows([]);
      setBaselineScheduleRows([]);
      setScheduleDraftMultiplier(null);
      setBaselineScheduleMultiplier(null);
      setScheduleDelimiterToken(null);
      setBaselineScheduleDelimiterToken(null);
      scheduleInitKeyRef.current = null;
      scheduleRowsHydratedRef.current = false;
      return;
    }

    if (!hasAttachedSchedule || !scheduleQuery.data) {
      return;
    }

    const savedRowsOnServer = scheduleQuery.data.parse_preview.event_rows ?? [];
    if (eventsQuery.isLoading && savedRowsOnServer.length === 0) {
      return;
    }

    const scheduleKey = `${selectedProgramId}::${selectedVersion}::${scheduleQuery.data.schedule_id}`;
    const isFreshSchedule = scheduleInitKeyRef.current !== scheduleKey;
    const savedRows = savedRowsOnServer;
    const multiplier = scheduleQuery.data.parse_preview.multiplier ?? null;
    let delimiter = scheduleQuery.data.parse_preview.delimiter_token ?? null;

    const buildRows = (): DurabilityScheduleRow[] => {
      if (savedRows.length > 0) {
        return rowsFromSavedEventRows(savedRows);
      }
      const events = eventsQuery.data?.events ?? [];
      const entries = scheduleQuery.data.parse_preview.entries ?? [];
      delimiter = discoverEventDelimiter(
        events
          .map((event) => event.source_file?.trim())
          .filter((sourceFile): sourceFile is string => Boolean(sourceFile)),
      );
      return buildDurabilityScheduleRows(events, entries);
    };

    if (isFreshSchedule) {
      const rows = buildRows();
      setScheduleDraftRows(rows);
      setBaselineScheduleRows(rows);
      setScheduleDraftMultiplier(multiplier);
      setBaselineScheduleMultiplier(multiplier);
      setScheduleDelimiterToken(delimiter);
      setBaselineScheduleDelimiterToken(delimiter);
      scheduleInitKeyRef.current = scheduleKey;
      scheduleRowsHydratedRef.current = rows.length > 0;
      return;
    }

    if (savedRows.length === 0 && !scheduleRowsHydratedRef.current && eventsQuery.data) {
      const rows = buildRows();
      setScheduleDraftRows(rows);
      setBaselineScheduleRows(rows);
      setScheduleDelimiterToken(delimiter);
      setBaselineScheduleDelimiterToken(delimiter);
      scheduleRowsHydratedRef.current = rows.length > 0;
    }
  }, [
    selectedProgramId,
    selectedVersion,
    hasAttachedSchedule,
    scheduleQuery.data,
    eventsQuery.data,
    eventsQuery.isLoading,
  ]);

  useEffect(() => {
    const data = channelMapQuery.data;
    if (!data) {
      setChannelMapDraft({ ...DEFAULT_CHANNEL_MAP_DRAFT });
      return;
    }
    const next = { ...DEFAULT_CHANNEL_MAP_DRAFT };
    for (const entry of data.entries) {
      next[entry.plot_key] = {
        x_col: String(entry.x_col),
        y_col: String(entry.y_col),
      };
    }
    setChannelMapDraft(next);
  }, [channelMapQuery.data]);

  useEffect(() => {
    const data = eventsQuery.data;
    if (!data || !serverOptions || !selectedProgramId || !selectedVersion) {
      return;
    }
    const key = `${selectedProgramId}::${selectedVersion}`;
    const isFreshSelection = lastInitKeyRef.current !== key;
    const matchingEvents = data.events;

    const { draft: nextDraftValues, baseline: nextBaselineValues } =
      buildProgramVersionDraftValues(serverOptions, matchingEvents);
    const nextPhaseDraftValues = buildProgramVersionPhaseDraftValues(matchingEvents);

    setBaselineDraftValues(nextBaselineValues);
    setBaselinePhaseDraftValues(nextPhaseDraftValues);

    if (isFreshSelection) {
      setDraftValues(nextDraftValues);
      setPhaseDraftValues(nextPhaseDraftValues);
      setDirtyFields(new Set());
      setDirtyPhases(new Set());
      setPreResetSnapshot(null);
    } else {
      const currentDirtyFields = dirtyFieldsRef.current;
      const currentDirtyPhases = dirtyPhasesRef.current;
      setDraftValues((prev) => {
        const next = { ...prev };
        for (const [fieldKey, value] of Object.entries(nextDraftValues)) {
          if (!currentDirtyFields.has(fieldKey)) {
            next[fieldKey] = value;
          }
        }
        return next;
      });
      setPhaseDraftValues((prev) => {
        const next = { ...prev };
        for (const field of PHASE_FIELDS) {
          if (!currentDirtyPhases.has(field.key)) {
            next[field.key] = nextPhaseDraftValues[field.key];
          }
        }
        return next;
      });
    }

    const uniqueStatusValues = new Set<string>();
    matchingEvents.forEach((event) => {
      const statusValue = event.status?.trim();
      if (statusValue) {
        uniqueStatusValues.add(statusValue);
      }
    });
    const latestUpdatedEvent = matchingEvents.reduce<EventMetadata | null>(
      (latest, event) => {
        const latestTs = toTimestamp(latest?.updated_at ?? latest?.created_at);
        const eventTs = toTimestamp(event.updated_at ?? event.created_at);
        return eventTs > latestTs ? event : latest;
      },
      null,
    );
    const latestUploadedEvent = matchingEvents.reduce<EventMetadata | null>(
      (latest, event) => {
        const latestTs = toTimestamp(latest?.created_at);
        const eventTs = toTimestamp(event.created_at);
        return eventTs > latestTs ? event : latest;
      },
      null,
    );
    setSelectedEventMetadata({
      lastUpdatedBy:
        latestUpdatedEvent?.last_updated_by_username ??
        latestUpdatedEvent?.last_updated_by_user_id ??
        latestUpdatedEvent?.uploaded_by_user_id ??
        null,
      lastUpdatedAt:
        latestUpdatedEvent?.updated_at ?? latestUpdatedEvent?.created_at ?? null,
      uploadedBy:
        latestUploadedEvent?.uploaded_by_username ??
        latestUploadedEvent?.uploaded_by_user_id ??
        null,
      uploadedAt: latestUploadedEvent?.created_at ?? null,
      status:
        uniqueStatusValues.size === 1
          ? Array.from(uniqueStatusValues)[0]
          : uniqueStatusValues.size > 1
            ? 'Mixed'
            : null,
    });

    lastInitKeyRef.current = key;
  }, [eventsQuery.data, serverOptions, selectedProgramId, selectedVersion]);

  const formatTimestamp = (value: string | null): string => {
    if (!value) {
      return 'N/A';
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return 'N/A';
    }
    return parsed.toLocaleString();
  };

  const markFieldDirty = (displayName: string) => {
    setDirtyFields((prev) => {
      if (prev.has(displayName)) {
        return prev;
      }
      const next = new Set(prev);
      next.add(displayName);
      return next;
    });
  };
  const markPhaseDirty = (key: keyof PhaseDraftValues) => {
    setDirtyPhases((prev) => {
      if (prev.has(key)) {
        return prev;
      }
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  };

  const setValueForField = (displayName: string, rawValue: string) => {
    const value = rawValue.trim();
    setDraftValues((prev) => ({
      ...prev,
      [displayName]: value,
    }));
    markFieldDirty(displayName);
  };
  const setWeightFieldValue = (displayName: string, rawValue: string) => {
    const value = rawValue.replace(/[^0-9.]/g, '');
    setDraftValues((prev) => ({
      ...prev,
      [displayName]: value,
    }));
    markFieldDirty(displayName);
  };
  const setPhaseValue = (key: keyof PhaseDraftValues, nextValue: boolean) => {
    setPhaseDraftValues((prev) => ({
      ...prev,
      [key]: nextValue,
    }));
    markPhaseDirty(key);
  };

  const getFieldSelectLabel = (displayName: string): string => {
    if (!selectedProgramId || !selectedVersion) {
      return 'Select Program & Version';
    }

    const value = draftValues[displayName]?.trim() ?? '';
    if (!value) {
      return 'N/A';
    }

    return value;
  };

  const handleSave = async () => {
    if (isSaving) {
      return;
    }
    if (!selectedProgramId || !selectedVersion) {
      toast.error('Select Program ID and Version first');
      return;
    }

    const updates: Record<string, string | boolean | null> = {};
    metadataOptions.forEach(([displayName, config]) => {
      if (!isAdmin && isStatusField(displayName, config)) {
        return;
      }
      if (!dirtyFields.has(displayName)) {
        return;
      }
      const nextValue = (draftValues[displayName] ?? '').trim();
      updates[config.column] = nextValue || null;
    });
    RAW_WEIGHT_FIELDS.forEach((field) => {
      if (!dirtyFields.has(field.label)) {
        return;
      }
      const nextValue = (draftValues[field.label] ?? '').trim();
      updates[field.key] = nextValue || null;
    });
    PHASE_FIELDS.forEach((field) => {
      if (!dirtyPhases.has(field.key)) {
        return;
      }
      updates[field.key] = phaseDraftValues[field.key];
    });

    const savingToastId = toast.loading(
      `Saving metadata for ${selectedProgramId} / ${selectedVersion}...`
    );
    setIsSaving(true);
    try {
      if (Object.keys(updates).length === 0) {
        toast.warning('No changes to save', { id: savingToastId });
        return;
      }
      const updateResult = await dashboardApi.updateProgramVersionMetadata({
        program_id: selectedProgramId,
        version: selectedVersion,
        updates,
      });
      const updatedEventCount = updateResult.updated_event_count;
      setSelectedEventMetadata({
        lastUpdatedBy:
          updateResult.last_updated_by_username ??
          updateResult.last_updated_by_user_id ??
          null,
        lastUpdatedAt: updateResult.last_updated_at ?? null,
        uploadedBy:
          updateResult.uploaded_by_username ??
          updateResult.uploaded_by_user_id ??
          null,
        uploadedAt: updateResult.uploaded_at ?? null,
        status: updateResult.status ?? null,
      });

      setBaselineDraftValues(draftValues);
      setBaselinePhaseDraftValues(phaseDraftValues);
      setDirtyFields(new Set());
      setDirtyPhases(new Set());
      await invalidateQueriesAfterMetadataSave(queryClient);
      toast.success(
        `Metadata saved for ${updatedEventCount} event${
          updatedEventCount === 1 ? '' : 's'
        }`,
        { id: savingToastId }
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to update metadata';
      toast.error(message, { id: savingToastId });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    try {
      setPreResetSnapshot({
        values: { ...draftValues },
        phases: { ...phaseDraftValues },
        dirtyFields: new Set(dirtyFields),
        dirtyPhases: new Set(dirtyPhases),
      });
      setDraftValues(baselineDraftValues);
      setPhaseDraftValues(baselinePhaseDraftValues);
      setDirtyFields(new Set());
      setDirtyPhases(new Set());
      toast.success('Metadata values reset');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to reset metadata values';
      toast.error(message);
    }
  };

  const handleRestore = () => {
    if (!preResetSnapshot) {
      return;
    }
    try {
      setDraftValues(preResetSnapshot.values);
      setPhaseDraftValues(preResetSnapshot.phases);
      setDirtyFields(new Set(preResetSnapshot.dirtyFields));
      setDirtyPhases(new Set(preResetSnapshot.dirtyPhases));
      setPreResetSnapshot(null);
      toast.success('Pre-reset values restored');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to restore metadata values';
      toast.error(message);
    }
  };

  const buildCopyableKeys = (): string[] => {
    const keys: string[] = [];
    metadataOptions.forEach(([displayName, config]) => {
      if (isStatusField(displayName, config)) {
        return;
      }
      keys.push(displayName);
    });
    RAW_WEIGHT_FIELDS.forEach((field) => {
      keys.push(field.label);
    });
    return keys;
  };

  const handleCopy = () => {
    try {
      const snapshot: MetadataDraftValues = {};
      buildCopyableKeys().forEach((key) => {
        snapshot[key] = draftValues[key] ?? '';
      });
      setCopyClipboard(snapshot);
      toast.success('Values copied');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to copy metadata values';
      toast.error(message);
    }
  };

  const handlePaste = () => {
    if (!copyClipboard) {
      return;
    }
    try {
      const keys = buildCopyableKeys();
      setDraftValues((prev) => {
        const next = { ...prev };
        keys.forEach((key) => {
          next[key] = copyClipboard[key] ?? '';
        });
        return next;
      });
      setDirtyFields((prev) => {
        const next = new Set(prev);
        keys.forEach((key) => next.add(key));
        return next;
      });
      setCopyClipboard(null);
      toast.success('Values pasted');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to paste metadata values';
      toast.error(message);
    }
  };

  const setChannelMapValue = (
    plotKey: string,
    axis: 'x_col' | 'y_col',
    value: string,
  ) => {
    const normalized = value.replace(/[^0-9]/g, '');
    setChannelMapDraft((prev) => ({
      ...prev,
      [plotKey]: {
        ...(prev[plotKey] ?? { x_col: '', y_col: '' }),
        [axis]: normalized,
      },
    }));
  };

  const handleSaveChannelMap = async () => {
    if (!selectedProgramId || !selectedVersion) {
      toast.error('Select Program ID and Version first');
      return;
    }
    const entries: ChannelMapEditorEntry[] = [];
    for (const plotKey of FIXED_CHANNEL_MAP_PLOTS) {
      const draft = channelMapDraft[plotKey];
      if (!draft?.x_col || !draft?.y_col) {
        toast.error(`Enter x_col and y_col for ${plotKey}`);
        return;
      }
      entries.push({
        plot_key: plotKey,
        x_col: Number(draft.x_col),
        y_col: Number(draft.y_col),
      });
    }

    const savingToastId = toast.loading(
      `Saving channel map for ${selectedProgramId} / ${selectedVersion}...`,
    );
    setIsSavingChannelMap(true);
    try {
      const result = await dashboardApi.saveChannelMap({
        program_id: selectedProgramId,
        version: selectedVersion,
        entries,
      });
      await queryClient.invalidateQueries({ queryKey: ['channel-map-editor'] });
      await queryClient.invalidateQueries({ queryKey: ['datasets'] });
      await queryClient.invalidateQueries({ queryKey: ['program-version-events'] });
      await queryClient.invalidateQueries({ queryKey: ['all-events'] });
      await queryClient.invalidateQueries({ queryKey: ['event-catalog'] });
      toast.success(
        `Channel map saved. Processed ${result.processed_count} file${
          result.processed_count === 1 ? '' : 's'
        }${result.failed_count ? `; ${result.failed_count} failed` : ''}.`,
        { id: savingToastId },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save channel map';
      toast.error(message, { id: savingToastId });
    } finally {
      setIsSavingChannelMap(false);
    }
  };

  const parseOptionalNumber = (rawValue: string): number | null => {
    const trimmed = rawValue.trim();
    if (!trimmed) {
      return null;
    }
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const handleScheduleRowChange = (
    rowId: string,
    field: DurabilityScheduleEditableField,
    rawValue: string,
  ) => {
    setScheduleDraftRows((previous) =>
      previous.map((row) => {
        if (row.id !== rowId) {
          return row;
        }
        if (field === 'rspEventName') {
          return { ...row, rspEventName: rawValue };
        }
        if (field === 'schedulePattern') {
          return { ...row, schedulePattern: rawValue };
        }
        if (field === 'weight') {
          return { ...row, weight: parseOptionalNumber(rawValue) };
        }
        if (field === 'repeats') {
          return { ...row, repeats: parseOptionalNumber(rawValue) };
        }
        return { ...row, scheduleSequence: parseOptionalNumber(rawValue) };
      }),
    );
  };

  const handleScheduleMultiplierChange = (rawValue: string) => {
    const parsed = parseOptionalNumber(rawValue);
    setScheduleDraftMultiplier(parsed);
  };

  const handleResetSchedule = () => {
    setScheduleDraftRows(baselineScheduleRows);
    setScheduleDraftMultiplier(baselineScheduleMultiplier);
    setScheduleDelimiterToken(baselineScheduleDelimiterToken);
    toast.success('Schedule edits reset');
  };

  const handleSaveSchedule = async () => {
    if (!selectedProgramId || !selectedVersion || !hasAttachedSchedule) {
      return;
    }
    if (scheduleDraftMultiplier == null) {
      toast.error('Enter a global multiplier before saving');
      return;
    }

    const savingToastId = toast.loading(
      `Saving durability schedule for ${selectedProgramId} / ${selectedVersion}...`,
    );
    setIsSavingSchedule(true);
    try {
      const result = await dashboardApi.saveProgramVersionSchedule({
        program_id: selectedProgramId,
        version: selectedVersion,
        multiplier: scheduleDraftMultiplier,
        event_rows: rowsToSavePayload(scheduleDraftRows),
        delimiter_token: scheduleDelimiterToken,
      });
      const savedRows = rowsFromSavedEventRows(result.parse_preview.event_rows ?? []);
      const savedMultiplier = result.parse_preview.multiplier ?? scheduleDraftMultiplier;
      const savedDelimiter = result.parse_preview.delimiter_token ?? scheduleDelimiterToken;
      setScheduleDraftRows(savedRows);
      setBaselineScheduleRows(savedRows);
      setScheduleDraftMultiplier(savedMultiplier);
      setBaselineScheduleMultiplier(savedMultiplier);
      setScheduleDelimiterToken(savedDelimiter);
      setBaselineScheduleDelimiterToken(savedDelimiter);
      await queryClient.invalidateQueries({
        queryKey: ['program-version-schedule', selectedProgramId, selectedVersion],
      });
      toast.success('Durability schedule saved', { id: savingToastId });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to save durability schedule';
      toast.error(message, { id: savingToastId });
    } finally {
      setIsSavingSchedule(false);
    }
  };

  const handleExtractSchedule = async (scheduleFile: File) => {
    if (!selectedProgramId || !selectedVersion) {
      return;
    }

    setIsExtractingSchedule(true);
    const extractingToastId = toast.loading('Extracting durability schedule...');
    try {
      const result = await dashboardApi.attachProgramVersionSchedule({
        programId: selectedProgramId,
        version: selectedVersion,
        scheduleFile,
      });
      await queryClient.invalidateQueries({
        queryKey: ['program-version-schedule', selectedProgramId, selectedVersion],
      });
      toast.success(
        result.replaced_previous
          ? 'Durability schedule replaced for this program/version.'
          : 'Durability schedule extracted for this program/version.',
        { id: extractingToastId },
      );
      setScheduleUploadKey((key) => key + 1);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to extract durability schedule';
      toast.error(message, { id: extractingToastId });
    } finally {
      setIsExtractingSchedule(false);
    }
  };
  if (
    authStatus === 'loading' ||
    authStatus === 'idle' ||
    isLoading
  ) {
    return <div className="flex-1 p-4">Loading...</div>;
  }

  return (
    <div className="flex-1 p-4 min-h-[calc(100vh-3.5rem)]">
      <div className="flex gap-0 h-[calc(100vh-7rem)]">
        <EditMetadataSidePanel
          isCollapsed={sidePanelCollapsed}
          onToggleCollapse={() => setSidePanelCollapsed((prev) => !prev)}
          selectDatasetProps={{
            selectedProgramId,
            selectedVersion,
            programIds,
            versions,
            isProgramIdsLoading,
            isVersionsLoading,
            isPrefillLoading,
            isSaving,
            selectedEventMetadata,
            formatTimestamp,
            onProgramIdChange: (value) => {
              setSelectedProgramId(value);
              setSelectedVersion('');
              setSelectedEventMetadata(null);
            },
            onVersionChange: (value) => {
              setSelectedVersion(value);
              setSelectedEventMetadata(null);
            },
            hasAttachedSchedule,
            isScheduleLoading: scheduleQuery.isLoading,
            missingChannelMap: channelMapQuery.data?.missing_channel_map ?? false,
            isChannelMapLoading: channelMapQuery.isLoading,
          }}
          uploadScheduleProps={{
            enabled: Boolean(selectedProgramId && selectedVersion),
            selectionKey: `${selectedProgramId}:${selectedVersion}:${scheduleUploadKey}`,
            onExtract: (scheduleFile) => void handleExtractSchedule(scheduleFile),
            isExtracting: isExtractingSchedule,
          }}
        />

        <div className="flex-1 min-w-0 min-h-0">
          <Card className="h-full rounded-r-lg rounded-l-none flex flex-col gap-0 overflow-hidden shadow-subtle border py-0">
            <Tabs defaultValue="filter-values" className="flex-1 min-h-0 flex flex-col">
              <div className="shrink-0 border-b px-4 py-3">
                <TabsList className="w-fit">
                  <TabsTrigger value="filter-values">Edit Metadata</TabsTrigger>
                  <TabsTrigger value="custom-fields">Assign Channels</TabsTrigger>
                  <TabsTrigger value="durability-schedule">Durability Schedule</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="filter-values" className="flex-1 min-h-0 mt-0 flex flex-col p-4">
                <Card className="flex-1 min-h-0 flex flex-col gap-0 overflow-hidden rounded-lg border bg-card shadow-subtle py-0">
                  <CardContent className="flex flex-1 min-h-0 flex-col p-4">
                    <div className="flex-1 min-h-0 overflow-y-auto">
                  {!serverOptions ? (
                    <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                      No metadata fields available.
                    </div>
                  ) : (
                    <div className="flex gap-0">
                      {(() => {
                        const statusOption = metadataOptions.find(
                          ([displayName, config]) =>
                            displayName.toLowerCase() === 'status' || config.column === 'status'
                        );
                        const nonStatusOptions = metadataOptions.filter(
                          ([displayName, config]) =>
                            !(displayName.toLowerCase() === 'status' || config.column === 'status')
                        );
                        const mid = Math.ceil(nonStatusOptions.length / 2);
                        const leftItems = nonStatusOptions.slice(0, mid);
                        const rightItems = nonStatusOptions.slice(mid);
                        const steeringOption = nonStatusOptions.find(
                          ([displayName, config]) =>
                            displayName.toLowerCase() === 'steering' ||
                            config.column === 'steering'
                        );
                        const leftItemsWithoutSteering = leftItems.filter(
                          ([displayName, config]) =>
                            !(
                              displayName.toLowerCase() === 'steering' ||
                              config.column === 'steering'
                            )
                        );
                        const rightItemsWithoutSteering = rightItems.filter(
                          ([displayName, config]) =>
                            !(
                              displayName.toLowerCase() === 'steering' ||
                              config.column === 'steering'
                            )
                        );
                        const gvwField = RAW_WEIGHT_FIELDS.find((field) => field.key === 'gvw');
                        const rightWeightFields = RAW_WEIGHT_FIELDS.filter(
                          (field) => field.key !== 'gvw'
                        );

                        const renderField = ([displayName, config]: [string, { column: string; values: string[]; source?: string; order: number }]) => {
                          const statusField = isStatusField(displayName, config);
                          const hasMixedValues = !draftValues[displayName];
                          return (
                            <div
                              key={displayName}
                              className="rounded-md p-3 space-y-3 bg-muted/50 min-h-[112px]"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <p className="text-sm font-medium">{displayName}</p>
                                <Select
                                  value={draftValues[displayName] ?? ''}
                                  onValueChange={(value) => setValueForField(displayName, value)}
                                  disabled={
                                    (!isAdmin && statusField) ||
                                    !selectedProgramId ||
                                    !selectedVersion ||
                                    isSaving
                                  }
                                >
                                  <SelectTrigger className="h-8 w-44 text-xs">
                                    <SelectValue
                                      placeholder={
                                        hasMixedValues
                                          ? 'Mixed values (select to override)'
                                          : getFieldSelectLabel(displayName)
                                      }
                                    />
                                  </SelectTrigger>
                                  <SelectContent position="popper" className="max-h-64">
                                    {config.values.length > 0 ? (
                                      config.values.map((optionValue) => (
                                        <SelectItem key={optionValue} value={optionValue}>
                                          {optionValue}
                                        </SelectItem>
                                      ))
                                    ) : (
                                      <SelectItem value="__none__" disabled>
                                        No predefined options
                                      </SelectItem>
                                    )}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          );
                        };
                        const renderWeightField = (field: (typeof RAW_WEIGHT_FIELDS)[number]) => (
                          <div
                            key={field.key}
                            className="rounded-md p-3 space-y-3 bg-muted/50 min-h-[112px]"
                          >
                            <p className="text-sm font-medium">{field.label}</p>
                            <Input
                              value={draftValues[field.label] ?? ''}
                              onChange={(event) =>
                                setWeightFieldValue(field.label, event.target.value)
                              }
                              placeholder="Enter value"
                              disabled={!selectedProgramId || !selectedVersion || isSaving}
                              className="h-8 text-xs"
                              inputMode="decimal"
                            />
                          </div>
                        );

                        return (
                          <>
                            <div className="flex-1 min-w-0 space-y-4">
                              {statusOption && (
                                <div className="rounded-md p-3 space-y-3 bg-muted/50 min-h-[112px]">
                                  <div className="space-y-1">
                                    <p className="text-sm font-medium">{statusOption[0]}</p>
                                    <Select
                                      value={draftValues[statusOption[0]] ?? ''}
                                      onValueChange={(value) => setValueForField(statusOption[0], value)}
                                      disabled={!isAdmin || !selectedProgramId || !selectedVersion || isSaving}
                                    >
                                      <SelectTrigger className="h-8 w-full text-xs">
                                        <SelectValue
                                          placeholder={
                                            draftValues[statusOption[0]]
                                              ? getFieldSelectLabel(statusOption[0])
                                              : 'Mixed values (select to override)'
                                          }
                                        />
                                      </SelectTrigger>
                                      <SelectContent position="popper" className="max-h-64">
                                        {statusOption[1].values.map((optionValue) => (
                                          <SelectItem key={optionValue} value={optionValue}>
                                            {optionValue}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    {!isAdmin && (
                                      <p className="text-xs text-amber-600 dark:text-amber-400">
                                        Admin access is required to edit this field.
                                      </p>
                                    )}
                                  </div>
                                </div>
                              )}
                              {leftItemsWithoutSteering.map(renderField)}
                              {steeringOption && renderField(steeringOption)}
                            </div>
                            <div className="hidden xl:block w-px bg-border mx-4 shrink-0" />
                            <div className="flex-1 min-w-0 space-y-4">
                              <div className="rounded-md p-3 space-y-3 bg-muted/50 min-h-[112px]">
                                <p className="text-sm font-medium">Applicable Phases</p>
                                <div className="grid grid-cols-4 gap-2">
                                  {PHASE_FIELDS.map((phaseField) => (
                                    <label
                                      key={phaseField.key}
                                      className="flex items-center gap-2 text-xs"
                                    >
                                      <Checkbox
                                        checked={phaseDraftValues[phaseField.key]}
                                        onCheckedChange={(checked) =>
                                          setPhaseValue(phaseField.key, Boolean(checked))
                                        }
                                        disabled={!selectedProgramId || !selectedVersion || isSaving}
                                      />
                                      <span>{phaseField.label}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                              {rightWeightFields.map(renderWeightField)}
                              {gvwField && renderWeightField(gvwField)}
                              {rightItemsWithoutSteering.map(renderField)}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  )}
                    </div>
                    <div className="mt-4 flex shrink-0 items-center justify-end gap-2 border-t pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => (copyClipboard ? handlePaste() : handleCopy())}
                        disabled={
                          isPrefillLoading || isSaving || !selectedProgramId || !selectedVersion
                        }
                      >
                        {copyClipboard ? (
                          <ClipboardPaste className="size-4" />
                        ) : (
                          <Clipboard className="size-4" />
                        )}
                        {copyClipboard ? 'Paste' : 'Copy'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => (preResetSnapshot ? handleRestore() : handleReset())}
                        disabled={
                          isPrefillLoading || isSaving || !selectedProgramId || !selectedVersion
                        }
                      >
                        {preResetSnapshot ? (
                          <RotateCw className="size-4" />
                        ) : (
                          <RotateCcw className="size-4" />
                        )}
                        {preResetSnapshot ? 'Restore' : 'Reset'}
                      </Button>
                      <Button
                        type="button"
                        onClick={() => void handleSave()}
                        disabled={
                          isPrefillLoading ||
                          isSaving ||
                          !selectedProgramId ||
                          !selectedVersion ||
                          (dirtyFields.size === 0 && dirtyPhases.size === 0)
                        }
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="size-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="size-4" />
                            Save
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="custom-fields" className="mt-0">
                <CardContent className="p-4">
                  {!selectedProgramId || !selectedVersion ? (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      Select a Program ID and Version to edit its channel map.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {channelMapQuery.isLoading ? (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Loader2 className="size-4 animate-spin" />
                          Loading channel map...
                        </div>
                      ) : null}
                      <div
                        className="flex shrink-0 flex-col overflow-hidden rounded-lg border bg-card"
                      >
                        <div className="flex items-start gap-1.5 border-b px-3 py-1.5 text-xs leading-5 text-muted-foreground">
                          <Info
                            className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                            aria-hidden="true"
                          />
                          <p className="min-w-0">
                            Enter the zero-based column index from the CSV preview in x and y to
                            assign each plot&apos;s axis data. The index numbers are shown in the row
                            above the column headers.
                          </p>
                        </div>
                        <div
                          className="flex min-h-0 flex-col overflow-hidden lg:flex-row"
                          style={{ height: CHANNEL_MAP_TABLE_HEIGHT_PX }}
                        >
                        <div className="flex min-h-0 min-w-0 flex-[1] flex-col overflow-hidden bg-card lg:border-r">
                          <div className="h-full overflow-hidden">
                            <div className="sticky top-0 z-10 shrink-0 bg-card">
                            <div
                              className="h-7 shrink-0 border-b bg-muted/60"
                              aria-hidden="true"
                            />
                            <div className="grid h-8 shrink-0 grid-cols-[minmax(0,1fr)_44px_44px] border-b bg-muted/40 text-[11px] font-medium leading-none text-muted-foreground">
                              <div className="flex h-8 items-center border-r border-border bg-muted/40 px-3 text-foreground">
                                <span className="truncate">Plot</span>
                              </div>
                              <div className="flex h-8 items-center justify-center border-b border-r border-border bg-muted/40 text-foreground">
                                x
                              </div>
                              <div className="flex h-8 items-center justify-center border-b border-border bg-muted/40 text-foreground">
                                y
                              </div>
                            </div>
                            </div>
                            {FIXED_CHANNEL_MAP_PLOTS.map((plotKey) => {
                            const plotDisplayTitle = getPlotDisplayTitle(plotKey);
                            return (
                              <div
                                key={plotKey}
                                className="grid h-8 shrink-0 grid-cols-[minmax(0,1fr)_44px_44px] border-b transition-colors hover:bg-muted/30"
                              >
                                <div
                                  className="flex h-8 items-center border-b border-r border-border bg-muted/40 px-3"
                                  title={plotDisplayTitle}
                                >
                                  <span className="truncate text-xs leading-none text-foreground">
                                    {plotDisplayTitle}
                                  </span>
                                </div>
                                <div className="flex h-8 items-center border-b border-r border-border bg-muted/40">
                                  <Input
                                    value={channelMapDraft[plotKey]?.x_col ?? ''}
                                    onChange={(event) =>
                                      setChannelMapValue(plotKey, 'x_col', event.target.value)
                                    }
                                    inputMode="numeric"
                                    className="h-8 w-full rounded-none border-0 bg-transparent px-1 text-center text-xs md:text-xs tabular-nums leading-none text-foreground shadow-none focus-visible:border-transparent focus-visible:ring-0"
                                  />
                                </div>
                                <div className="flex h-8 items-center border-b border-border bg-muted/40">
                                  <Input
                                    value={channelMapDraft[plotKey]?.y_col ?? ''}
                                    onChange={(event) =>
                                      setChannelMapValue(plotKey, 'y_col', event.target.value)
                                    }
                                    inputMode="numeric"
                                    className="h-8 w-full rounded-none border-0 bg-transparent px-1 text-center text-xs md:text-xs tabular-nums leading-none text-foreground shadow-none focus-visible:border-transparent focus-visible:ring-0"
                                  />
                                </div>
                              </div>
                            );
                          })}
                          {Array.from({ length: CHANNEL_MAP_PADDING_ROW_COUNT }, (_, index) => (
                            <div
                              key={`channel-map-padding-${index}`}
                              className="grid h-8 shrink-0 grid-cols-[minmax(0,1fr)_44px_44px] border-b"
                              aria-hidden="true"
                            >
                              <div className="h-8 border-b border-r border-border bg-muted/40" />
                              <div className="h-8 border-b border-r border-border bg-muted/40" />
                              <div className="h-8 border-b border-border bg-muted/40" />
                            </div>
                            ))}
                          </div>
                        </div>

                        <div className="flex min-h-0 min-w-0 flex-[6] flex-col overflow-hidden">
                          <CsvPreviewTable
                            previewLines={channelMapQuery.data?.preview_lines ?? []}
                            maxRows={CHANNEL_MAP_DATA_ROW_COUNT}
                            columnCount={channelMapQuery.data?.column_count ?? 0}
                            fallbackColumnCount={CHANNEL_MAP_PREVIEW_FALLBACK_COLUMN_COUNT}
                          />
                        </div>
                        </div>
                        <div className="flex justify-end border-t px-4 py-3">
                          <Button
                            type="button"
                            onClick={() => void handleSaveChannelMap()}
                            disabled={isSavingChannelMap || !channelMapQuery.data?.column_count}
                          >
                            {isSavingChannelMap ? (
                              <>
                                <Loader2 className="size-4 animate-spin" />
                                Saving...
                              </>
                            ) : (
                              <>
                                <Save className="size-4" />
                                Save
                              </>
                            )}
                          </Button>
                        </div>
                      </div>

                      {channelMapQuery.data?.missing_channel_map && (
                        <div className="text-xs leading-4 text-muted-foreground">
                          <span className="inline-flex items-center gap-1 text-destructive">
                            <AlertCircle className="size-3.5" />
                            Channel map required before these files can be plotted.
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </TabsContent>

              <TabsContent value="durability-schedule" className="mt-0">
                <CardContent className="p-4">
                  {!selectedProgramId || !selectedVersion ? (
                    <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                      Select a Program ID and Version to edit its durability schedule.
                    </div>
                  ) : isDurabilityScheduleLoading ? (
                    <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                      Loading durability schedule...
                    </div>
                  ) : !hasAttachedSchedule ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                      <p className="text-sm text-muted-foreground">
                        No durability schedule is attached for this program/version.
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Upload a `.sch` file in the side panel and click Extract to attach a schedule.
                      </p>
                    </div>
                  ) : scheduleQuery.data ? (
                    <div className="mx-auto flex w-fit flex-col items-start gap-2">
                      <div className="w-full text-xs text-muted-foreground">
                        Active schedule:{' '}
                        <span className="font-medium text-foreground">
                          {scheduleQuery.data.parse_preview.schedule_id ??
                            scheduleQuery.data.source_filename}
                        </span>
                        {' · '}
                        {scheduleQuery.data.parse_preview.entry_count} pattern
                        {scheduleQuery.data.parse_preview.entry_count === 1 ? '' : 's'}
                        {' · '}
                        multiplier {scheduleDraftMultiplier ?? scheduleQuery.data.parse_preview.multiplier}
                      </div>
                      <DurabilityScheduleTable
                        rows={scheduleDraftRows}
                        globalMultiplier={scheduleDraftMultiplier}
                        editable={canWrite}
                        onRowChange={handleScheduleRowChange}
                        onMultiplierChange={handleScheduleMultiplierChange}
                      />
                      {canWrite ? (
                        <div className="flex w-full justify-end gap-2 border-t pt-3">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleResetSchedule}
                            disabled={!isScheduleDirty || isSavingSchedule}
                          >
                            <RotateCcw className="size-4" />
                            Reset
                          </Button>
                          <Button
                            type="button"
                            onClick={() => void handleSaveSchedule()}
                            disabled={!isScheduleDirty || isSavingSchedule}
                          >
                            {isSavingSchedule ? (
                              <>
                                <Loader2 className="size-4 animate-spin" />
                                Saving...
                              </>
                            ) : (
                              <>
                                <Save className="size-4" />
                                Save
                              </>
                            )}
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </CardContent>
              </TabsContent>
            </Tabs>
          </Card>
        </div>
      </div>
    </div>
  );
}
