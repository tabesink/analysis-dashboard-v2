'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertCircle, Info, Loader2, RotateCcw, RotateCw, Save, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ChannelMapUploadDialog } from '@/components/edit-metadata/ChannelMapUploadDialog';
import { CsvPreviewTable } from '@/features/database/datasets';
import { getPlotDisplayTitle } from '@/config/constants';
import {
  CHANNEL_MAP_DATA_ROW_COUNT,
  CHANNEL_MAP_PADDING_ROW_COUNT,
  CHANNEL_MAP_PLOT_TABLE_GRID_COLS,
  CHANNEL_MAP_PREVIEW_FALLBACK_COLUMN_COUNT,
  DEFAULT_CHANNEL_MAP_DRAFT,
  FIXED_CHANNEL_MAP_PLOTS,
  type ChannelMapDraft,
} from '@/features/edit-metadata/lib/channel-map-constants';
import {
  startAssignChannelsSaveReprocess,
  startAssignChannelsUploadReprocess,
} from '@/features/edit-metadata/lib/assign-channels-reprocess-flow';
import { dashboardApi } from '@/lib/api';
import type { ChannelMapEditorEntry } from '@/types/api';

export interface AssignChannelsPanelScope {
  programId: string;
  version: string;
}

export interface AssignChannelsPanelProps {
  scope: AssignChannelsPanelScope;
  canWrite?: boolean;
  onDirtyChange?: (isDirty: boolean) => void;
}

function hydrateChannelMapDraft(
  entries: Array<{ plot_key: string; x_col: number; y_col: number }>,
): ChannelMapDraft {
  const next = { ...DEFAULT_CHANNEL_MAP_DRAFT };
  for (const entry of entries) {
    next[entry.plot_key] = {
      x_col: String(entry.x_col),
      y_col: String(entry.y_col),
    };
  }
  return next;
}

function cloneChannelMapDraft(draft: ChannelMapDraft): ChannelMapDraft {
  return Object.fromEntries(
    FIXED_CHANNEL_MAP_PLOTS.map((plotKey) => [
      plotKey,
      { ...(draft[plotKey] ?? { x_col: '', y_col: '' }) },
    ]),
  );
}

export function AssignChannelsPanel({
  scope,
  canWrite = true,
  onDirtyChange,
}: AssignChannelsPanelProps) {
  const { programId, version } = scope;
  const queryClient = useQueryClient();
  const [channelMapDraft, setChannelMapDraft] = useState<ChannelMapDraft>({
    ...DEFAULT_CHANNEL_MAP_DRAFT,
  });
  const [baselineDraft, setBaselineDraft] = useState<ChannelMapDraft>({
    ...DEFAULT_CHANNEL_MAP_DRAFT,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [preResetSnapshot, setPreResetSnapshot] = useState<ChannelMapDraft | null>(null);
  const channelMapOperationInProgress = isSaving || isUploading;

  const channelMapQuery = useQuery({
    queryKey: ['channel-map-editor', programId, version],
    queryFn: () => dashboardApi.getChannelMapEditor(programId, version),
    enabled: Boolean(programId && version),
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    const data = channelMapQuery.data;
    if (!data) {
      setChannelMapDraft({ ...DEFAULT_CHANNEL_MAP_DRAFT });
      setBaselineDraft({ ...DEFAULT_CHANNEL_MAP_DRAFT });
      setPreResetSnapshot(null);
      return;
    }
    const hydrated = hydrateChannelMapDraft(data.entries);
    setChannelMapDraft(hydrated);
    setBaselineDraft(hydrated);
    setPreResetSnapshot(null);
  }, [channelMapQuery.data]);

  const isDirty = useMemo(
    () => JSON.stringify(channelMapDraft) !== JSON.stringify(baselineDraft),
    [channelMapDraft, baselineDraft],
  );

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const setChannelMapValue = (plotKey: string, axis: 'x_col' | 'y_col', value: string) => {
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
    if (!programId || !version) {
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

    setIsSaving(true);
    try {
      await startAssignChannelsSaveReprocess({
        scope: { programId, version },
        entries,
        queryClient,
      });
      const savedDraft = cloneChannelMapDraft(channelMapDraft);
      setBaselineDraft(savedDraft);
      setPreResetSnapshot(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save channel map';
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    try {
      setPreResetSnapshot(cloneChannelMapDraft(channelMapDraft));
      setChannelMapDraft(cloneChannelMapDraft(baselineDraft));
      toast.success('Channel map values reset');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to reset channel map values';
      toast.error(message);
    }
  };

  const handleUploadChannelMap = async (file: File) => {
    if (!programId || !version) {
      toast.error('Select Program ID and Version first');
      return;
    }

    setUploadDialogOpen(false);
    setIsUploading(true);
    try {
      await startAssignChannelsUploadReprocess({
        scope: { programId, version },
        channelMapFile: file,
        queryClient,
      });
      setPreResetSnapshot(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to upload channel map';
      toast.error(message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRestore = () => {
    if (!preResetSnapshot) {
      return;
    }
    try {
      setChannelMapDraft(cloneChannelMapDraft(preResetSnapshot));
      setPreResetSnapshot(null);
      toast.success('Pre-reset values restored');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to restore channel map values';
      toast.error(message);
    }
  };

  if (!programId || !version) {
    return (
      <div
        data-testid="assign-channels-panel"
        className="flex h-full items-center justify-center text-sm text-muted-foreground"
      >
        Select a Program ID and Version to edit its channel map.
      </div>
    );
  }

  return (
    <Card
      data-testid="assign-channels-panel"
      data-scope={`${programId}::${version}`}
      data-is-dirty={String(isDirty)}
      data-can-write={String(canWrite)}
      className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden rounded-lg border bg-card py-0 shadow-subtle"
    >
      <CardContent className="flex min-h-0 flex-1 flex-col p-4">
      {channelMapQuery.isLoading ? (
        <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading channel map...
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-card">
        <div className="flex items-start gap-1.5 border-b px-3 py-1.5 text-xs leading-5 text-muted-foreground">
          <Info
            className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <p className="min-w-0">
            Enter the zero-based column index from the CSV preview in x and y to assign each
            plot&apos;s axis data. The index numbers are shown in the row above the column headers.
          </p>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
          <div className="flex min-h-0 shrink-0 flex-col overflow-hidden bg-card lg:border-r">
            <div className="h-full overflow-hidden">
              <div className="sticky top-0 z-10 shrink-0 bg-card">
                <div className="h-7 shrink-0 border-b bg-muted/60" aria-hidden="true" />
                <div
                  className={`grid h-8 shrink-0 ${CHANNEL_MAP_PLOT_TABLE_GRID_COLS} border-b bg-muted/40 text-[11px] font-medium leading-none text-muted-foreground`}
                >
                  <div className="flex h-8 items-center border-r border-border bg-muted/40 px-3 text-foreground">
                    <span>Plot</span>
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
                    className={`grid h-8 shrink-0 ${CHANNEL_MAP_PLOT_TABLE_GRID_COLS} border-b transition-colors hover:bg-muted/30`}
                  >
                    <div
                      className="flex h-8 items-center border-b border-r border-border bg-muted/40 px-3"
                      title={plotDisplayTitle}
                    >
                      <span className="whitespace-nowrap text-xs leading-none text-foreground">
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
                        readOnly={!canWrite}
                        disabled={!canWrite}
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
                        readOnly={!canWrite}
                        disabled={!canWrite}
                        className="h-8 w-full rounded-none border-0 bg-transparent px-1 text-center text-xs md:text-xs tabular-nums leading-none text-foreground shadow-none focus-visible:border-transparent focus-visible:ring-0"
                      />
                    </div>
                  </div>
                );
              })}
              {Array.from({ length: CHANNEL_MAP_PADDING_ROW_COUNT }, (_, index) => (
                <div
                  key={`channel-map-padding-${index}`}
                  className={`grid h-8 shrink-0 ${CHANNEL_MAP_PLOT_TABLE_GRID_COLS} border-b`}
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
        <div className="mt-4 flex shrink-0 items-center justify-end gap-2 border-t pt-4">
          <Button
            type="button"
            variant="outline"
            data-testid="assign-channels-upload"
            onClick={() => setUploadDialogOpen(true)}
            disabled={!canWrite || channelMapOperationInProgress || channelMapQuery.isLoading}
          >
            <Upload className="size-4" />
            Upload
          </Button>
          <Button
            type="button"
            variant="outline"
            data-testid="assign-channels-reset"
            onClick={() => (preResetSnapshot ? handleRestore() : handleReset())}
            disabled={!canWrite || channelMapOperationInProgress || channelMapQuery.isLoading}
          >
            {preResetSnapshot ? <RotateCw className="size-4" /> : <RotateCcw className="size-4" />}
            {preResetSnapshot ? 'Restore' : 'Reset'}
          </Button>
          <Button
            type="button"
            data-testid="assign-channels-save"
            onClick={() => void handleSaveChannelMap()}
            disabled={
              channelMapOperationInProgress || !canWrite || !channelMapQuery.data?.column_count
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
      </div>
      </CardContent>

      <ChannelMapUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        programId={programId}
        version={version}
        disabled={!canWrite}
        isUploading={isUploading}
        onUpload={handleUploadChannelMap}
      />

      {channelMapQuery.data?.missing_channel_map ? (
        <div className="px-4 pb-4 text-xs leading-4 text-muted-foreground">
          <span className="inline-flex items-center gap-1 text-destructive">
            <AlertCircle className="size-3.5" />
            Channel map required before these files can be plotted.
          </span>
        </div>
      ) : null}
    </Card>
  );
}
