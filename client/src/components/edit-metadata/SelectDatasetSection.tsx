'use client';

import { AlertTriangle } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { SelectionMetadata } from '@/features/edit-metadata';

export interface SelectDatasetSectionProps {
  selectedProgramId: string;
  selectedVersion: string;
  programIds: string[];
  versions: string[];
  isProgramIdsLoading: boolean;
  isVersionsLoading: boolean;
  isPrefillLoading: boolean;
  isSaving: boolean;
  selectedEventMetadata: SelectionMetadata | null;
  formatTimestamp: (value: string | null) => string;
  onProgramIdChange: (value: string) => void;
  onVersionChange: (value: string) => void;
  hasAttachedSchedule?: boolean;
  isScheduleLoading?: boolean;
  missingChannelMap?: boolean;
  isChannelMapLoading?: boolean;
}

export function SelectDatasetSection({
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
  onProgramIdChange,
  onVersionChange,
  hasAttachedSchedule = false,
  isScheduleLoading = false,
  missingChannelMap = false,
  isChannelMapLoading = false,
}: SelectDatasetSectionProps) {
  const selectionComplete = Boolean(selectedProgramId && selectedVersion);
  return (
    <div className="space-y-4">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Program ID</p>
          <Select
            value={selectedProgramId}
            onValueChange={onProgramIdChange}
            disabled={isProgramIdsLoading || isPrefillLoading || isSaving}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select program ID" />
            </SelectTrigger>
            <SelectContent>
              {programIds.map((programId) => (
                <SelectItem key={programId} value={programId}>
                  {programId}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Version</p>
          <Select
            value={selectedVersion}
            onValueChange={onVersionChange}
            disabled={
              !selectedProgramId || isVersionsLoading || isPrefillLoading || isSaving
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select version" />
            </SelectTrigger>
            <SelectContent>
              {versions.map((version) => (
                <SelectItem key={version} value={version}>
                  {version}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-md border bg-muted/20 p-3 text-xs">
          <p className="font-medium text-foreground">Current Selection Summary</p>
          <div className="mt-2 space-y-1 text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Last update by:</span>{' '}
              {selectedEventMetadata?.lastUpdatedBy ?? 'N/A'}
            </p>
            <p>
              <span className="font-medium text-foreground">Last update time:</span>{' '}
              {formatTimestamp(selectedEventMetadata?.lastUpdatedAt ?? null)}
            </p>
            <p>
              <span className="font-medium text-foreground">Uploaded by:</span>{' '}
              {selectedEventMetadata?.uploadedBy ?? 'N/A'}
            </p>
            <p>
              <span className="font-medium text-foreground">Uploaded time:</span>{' '}
              {formatTimestamp(selectedEventMetadata?.uploadedAt ?? null)}
            </p>
            <p>
              <span className="font-medium text-foreground">Status:</span>{' '}
              {selectedEventMetadata?.status ?? 'N/A'}
            </p>
            {selectionComplete && !isScheduleLoading && !hasAttachedSchedule ? (
              <p className="flex items-start gap-1.5 pt-1 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
                No durability schedule is attached for this program/version.
              </p>
            ) : null}
            {selectionComplete && !isChannelMapLoading && missingChannelMap ? (
              <p className="flex items-start gap-1.5 pt-1 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
                Channels are not assigned for this program/version.
              </p>
            ) : null}
          </div>
        </div>
    </div>
  );
}
