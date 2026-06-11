import type { QueryClient } from '@tanstack/react-query';

import {
  rowsFromSavedEventRows,
  rowsToSavePayload,
  type DurabilityScheduleRow,
} from '@/features/edit-metadata/lib/build-durability-schedule-rows';
import { dashboardApi } from '@/lib/api';
import type {
  DamageFailureReport,
  DurabilityScheduleContextResponse,
} from '@/types/api';

export interface SavedDurabilityScheduleDraft {
  rows: DurabilityScheduleRow[];
  multiplier: number;
  delimiterToken: string | null;
  damageTaskId?: string;
  damagePrerequisiteReport?: DamageFailureReport;
}

export interface SavedDurabilityScheduleResult {
  draft: SavedDurabilityScheduleDraft;
  response: DurabilityScheduleContextResponse;
}

export async function saveProgramVersionDurabilitySchedule(params: {
  programId: string;
  version: string;
  draftRows: DurabilityScheduleRow[];
  multiplier: number;
  delimiterToken: string | null;
  queryClient: QueryClient;
}): Promise<SavedDurabilityScheduleResult> {
  const result: DurabilityScheduleContextResponse = await dashboardApi.saveProgramVersionSchedule({
    program_id: params.programId,
    version: params.version,
    multiplier: params.multiplier,
    event_rows: rowsToSavePayload(params.draftRows),
    delimiter_token: params.delimiterToken,
  });

  await params.queryClient.invalidateQueries({
    queryKey: ['program-version-schedule', params.programId, params.version],
  });

  const savedRows = rowsFromSavedEventRows(
    result.parse_preview.event_rows ?? [],
    result.parse_preview.entries ?? [],
  );
  const savedMultiplier = result.parse_preview.multiplier ?? params.multiplier;
  const savedDelimiter = result.parse_preview.delimiter_token ?? params.delimiterToken;

  return {
    draft: {
      rows: savedRows,
      multiplier: savedMultiplier,
      delimiterToken: savedDelimiter,
      damageTaskId: result.damage_task_id,
      damagePrerequisiteReport: result.damage_prerequisite_report,
    },
    response: result,
  };
}
