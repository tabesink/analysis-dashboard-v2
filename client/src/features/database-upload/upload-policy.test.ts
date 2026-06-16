import { describe, expect, it, vi } from 'vitest';

import {
  buildUploadMetadataPayload,
  getMissingRequiredUploadFields,
  notifyUploadPreflightFeedback,
  summarizeUploadSelection,
} from './upload-policy';

const file = (name: string) => new File(['x'], name, { type: 'text/plain' });

describe('upload-policy selection summary', () => {
  it('classifies csv-only uploads with optional channel map and unsupported files', () => {
    const summary = summarizeUploadSelection([
      file('event-1.csv'),
      file('nested/event-2.csv'),
      file('channel_map.yaml'),
      file('notes.txt'),
    ]);

    expect(summary.dataCount).toBe(2);
    expect(summary.csvCount).toBe(2);
    expect(summary.rspCount).toBe(0);
    expect(summary.channelMapFile?.name).toBe('channel_map.yaml');
    expect(summary.hasMixedDataTypes).toBe(false);
    expect(summary.ignoredCount).toBe(1);
  });

  it('classifies rsp-only uploads', () => {
    const summary = summarizeUploadSelection([file('event-1.rsp'), file('event-2.rsp')]);

    expect(summary.dataCount).toBe(2);
    expect(summary.csvCount).toBe(0);
    expect(summary.rspCount).toBe(2);
    expect(summary.hasMixedDataTypes).toBe(false);
    expect(summary.ignoredCount).toBe(0);
  });

  it('flags mixed csv/rsp uploads', () => {
    const summary = summarizeUploadSelection([file('event-1.csv'), file('event-2.rsp')]);

    expect(summary.dataCount).toBe(2);
    expect(summary.hasMixedDataTypes).toBe(true);
  });
});

describe('upload-policy metadata mapping', () => {
  it('maps Program ID label to job_number payload and includes optional fields', () => {
    const result = buildUploadMetadataPayload(
      {
        'Program ID': 'JOB-10',
        'Load Version': 'v2',
        'Job Number': 'PRG-77',
        'Work Order': 'WO-9',
        GVW: '4500',
        Material: 'Steel',
        Status: 'Approved',
      },
      { isAdmin: true },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.metadata).toMatchObject({
      program_id: 'JOB-10',
      version: 'v2',
      job_number: 'PRG-77',
      work_order: 'WO-9',
      gvw: '4500',
      material_construction: 'Steel',
      status: 'Approved',
    });
  });

  it('reports missing required fields with stable user-facing labels', () => {
    expect(getMissingRequiredUploadFields({})).toEqual([
      'Program ID',
      'Load Version',
      'Job Number',
      'Work Order',
    ]);

    const result = buildUploadMetadataPayload(
      {
        'Program ID': '',
        'Load Version': '',
        'Job Number': '',
        'Work Order': '',
      },
      { isAdmin: false },
    );

    expect(result).toEqual({
      ok: false,
      missingField: 'Program ID',
      message: 'Please enter a Job ID',
    });
  });
});

describe('upload-policy preflight feedback', () => {
  it('emits expected toast feedback for mixed files and ignored files', () => {
    const notifier = {
      error: vi.fn(),
      info: vi.fn(),
    };

    const mixedSummary = summarizeUploadSelection([file('event-1.csv'), file('event-2.rsp')]);
    const mixedResult = buildUploadMetadataPayload(
      {
        'Program ID': 'JOB-10',
        'Load Version': 'v2',
        'Job Number': 'PRG-77',
        'Work Order': 'WO-9',
      },
      { isAdmin: false },
    );
    expect(
      notifyUploadPreflightFeedback({
        metadataResult: mixedResult,
        selectionSummary: mixedSummary,
        notifier,
      }),
    ).toBe(false);
    expect(notifier.error).toHaveBeenCalledWith('Upload either CSV files or RSP files, not both');

    notifier.error.mockClear();
    const ignoredSummary = summarizeUploadSelection([file('event-1.csv'), file('notes.txt')]);
    expect(
      notifyUploadPreflightFeedback({
        metadataResult: mixedResult,
        selectionSummary: ignoredSummary,
        notifier,
      }),
    ).toBe(true);
    expect(notifier.info).toHaveBeenCalledWith('1 unrelated file will be ignored');
  });
});
