import { describe, expect, it } from 'vitest';
import type { EventMetadata } from '@/types/api';
import {
  buildDurabilityScheduleRows,
  discoverEventDelimiter,
  matchSchedulePattern,
  rowsFromSavedEventRows,
  rowsToSavePayload,
  rspEventNameFromFile,
} from '../lib/build-durability-schedule-rows';

const MF4E1_FILE = 'mf4e1_bt1cc_coil_2m24_lt27550r22_5dec22_lca_lr_app.rsp';
const MF4E3_100_FILE = 'mf4e3_100_bt1cc_coil_2m24_lt27550r22_5dec22_lca_lr_app.rsp';

function makeEvent(sourceFile: string, eventId = sourceFile): EventMetadata {
  return {
    event_id: eventId,
    program_id: 'P1',
    version: 'V1',
    status: 'Pending',
    source_file: sourceFile,
  };
}

describe('discoverEventDelimiter', () => {
  it('returns bt1cc for standard fixture filenames', () => {
    const delimiter = discoverEventDelimiter([MF4E1_FILE, MF4E3_100_FILE]);
    expect(delimiter).toBe('bt1cc');
  });

  it('returns null when no filenames are provided', () => {
    expect(discoverEventDelimiter([])).toBeNull();
  });
});

describe('rspEventNameFromFile', () => {
  it('joins tokens before delimiter for variant filenames', () => {
    expect(rspEventNameFromFile(MF4E3_100_FILE, 'bt1cc')).toBe('mf4e3_100');
  });

  it('returns the first segment for simple event filenames', () => {
    expect(rspEventNameFromFile(MF4E1_FILE, 'bt1cc')).toBe('mf4e1');
  });

  it('falls back to full stem when delimiter is absent from filename', () => {
    expect(rspEventNameFromFile('unmatched_event.rsp', 'bt1cc')).toBe('unmatched_event');
  });

  it('falls back to full stem when delimiter is null', () => {
    expect(rspEventNameFromFile('unmatched_event.rsp', null)).toBe('unmatched_event');
  });
});

describe('matchSchedulePattern', () => {
  it('returns the longest substring match', () => {
    expect(matchSchedulePattern('mf4e3_100_bt1cc_coil', ['4e1', 'mf4e3_100'])).toBe('mf4e3_100');
    expect(matchSchedulePattern('mf4e1_bt1cc_coil', ['4e1', 'other'])).toBe('4e1');
  });

  it('returns null when no pattern matches', () => {
    expect(matchSchedulePattern('unmatched_event', ['4e1'])).toBeNull();
  });
});

describe('saved row helpers', () => {
  it('round-trips saved event rows through display and save payload', () => {
    const built = rowsFromSavedEventRows([
      {
        event_id: 'evt-1',
        rsp_file_name: MF4E3_100_FILE,
        rsp_event_name: 'mf4e3_100',
        pattern: 'mf4e3_100',
        repeats: 16,
        weight: 0.15,
        schedule_sequence: 2,
      },
    ]);

    expect(built[0]?.schedulePattern).toBe('*mf4e3_100*');
    expect(rowsToSavePayload(built)[0]).toMatchObject({
      event_id: 'evt-1',
      pattern: 'mf4e3_100',
      repeats: 16,
      weight: 0.15,
      schedule_sequence: 2,
    });
  });

  it('adds visual placeholder rows for unmatched schedule patterns', () => {
    const built = rowsFromSavedEventRows(
      [
        {
          event_id: 'evt-1',
          rsp_file_name: MF4E3_100_FILE,
          rsp_event_name: 'mf4e3_100',
          pattern: 'mf4e3_100',
          repeats: 16,
          weight: 0.15,
          schedule_sequence: 2,
        },
      ],
      [
        { pattern: '4e1', repeats: 12, weight: 1.0 },
        { pattern: 'mf4e3_100', repeats: 16, weight: 0.15 },
        { pattern: 'missing_high_repeat', repeats: 9, weight: 0.4 },
        { pattern: 'missing_zero_repeat', repeats: 0, weight: 0.1 },
      ],
    );

    expect(built).toHaveLength(4);
    expect(built[0]).toMatchObject({
      rspFileName: '-',
      rspEventName: '-',
      schedulePattern: '*4e1*',
      repeats: 12,
      weight: 1.0,
      scheduleSequence: 1,
    });
    expect(built[1]).toMatchObject({
      rspFileName: MF4E3_100_FILE,
      rspEventName: 'mf4e3_100',
      schedulePattern: '*mf4e3_100*',
      repeats: 16,
      weight: 0.15,
      scheduleSequence: 2,
    });
    expect(built[2]).toMatchObject({
      rspFileName: '-',
      rspEventName: '-',
      schedulePattern: '*missing_high_repeat*',
      repeats: 9,
      weight: 0.4,
      scheduleSequence: 3,
    });
    expect(built[3]).toMatchObject({
      rspFileName: '-',
      rspEventName: '-',
      schedulePattern: '*missing_zero_repeat*',
      repeats: 0,
      weight: 0.1,
      scheduleSequence: 4,
    });
  });

  it('strips placeholder rows from save payload', () => {
    const built = rowsFromSavedEventRows(
      [
        {
          event_id: 'evt-1',
          rsp_file_name: MF4E3_100_FILE,
          rsp_event_name: 'mf4e3_100',
          pattern: 'mf4e3_100',
          repeats: 16,
          weight: 0.15,
          schedule_sequence: 2,
        },
      ],
      [
        { pattern: 'missing_high_repeat', repeats: 9, weight: 0.4 },
        { pattern: 'mf4e3_100', repeats: 16, weight: 0.15 },
      ],
    );

    expect(rowsToSavePayload(built)).toEqual([
      {
        event_id: 'evt-1',
        rsp_file_name: MF4E3_100_FILE,
        rsp_event_name: 'mf4e3_100',
        pattern: 'mf4e3_100',
        repeats: 16,
        weight: 0.15,
        schedule_sequence: 2,
      },
    ]);
  });
});

describe('buildDurabilityScheduleRows', () => {
  it('discovers delimiter, matches bare patterns, and sorts by schedule sequence', () => {
    const rows = buildDurabilityScheduleRows(
      [
        makeEvent(MF4E3_100_FILE),
        makeEvent(MF4E1_FILE),
        makeEvent('unmatched_event.rsp', 'event-unmatched'),
      ],
      [
        { pattern: '4e1', repeats: 12, weight: 1.0 },
        { pattern: 'mf4e3_100', repeats: 16, weight: 0.15 },
        { pattern: 'other', repeats: 3, weight: 0.5 },
      ],
    );

    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({
      rspFileName: MF4E1_FILE,
      rspEventName: 'mf4e1',
      schedulePattern: '*4e1*',
      scheduleSequence: 1,
      weight: 1.0,
      repeats: 12,
    });
    expect(rows[1]).toMatchObject({
      rspFileName: MF4E3_100_FILE,
      rspEventName: 'mf4e3_100',
      schedulePattern: '*mf4e3_100*',
      scheduleSequence: 2,
      weight: 0.15,
      repeats: 16,
    });
    expect(rows[2]).toMatchObject({
      rspFileName: '-',
      rspEventName: '-',
      schedulePattern: '*other*',
      scheduleSequence: 3,
      weight: 0.5,
      repeats: 3,
    });
    expect(rows[3]).toMatchObject({
      rspFileName: 'unmatched_event.rsp',
      rspEventName: 'unmatched_event',
      schedulePattern: '',
      scheduleSequence: null,
      weight: null,
      repeats: null,
    });
  });

  it('adds placeholders for every unmatched schedule pattern and sorts by sequence', () => {
    const rows = buildDurabilityScheduleRows(
      [makeEvent(MF4E3_100_FILE)],
      [
        { pattern: 'missing_first', repeats: 3, weight: 0.2 },
        { pattern: 'mf4e3_100', repeats: 16, weight: 0.15 },
        { pattern: 'missing_zero', repeats: 0, weight: 0.8 },
      ],
    );

    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      rspFileName: '-',
      rspEventName: '-',
      schedulePattern: '*missing_first*',
      scheduleSequence: 1,
      repeats: 3,
      weight: 0.2,
    });
    expect(rows[1]?.rspFileName).toBe(MF4E3_100_FILE);
    expect(rows[2]).toMatchObject({
      rspFileName: '-',
      rspEventName: '-',
      schedulePattern: '*missing_zero*',
      scheduleSequence: 3,
      repeats: 0,
      weight: 0.8,
    });
  });
});
