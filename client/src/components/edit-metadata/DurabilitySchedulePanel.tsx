'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, RotateCcw, Save, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MetadataDialogHeader } from '@/components/edit-metadata/MetadataDialogHeader';
import {
  DialogCardFooter,
  DialogContentCard,
} from '@/components/shared/dialog-layout';
import { DurabilityScheduleTable } from '@/components/edit-metadata/DurabilityScheduleTable';
import { ScheduleUploadDialog } from '@/components/edit-metadata/ScheduleUploadDialog';
import type { DurabilityScheduleEditableField } from '@/components/edit-metadata/DurabilityScheduleTable';
import {
  buildDurabilityScheduleRows,
  discoverEventDelimiter,
  rowsFromSavedEventRows,
  type DurabilityScheduleRow,
} from '@/features/edit-metadata/lib/build-durability-schedule-rows';
import {
  isDurabilityScheduleDirty,
  parseOptionalScheduleNumber,
} from '@/features/edit-metadata/lib/durability-schedule-draft';
import { saveProgramVersionDurabilitySchedule } from '@/features/edit-metadata/lib/durability-schedule-save';
import { attachProgramVersionDurabilitySchedule } from '@/features/edit-metadata/lib/durability-schedule-upload';
import { applyScheduleDamageResponse } from '@/features/edit-metadata/lib/apply-schedule-damage-response';
import { buildDamageFieldHighlights } from '@/features/edit-metadata/lib/damage-validation-report';
import { useDamageCalculationStore } from '@/stores/damage-calculation-store';
import { dashboardApi, APIError } from '@/lib/api';

export interface DurabilitySchedulePanelScope {
  programId: string;
  version: string;
}

export interface DurabilitySchedulePanelProps {
  scope: DurabilitySchedulePanelScope;
  canWrite?: boolean;
  showUploadAffordance?: boolean;
  scopeAlert?: ReactNode;
  onDirtyChange?: (isDirty: boolean) => void;
}

export function DurabilitySchedulePanel({
  scope,
  canWrite = true,
  showUploadAffordance = true,
  scopeAlert,
  onDirtyChange,
}: DurabilitySchedulePanelProps) {
  const { programId, version } = scope;
  const queryClient = useQueryClient();
  const scheduleDamageReport = useDamageCalculationStore((state) =>
    programId && version ? state.scopes[`${programId}::${version}`]?.scheduleDamageReport ?? null : null,
  );
  const highlightedFieldsByRowId = useMemo(
    () => buildDamageFieldHighlights(scheduleDamageReport),
    [scheduleDamageReport],
  );
  const [isExtractingSchedule, setIsExtractingSchedule] = useState(false);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [scheduleDraftRows, setScheduleDraftRows] = useState<DurabilityScheduleRow[]>([]);
  const [baselineScheduleRows, setBaselineScheduleRows] = useState<DurabilityScheduleRow[]>([]);
  const [scheduleDraftMultiplier, setScheduleDraftMultiplier] = useState<number | null>(null);
  const [baselineScheduleMultiplier, setBaselineScheduleMultiplier] = useState<number | null>(null);
  const [scheduleDelimiterToken, setScheduleDelimiterToken] = useState<string | null>(null);
  const [baselineScheduleDelimiterToken, setBaselineScheduleDelimiterToken] =
    useState<string | null>(null);
  const scheduleInitKeyRef = useRef<string | null>(null);
  const scheduleRowsHydratedRef = useRef(false);

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
    enabled: Boolean(programId && version),
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  const scheduleQuery = useQuery({
    queryKey: ['program-version-schedule', programId, version],
    queryFn: async () => {
      try {
        return await dashboardApi.getProgramVersionSchedule(programId, version);
      } catch (error) {
        if (error instanceof APIError && error.status === 404) {
          return null;
        }
        throw error;
      }
    },
    enabled: Boolean(programId && version),
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  const hasAttachedSchedule = scheduleQuery.data != null;

  const isDurabilityScheduleLoading =
    scheduleQuery.isLoading || (hasAttachedSchedule && eventsQuery.isLoading);

  const isScheduleDirty = useMemo(
    () =>
      isDurabilityScheduleDirty(
        scheduleDraftRows,
        baselineScheduleRows,
        scheduleDraftMultiplier,
        baselineScheduleMultiplier,
      ),
    [
      scheduleDraftRows,
      baselineScheduleRows,
      scheduleDraftMultiplier,
      baselineScheduleMultiplier,
    ],
  );

  useEffect(() => {
    onDirtyChange?.(isScheduleDirty);
  }, [isScheduleDirty, onDirtyChange]);

  useEffect(() => {
    if (!programId || !version) {
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

    const scheduleData = scheduleQuery.data;
    const scheduleKey = `${programId}::${version}::${scheduleData.schedule_id}`;
    const isFreshSchedule = scheduleInitKeyRef.current !== scheduleKey;
    const savedRows = savedRowsOnServer;
    const multiplier = scheduleData.parse_preview.multiplier ?? null;
    let delimiter = scheduleData.parse_preview.delimiter_token ?? null;

    const buildRows = (): DurabilityScheduleRow[] => {
      const entries = scheduleData.parse_preview.entries ?? [];
      if (savedRows.length > 0) {
        return rowsFromSavedEventRows(savedRows, entries);
      }
      const events = eventsQuery.data?.events ?? [];
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
    programId,
    version,
    hasAttachedSchedule,
    scheduleQuery.data,
    eventsQuery.data,
    eventsQuery.isLoading,
  ]);

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
          return { ...row, weight: parseOptionalScheduleNumber(rawValue) };
        }
        if (field === 'repeats') {
          return { ...row, repeats: parseOptionalScheduleNumber(rawValue) };
        }
        return { ...row, scheduleSequence: parseOptionalScheduleNumber(rawValue) };
      }),
    );
  };

  const handleScheduleMultiplierChange = (rawValue: string) => {
    setScheduleDraftMultiplier(parseOptionalScheduleNumber(rawValue));
  };

  const handleResetSchedule = () => {
    setScheduleDraftRows(baselineScheduleRows);
    setScheduleDraftMultiplier(baselineScheduleMultiplier);
    setScheduleDelimiterToken(baselineScheduleDelimiterToken);
    toast.success('Schedule edits reset');
  };

  const handleSaveSchedule = async () => {
    if (!programId || !version || !hasAttachedSchedule) {
      return;
    }
    if (scheduleDraftMultiplier == null) {
      toast.error('Enter a global multiplier before saving');
      return;
    }

    const savingToastId = toast.loading(
      `Saving durability schedule for ${programId} / ${version}...`,
    );
    setIsSavingSchedule(true);
    try {
      const saved = await saveProgramVersionDurabilitySchedule({
        programId,
        version,
        draftRows: scheduleDraftRows,
        multiplier: scheduleDraftMultiplier,
        delimiterToken: scheduleDelimiterToken,
        queryClient,
      });
      setScheduleDraftRows(saved.draft.rows);
      setBaselineScheduleRows(saved.draft.rows);
      setScheduleDraftMultiplier(saved.draft.multiplier);
      setBaselineScheduleMultiplier(saved.draft.multiplier);
      setScheduleDelimiterToken(saved.draft.delimiterToken);
      setBaselineScheduleDelimiterToken(saved.draft.delimiterToken);
      applyScheduleDamageResponse({
        scope: { programId, version },
        queryClient,
        response: saved.response,
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

  const scheduleOperationInProgress = isSavingSchedule || isExtractingSchedule;

  const handleExtractSchedule = async (scheduleFile: File) => {
    if (!programId || !version) {
      return;
    }

    setIsExtractingSchedule(true);
    const extractingToastId = toast.loading('Extracting durability schedule...');
    try {
      const result = await attachProgramVersionDurabilitySchedule({
        programId,
        version,
        scheduleFile,
        queryClient,
      });
      applyScheduleDamageResponse({
        scope: { programId, version },
        queryClient,
        response: result,
      });
      toast.success(
        result.replaced_previous
          ? 'Durability schedule replaced for this program/version.'
          : 'Durability schedule extracted for this program/version.',
        { id: extractingToastId },
      );
      setUploadDialogOpen(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to extract durability schedule';
      toast.error(message, { id: extractingToastId });
    } finally {
      setIsExtractingSchedule(false);
    }
  };

  const renderScheduleActionFooter = () => {
    if (!canWrite) {
      return null;
    }

    return (
      <DialogCardFooter>
        {showUploadAffordance ? (
          <Button
            type="button"
            variant="outline"
            data-testid="durability-schedule-upload"
            onClick={() => setUploadDialogOpen(true)}
            disabled={
              scheduleOperationInProgress ||
              isDurabilityScheduleLoading ||
              !programId ||
              !version
            }
          >
            <Upload className="size-4" />
            Upload
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          data-testid="durability-schedule-reset"
          onClick={handleResetSchedule}
          disabled={
            !hasAttachedSchedule ||
            !isScheduleDirty ||
            scheduleOperationInProgress ||
            isDurabilityScheduleLoading
          }
        >
          <RotateCcw className="size-4" />
          Reset
        </Button>
        <Button
          type="button"
          data-testid="durability-schedule-save"
          onClick={() => void handleSaveSchedule()}
          disabled={
            !hasAttachedSchedule ||
            !isScheduleDirty ||
            scheduleOperationInProgress ||
            isDurabilityScheduleLoading
          }
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
      </DialogCardFooter>
    );
  };

  const scheduleContextBar =
    programId && version ? (
      <MetadataDialogHeader programId={programId} version={version} statusDraftValue={null} />
    ) : undefined;

  const scheduleCardProps = {
    'data-testid': 'durability-schedule-panel' as const,
    className: 'min-h-0 flex-1',
    bodyClassName: 'flex min-h-0 flex-1 flex-col',
    contextBar: scheduleContextBar,
    alertBar: scopeAlert,
  };

  const schedulePanelDataAttrs = {
    'data-testid': 'durability-schedule-panel',
    'data-scope': `${programId}::${version}`,
    'data-is-dirty': String(isScheduleDirty),
    'data-can-write': String(canWrite),
  } as const;

  const renderScheduleUploadDialog = () => {
    if (!showUploadAffordance || !canWrite || !programId || !version) {
      return null;
    }

    return (
      <ScheduleUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        programId={programId}
        version={version}
        disabled={!canWrite}
        isUploading={isExtractingSchedule}
        onUpload={handleExtractSchedule}
      />
    );
  };

  if (!programId || !version) {
    return (
      <div
        data-testid="durability-schedule-panel"
        className="flex items-center justify-center py-12 text-sm text-muted-foreground"
      >
        Select a Program ID and Version to edit its durability schedule.
      </div>
    );
  }

  if (isDurabilityScheduleLoading) {
    return (
      <div {...schedulePanelDataAttrs}>
        <DialogContentCard {...scheduleCardProps}>
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading durability schedule...
          </div>
        </DialogContentCard>
      </div>
    );
  }

  if (!hasAttachedSchedule) {
    return (
      <div {...schedulePanelDataAttrs} className="flex min-h-0 flex-1 flex-col gap-2">
        <DialogContentCard
          {...scheduleCardProps}
          footer={showUploadAffordance ? renderScheduleActionFooter() : undefined}
        >
          <div className="flex min-h-full flex-col items-center justify-center gap-4 py-12 text-center">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                No durability schedule is attached for this program/version.
              </p>
              {showUploadAffordance ? (
                <p className="text-xs text-muted-foreground">
                  Use Upload to attach a `.sch` schedule file.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Upload a `.sch` file in the side panel and click Extract to attach a schedule.
                </p>
              )}
            </div>
          </div>
        </DialogContentCard>
        {renderScheduleUploadDialog()}
      </div>
    );
  }

  if (!scheduleQuery.data) {
    return null;
  }

  return (
    <div {...schedulePanelDataAttrs} className="flex min-h-0 flex-1 flex-col gap-2">
      <DialogContentCard
        {...scheduleCardProps}
        footer={renderScheduleActionFooter() ?? undefined}
      >
        <DurabilityScheduleTable
          rows={scheduleDraftRows}
          globalMultiplier={scheduleDraftMultiplier}
          editable={canWrite}
          helperText={`Active schedule: ${
            scheduleQuery.data.parse_preview.schedule_id ?? scheduleQuery.data.source_filename
          }`}
          highlightedFieldsByRowId={highlightedFieldsByRowId}
          onRowChange={handleScheduleRowChange}
          onMultiplierChange={handleScheduleMultiplierChange}
        />
      </DialogContentCard>
      {renderScheduleUploadDialog()}
    </div>
  );
}
