import type { UploadCompletionResult } from '@/features/database-upload/upload-operation-types';
import type { UploadResponse } from '@/types/upload';

export function buildUploadCompletionResult(params: {
  response: UploadResponse;
  elapsedSeconds: number;
}): UploadCompletionResult {
  const fileCount = params.response.files.length;
  const eventCount = params.response.event_ids.length;
  const detailLines = [
    `${fileCount} file${fileCount === 1 ? '' : 's'} imported`,
    `${eventCount} event${eventCount === 1 ? '' : 's'} created`,
  ];

  if (params.response.pending_channel_map) {
    return {
      success: true,
      title: 'Assign channels to finish import',
      message: 'Files were uploaded, but channel assignment is required before derived data can run.',
      elapsedSeconds: params.elapsedSeconds,
      detailLines: [
        ...detailLines,
        'Open Edit Metadata and save Assign Channels to start channel reprocess.',
      ],
    };
  }

  return {
    success: true,
    title: 'Import complete',
    message: 'Files were uploaded and processed successfully.',
    elapsedSeconds: params.elapsedSeconds,
    detailLines,
  };
}

export function buildUploadFailedResult(params: {
  errorMessage: string;
  elapsedSeconds: number;
}): UploadCompletionResult {
  return {
    success: false,
    title: 'Import failed',
    message: params.errorMessage,
    elapsedSeconds: params.elapsedSeconds,
  };
}

export function buildUploadCancelledResult(elapsedSeconds: number): UploadCompletionResult {
  return {
    success: false,
    title: 'Import cancelled',
    message: 'Import was cancelled before completion.',
    elapsedSeconds,
  };
}
