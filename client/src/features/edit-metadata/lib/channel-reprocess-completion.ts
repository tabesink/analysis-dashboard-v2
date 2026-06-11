import type { DerivedTaskStatusEvent } from '@/types/api';
import type { UploadCompletionResult } from '@/features/database-upload/upload-operation-types';

interface ChannelReprocessResultCounts {
  processed_count?: number;
  failed_count?: number;
}

function readCounts(result: DerivedTaskStatusEvent): ChannelReprocessResultCounts {
  const payload = result.result;
  if (!payload || typeof payload !== 'object') {
    return {};
  }
  return payload as ChannelReprocessResultCounts;
}

export function buildChannelReprocessCompletionResult(
  event: DerivedTaskStatusEvent,
): UploadCompletionResult {
  if (event.status === 'failed') {
    return {
      success: false,
      title: 'Channel reprocess failed',
      message: event.error ?? 'Channel reprocess failed',
    };
  }

  const counts = readCounts(event);
  const processedCount = Number(counts.processed_count ?? event.completed_events ?? 0);
  const failedCount = Number(counts.failed_count ?? 0);
  const processedLabel = `Processed ${processedCount} file${processedCount === 1 ? '' : 's'}`;
  const failedLabel = `${failedCount} file${failedCount === 1 ? '' : 's'} failed`;

  if (failedCount > 0) {
    return {
      success: false,
      title: 'Channel reprocess finished with warnings',
      message: event.error ?? 'Some artifacts failed to reprocess.',
      detailLines: [processedLabel, failedLabel],
    };
  }

  return {
    success: true,
    title: 'Channel reprocess complete',
    message: 'Raw load histories and cross-plot data were generated.',
    detailLines: [processedLabel],
  };
}
