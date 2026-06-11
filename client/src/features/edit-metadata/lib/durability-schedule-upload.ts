import type { QueryClient } from '@tanstack/react-query';

import { dashboardApi } from '@/lib/api';
import type { DurabilityScheduleAttachResponse } from '@/types/api';

export async function attachProgramVersionDurabilitySchedule(params: {
  programId: string;
  version: string;
  scheduleFile: File;
  queryClient: QueryClient;
}): Promise<DurabilityScheduleAttachResponse> {
  const result = await dashboardApi.attachProgramVersionSchedule({
    programId: params.programId,
    version: params.version,
    scheduleFile: params.scheduleFile,
  });

  await params.queryClient.invalidateQueries({
    queryKey: ['program-version-schedule', params.programId, params.version],
  });

  return result;
}
