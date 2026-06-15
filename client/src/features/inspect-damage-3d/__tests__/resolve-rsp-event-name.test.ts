import { describe, expect, it } from 'vitest';
import { buildRspEventNameById, resolveRspEventName } from '../lib/resolve-rsp-event-name';

describe('resolveRspEventName', () => {
  it('derives the RSP event name from source_file when available', () => {
    expect(
      resolveRspEventName(
        {
          event_id: 'folder/mf4e3_100',
          source_file: 'mf4e3_100_bt1cc_coil.rsp',
        },
        'bt1cc',
      ),
    ).toBe('mf4e3_100');
  });

  it('falls back to the event display name when source_file is missing', () => {
    expect(
      resolveRspEventName({
        event_id: 'folder/ref-1',
        source_file: undefined,
      }),
    ).toBe('ref-1');
  });
});

describe('buildRspEventNameById', () => {
  it('builds a lookup map keyed by event_id', () => {
    expect(
      buildRspEventNameById([
        {
          event_id: 'evt-1',
          source_file: 'pattern_a_event.rsp',
        },
      ]).get('evt-1'),
    ).toBe('pattern_a_event');
  });

  it('discovers delimiter tokens across the selected event cohort', () => {
    expect(
      buildRspEventNameById([
        {
          event_id: 'evt-1',
          source_file: 'mf4e3_100_bt1cc_coil.rsp',
        },
        {
          event_id: 'evt-2',
          source_file: 'mf4e1_bt1cc_coil.rsp',
        },
      ]).get('evt-1'),
    ).toBe('mf4e3_100');
  });
});
