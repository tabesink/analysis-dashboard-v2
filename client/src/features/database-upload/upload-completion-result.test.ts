import { describe, expect, it } from 'vitest';

import {
  buildUploadCancelledResult,
  buildUploadCompletionResult,
  buildUploadFailedResult,
} from '@/features/database-upload/upload-completion-result';
import type { UploadResponse } from '@/types/upload';

const baseResponse: UploadResponse = {
  success: true,
  files: [],
  event_ids: [],
  total_rows: 0,
  pending_channel_map: false,
};

describe('buildUploadCompletionResult', () => {
  it('keeps the normal import completion summary', () => {
    const result = buildUploadCompletionResult({
      response: {
        ...baseResponse,
        files: [{ filename: 'event.csv', success: true, row_count: 10, validation_issues: [] }],
        event_ids: ['event-1'],
      },
      elapsedSeconds: 12,
    });

    expect(result).toMatchObject({
      success: true,
      title: 'Import complete',
      message: 'Files were uploaded and processed successfully.',
      detailLines: ['1 file imported', '1 event created'],
    });
  });

  it('guides users to assign channels when upload is pending a channel map', () => {
    const result = buildUploadCompletionResult({
      response: {
        ...baseResponse,
        files: [{ filename: 'event.csv', success: true, row_count: 10, validation_issues: [] }],
        event_ids: ['event-1'],
        pending_channel_map: true,
      },
      elapsedSeconds: 12,
    });

    expect(result).toMatchObject({
      success: true,
      title: 'Assign channels to finish import',
      message: 'Files were uploaded, but channel assignment is required before derived data can run.',
      detailLines: [
        '1 file imported',
        '1 event created',
        'Open Edit Metadata and save Assign Channels to start channel reprocess.',
      ],
    });
  });
});

describe('upload terminal summaries', () => {
  it('builds a terminal failure summary', () => {
    const result = buildUploadFailedResult({
      errorMessage: 'Lost contact with the server during upload. Check server logs before retrying.',
      elapsedSeconds: 45,
    });

    expect(result).toEqual({
      success: false,
      title: 'Import failed',
      message: 'Lost contact with the server during upload. Check server logs before retrying.',
      elapsedSeconds: 45,
    });
  });

  it('builds a terminal cancelled summary', () => {
    const result = buildUploadCancelledResult(18);

    expect(result).toEqual({
      success: false,
      title: 'Import cancelled',
      message: 'Import was cancelled before completion.',
      elapsedSeconds: 18,
    });
  });
});
