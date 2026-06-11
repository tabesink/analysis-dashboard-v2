import { describe, expect, it } from 'vitest';

import {
  buildDamageFieldHighlights,
  formatDamageReportIssue,
} from '@/features/edit-metadata/lib/damage-validation-report';
import type { DamageFailureReport } from '@/types/api';

describe('damageValidationReport', () => {
  it('builds compact issue lines with event name and field message', () => {
    const line = formatDamageReportIssue({
      event_name: 'event_042',
      field: 'repeats',
      code: 'blank_repeats',
      message: 'Repeats is required.',
    });

    expect(line).toBe('event_042 · repeats: Repeats is required.');
  });

  it('maps report issues to row field highlights', () => {
    const report: DamageFailureReport = {
      summary: 'Fix schedule rows.',
      issues: [
        {
          event_id: 'row-1',
          event_name: 'event_042',
          field: 'repeats',
          code: 'blank_repeats',
          message: 'Repeats is required.',
        },
        {
          event_id: 'row-1',
          field: 'weight',
          code: 'blank_weight',
          message: 'Weight is required.',
        },
      ],
    };

    expect(buildDamageFieldHighlights(report)).toEqual({
      'row-1': ['repeats', 'weight'],
    });
  });
});
