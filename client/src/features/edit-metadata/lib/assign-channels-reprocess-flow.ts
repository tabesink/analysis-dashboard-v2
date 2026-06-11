import type { QueryClient } from '@tanstack/react-query';

import { dashboardApi } from '@/lib/api';
import {
  trackChannelReprocessTask,
  type ChannelReprocessScope,
} from '@/stores/channel-reprocess-store';
import type { ChannelMapEditorEntry, DerivedTaskStartResponse } from '@/types/api';

function trackReprocessFromStart(params: {
  scope: ChannelReprocessScope;
  start: DerivedTaskStartResponse;
  queryClient: QueryClient;
}): void {
  trackChannelReprocessTask({
    scope: params.scope,
    taskId: params.start.task_id,
    queryClient: params.queryClient,
    reopenExisting: params.start.reused_existing_task,
  });
}

export async function startAssignChannelsSaveReprocess(params: {
  scope: ChannelReprocessScope;
  entries: ChannelMapEditorEntry[];
  queryClient: QueryClient;
}): Promise<DerivedTaskStartResponse> {
  const start = await dashboardApi.saveChannelMap({
    program_id: params.scope.programId,
    version: params.scope.version,
    entries: params.entries,
  });
  trackReprocessFromStart({
    scope: params.scope,
    start,
    queryClient: params.queryClient,
  });
  return start;
}

export async function startAssignChannelsUploadReprocess(params: {
  scope: ChannelReprocessScope;
  channelMapFile: File;
  queryClient: QueryClient;
}): Promise<DerivedTaskStartResponse> {
  const start = await dashboardApi.uploadChannelMap({
    program_id: params.scope.programId,
    version: params.scope.version,
    channelMapFile: params.channelMapFile,
  });
  trackReprocessFromStart({
    scope: params.scope,
    start,
    queryClient: params.queryClient,
  });
  return start;
}
