'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Loader2,
  RotateCcw,
  RotateCw,
  Save,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuthStore } from '@/stores/auth-store';
import { useFilterOptions } from '@/hooks/use-filter-options';
import { dashboardApi } from '@/lib/api';
import { invalidateQueriesAfterMetadataSave } from '@/lib/metadata-save-cache';
import {
  EXCLUDED_METADATA_COLUMNS,
  isStatusField,
  PHASE_FIELDS,
  RAW_WEIGHT_FIELDS,
  type SelectionMetadata,
} from '@/features/edit-metadata';
import {
  buildProgramVersionDraftValues,
  buildProgramVersionPhaseDraftValues,
  buildSelectionMetadata,
  toClearedDraftValues,
  toClearedPhaseDraftValues,
  type MetadataDraftValues,
  type PhaseDraftValues,
} from '@/features/edit-metadata/lib/build-program-version-draft';
import { isMetadataSaveEnabled } from '@/features/edit-metadata/lib/metadata-save-state';

export interface EditMetadataPanelScope {
  programId: string;
  version: string;
}

export interface EditMetadataPanelProps {
  scope: EditMetadataPanelScope;
  canWrite?: boolean;
  onSelectionMetadataChange?: (metadata: SelectionMetadata | null) => void;
  onActivityChange?: (activity: { isPrefillLoading: boolean; isSaving: boolean }) => void;
  onDirtyChange?: (isDirty: boolean) => void;
  onStatusDraftChange?: (status: string | null) => void;
  onSaveSuccess?: () => void;
}

export function EditMetadataPanel({
  scope,
  canWrite = true,
  onSelectionMetadataChange,
  onActivityChange,
  onDirtyChange,
  onStatusDraftChange,
  onSaveSuccess,
}: EditMetadataPanelProps) {
  const { programId, version } = scope;
  const queryClient = useQueryClient();
  const authUser = useAuthStore((s) => s.user);
  const { data: serverOptions } = useFilterOptions();
  const [draftValues, setDraftValues] = useState<MetadataDraftValues>({});
  const [baselineDraftValues, setBaselineDraftValues] = useState<MetadataDraftValues>({});
  const [phaseDraftValues, setPhaseDraftValues] = useState<PhaseDraftValues>(
    toClearedPhaseDraftValues(),
  );
  const [baselinePhaseDraftValues, setBaselinePhaseDraftValues] =
    useState<PhaseDraftValues>(toClearedPhaseDraftValues());
  const [dirtyFields, setDirtyFields] = useState<Set<string>>(new Set());
  const [dirtyPhases, setDirtyPhases] = useState<Set<keyof PhaseDraftValues>>(new Set());
  const [preResetSnapshot, setPreResetSnapshot] = useState<{
    values: MetadataDraftValues;
    phases: PhaseDraftValues;
    dirtyFields: Set<string>;
    dirtyPhases: Set<keyof PhaseDraftValues>;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const lastInitKeyRef = useRef<string | null>(null);
  const dirtyFieldsRef = useRef<Set<string>>(new Set());
  const dirtyPhasesRef = useRef<Set<keyof PhaseDraftValues>>(new Set());
  const isAdmin = authUser?.role === 'admin';

  const sortedOptions = useMemo(() => {
    if (!serverOptions) {
      return [];
    }
    return Object.entries(serverOptions).sort((a, b) => a[1].order - b[1].order);
  }, [serverOptions]);

  const metadataOptions = useMemo(
    () =>
      sortedOptions.filter(
        ([, config]) =>
          config.source !== 'custom' && !EXCLUDED_METADATA_COLUMNS.has(config.column),
      ),
    [sortedOptions],
  );

  const statusDisplayName = useMemo(
    () =>
      metadataOptions.find(([displayName, config]) => isStatusField(displayName, config))?.[0] ??
      null,
    [metadataOptions],
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
    queryKey: ['program-version-events', programId, version],
    queryFn: () =>
      dashboardApi.getEvents(
        {
          program_ids: [programId],
          versions: [version],
          global_filters: {},
        },
        500,
      ),
    enabled: Boolean(programId && version && serverOptions),
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  const isPrefillLoading = eventsQuery.isFetching;

  useEffect(() => {
    onActivityChange?.({ isPrefillLoading, isSaving });
  }, [isPrefillLoading, isSaving, onActivityChange]);

  useEffect(() => {
    dirtyFieldsRef.current = dirtyFields;
  }, [dirtyFields]);

  useEffect(() => {
    dirtyPhasesRef.current = dirtyPhases;
  }, [dirtyPhases]);

  useEffect(() => {
    onDirtyChange?.(dirtyFields.size > 0 || dirtyPhases.size > 0);
  }, [dirtyFields.size, dirtyPhases.size, onDirtyChange]);

  useEffect(() => {
    if (!statusDisplayName) {
      onStatusDraftChange?.(null);
      return;
    }
    const value = draftValues[statusDisplayName]?.trim() || null;
    onStatusDraftChange?.(value);
  }, [draftValues, onStatusDraftChange, statusDisplayName]);

  useEffect(() => {
    if (!programId || !version || !serverOptions) {
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
      onSelectionMetadataChange?.(null);
      lastInitKeyRef.current = null;
    }
  }, [programId, version, serverOptions, onSelectionMetadataChange]);

  useEffect(() => {
    if (eventsQuery.error) {
      const message =
        eventsQuery.error instanceof Error
          ? eventsQuery.error.message
          : 'Failed to prefill filter values for the selected program/version';
      toast.error(message);
      onSelectionMetadataChange?.(null);
    }
  }, [eventsQuery.error, onSelectionMetadataChange]);

  useEffect(() => {
    const data = eventsQuery.data;
    if (!data || !serverOptions || !programId || !version) {
      return;
    }
    const key = `${programId}::${version}`;
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

    onSelectionMetadataChange?.(buildSelectionMetadata(matchingEvents));
    lastInitKeyRef.current = key;
  }, [eventsQuery.data, serverOptions, programId, version, onSelectionMetadataChange]);

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
    if (!programId || !version) {
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
    if (!canWrite) {
      toast.error('Write access required');
      return;
    }
    if (!programId || !version) {
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

    const savingToastId = toast.loading(`Saving metadata for ${programId} / ${version}...`);
    setIsSaving(true);
    try {
      if (Object.keys(updates).length === 0) {
        toast.warning('No changes to save', { id: savingToastId });
        return;
      }
      const updateResult = await dashboardApi.updateProgramVersionMetadata({
        program_id: programId,
        version,
        updates,
      });
      const updatedEventCount = updateResult.updated_event_count;
      onSelectionMetadataChange?.({
        lastUpdatedBy:
          updateResult.last_updated_by_username ?? updateResult.last_updated_by_user_id ?? null,
        lastUpdatedAt: updateResult.last_updated_at ?? null,
        uploadedBy: updateResult.uploaded_by_username ?? updateResult.uploaded_by_user_id ?? null,
        uploadedAt: updateResult.uploaded_at ?? null,
        status: updateResult.status ?? null,
      });

      setBaselineDraftValues(draftValues);
      setBaselinePhaseDraftValues(phaseDraftValues);
      setDirtyFields(new Set());
      setDirtyPhases(new Set());
      await invalidateQueriesAfterMetadataSave(queryClient);
      onSaveSuccess?.();
      toast.success(
        `Metadata saved for ${updatedEventCount} event${updatedEventCount === 1 ? '' : 's'}`,
        { id: savingToastId },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update metadata';
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
      const message = error instanceof Error ? error.message : 'Failed to reset metadata values';
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

  const saveEnabled = isMetadataSaveEnabled({
    programId,
    version,
    isPrefillLoading,
    isSaving,
    dirtyFieldCount: dirtyFields.size,
    dirtyPhaseCount: dirtyPhases.size,
    canWrite,
  });

  const fieldBlockClass = 'rounded-md p-2 bg-muted/50 h-full';
  const fieldRowClass = 'flex items-center justify-between gap-3';

  const renderField = ([displayName, config]: [
    string,
    { column: string; values: string[]; source?: string; order: number },
  ]) => {
    const statusField = isStatusField(displayName, config);
    const hasMixedValues = !draftValues[displayName];
    return (
      <div key={displayName} className={fieldBlockClass}>
        <div className={fieldRowClass}>
          <p className="min-w-0 shrink text-sm font-medium">{displayName}</p>
          <Select
            value={draftValues[displayName] ?? ''}
            onValueChange={(value) => setValueForField(displayName, value)}
            disabled={!canWrite || (!isAdmin && statusField) || !programId || !version || isSaving}
          >
            <SelectTrigger className="h-8 w-44 shrink-0 text-xs">
              <SelectValue
                placeholder={
                  hasMixedValues ? 'Mixed values (select to override)' : getFieldSelectLabel(displayName)
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

  const renderStatusField = (
    [displayName, config]: [
      string,
      { column: string; values: string[]; source?: string; order: number },
    ],
  ) => (
    <div key={displayName} className={fieldBlockClass}>
      <div className={fieldRowClass}>
        <div className="min-w-0">
          <p className="text-sm font-medium">{displayName}</p>
          {!isAdmin && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Admin access is required to edit this field.
            </p>
          )}
        </div>
        <Select
          value={draftValues[displayName] ?? ''}
          onValueChange={(value) => setValueForField(displayName, value)}
          disabled={!canWrite || !isAdmin || !programId || !version || isSaving}
        >
          <SelectTrigger className="h-8 w-44 shrink-0 text-xs">
            <SelectValue
              placeholder={
                draftValues[displayName]
                  ? getFieldSelectLabel(displayName)
                  : 'Mixed values (select to override)'
              }
            />
          </SelectTrigger>
          <SelectContent position="popper" className="max-h-64">
            {config.values.map((optionValue) => (
              <SelectItem key={optionValue} value={optionValue}>
                {optionValue}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  const renderWeightField = (field: (typeof RAW_WEIGHT_FIELDS)[number]) => (
    <div key={field.key} className={fieldBlockClass}>
      <div className={fieldRowClass}>
        <p className="min-w-0 shrink text-sm font-medium">{field.label}</p>
        <Input
          value={draftValues[field.label] ?? ''}
          onChange={(event) => setWeightFieldValue(field.label, event.target.value)}
          placeholder="Enter value"
          disabled={!canWrite || !programId || !version || isSaving}
          className="h-8 w-44 shrink-0 text-xs"
          inputMode="decimal"
        />
      </div>
    </div>
  );

  const renderPhasesField = () => (
    <div key="applicable-phases" className={fieldBlockClass}>
      <div className={fieldRowClass}>
        <p className="shrink-0 text-sm font-medium">Applicable Phases</p>
        <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
          {PHASE_FIELDS.map((phaseField) => (
            <label key={phaseField.key} className="flex items-center gap-1.5 text-xs">
              <Checkbox
                checked={phaseDraftValues[phaseField.key]}
                onCheckedChange={(checked) => setPhaseValue(phaseField.key, Boolean(checked))}
                disabled={!canWrite || !programId || !version || isSaving}
              />
              <span>{phaseField.label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );

  const renderMetadataFields = () => {
    const statusOption = metadataOptions.find(
      ([displayName, config]) =>
        displayName.toLowerCase() === 'status' || config.column === 'status',
    );
    const nonStatusOptions = metadataOptions.filter(
      ([displayName, config]) =>
        !(displayName.toLowerCase() === 'status' || config.column === 'status'),
    );
    const mid = Math.ceil(nonStatusOptions.length / 2);
    const leftItems = nonStatusOptions.slice(0, mid);
    const rightItems = nonStatusOptions.slice(mid);
    const steeringOption = nonStatusOptions.find(
      ([displayName, config]) =>
        displayName.toLowerCase() === 'steering' || config.column === 'steering',
    );
    const leftItemsWithoutSteering = leftItems.filter(
      ([displayName, config]) =>
        !(displayName.toLowerCase() === 'steering' || config.column === 'steering'),
    );
    const rightItemsWithoutSteering = rightItems.filter(
      ([displayName, config]) =>
        !(displayName.toLowerCase() === 'steering' || config.column === 'steering'),
    );
    const gvwField = RAW_WEIGHT_FIELDS.find((field) => field.key === 'gvw');
    const rightWeightFields = RAW_WEIGHT_FIELDS.filter((field) => field.key !== 'gvw');

    const leftCells: React.ReactNode[] = [
      ...(statusOption ? [renderStatusField(statusOption)] : []),
      ...leftItemsWithoutSteering.map(renderField),
      ...(steeringOption ? [renderField(steeringOption)] : []),
    ];
    const rightCells: React.ReactNode[] = [
      renderPhasesField(),
      ...rightWeightFields.map(renderWeightField),
      ...(gvwField ? [renderWeightField(gvwField)] : []),
      ...rightItemsWithoutSteering.map(renderField),
    ];
    const rowCount = Math.max(leftCells.length, rightCells.length);

    return (
      <div className="relative grid grid-cols-2 gap-x-4 gap-y-2">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-1/2 hidden w-px -translate-x-1/2 bg-border xl:block"
        />
        {Array.from({ length: rowCount }, (_, index) => (
          <React.Fragment key={index}>
            <div className="min-w-0 h-full">{leftCells[index] ?? null}</div>
            <div className="min-w-0 h-full">{rightCells[index] ?? null}</div>
          </React.Fragment>
        ))}
      </div>
    );
  };

  return (
    <Card
      className="flex-1 min-h-0 flex flex-col gap-0 overflow-hidden rounded-lg border bg-card shadow-subtle py-0"
      data-testid="edit-metadata-panel"
    >
      <CardContent className="flex flex-1 min-h-0 flex-col p-4">
        <div className="flex-1 min-h-0 overflow-y-auto">
          {!canWrite ? (
            <p
              className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300"
              data-testid="edit-metadata-read-only-notice"
            >
              Read-only access — contact admin
            </p>
          ) : null}
          {!serverOptions ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              No metadata fields available.
            </div>
          ) : (
            <div>{renderMetadataFields()}</div>
          )}
        </div>
        <div className="mt-4 flex shrink-0 items-center justify-end gap-2 border-t pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => (preResetSnapshot ? handleRestore() : handleReset())}
            disabled={!canWrite || isPrefillLoading || isSaving || !programId || !version}
          >
            {preResetSnapshot ? <RotateCw className="size-4" /> : <RotateCcw className="size-4" />}
            {preResetSnapshot ? 'Restore' : 'Reset'}
          </Button>
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={!saveEnabled}
            data-testid="edit-metadata-save"
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
  );
}
