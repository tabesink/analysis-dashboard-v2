import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { DamageTableView } from '@/features/inspect-damage/components/DamageTableView';
import type { DamageInspectResponse, EventMetadata } from '@/types/api';

vi.mock('@/components/ui/collapsible', () => ({
  Collapsible: ({
    open,
    children,
  }: {
    open?: boolean;
    children: ReactNode;
  }) => <div data-collapsible-open={open ? 'true' : 'false'}>{children}</div>,
  CollapsibleContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CollapsibleTrigger: ({ children }: { children: ReactNode }) => (
    <button type="button">{children}</button>
  ),
}));

describe('DamageTableView', () => {
  it('renders version groups collapsed by default', () => {
    const events: EventMetadata[] = [
      {
        event_id: 'evt-1',
        program_id: 'P1',
        version: 'V1',
        status: 'Approved',
        job_number: 'JOB-1',
        work_order: 'WO-1',
      },
    ];
    const damageRowsByEventId = new Map<string, DamageInspectResponse['rows'][number]>([
      [
        'evt-1',
        {
          event_id: 'evt-1',
          program_id: 'P1',
          job_number: 'JOB-1',
          work_order: 'WO-1',
          damages: {
            channel_a: {
              damage: 0.25,
              base_damage: 0.25,
              status: 'current',
              error: null,
              stale_reason: null,
            },
          },
        },
      ],
    ]);
    const channelMetadata = new Map<string, DamageInspectResponse['channels'][number]>([
      [
        'channel_a',
        {
          channel_key: 'channel_a',
          channel_name: 'Channel A',
          unit: null,
        },
      ],
    ]);

    const html = renderToStaticMarkup(
      <DamageTableView
        events={events}
        damageRowsByEventId={damageRowsByEventId}
        channelMetadata={channelMetadata}
        isLoading={false}
        inspectError={null}
        viewState={{
          showEmptyState: false,
          showStaleWarning: false,
          showCalculateAction: false,
          showPrerequisiteGuidance: false,
          runningScopes: [],
          calculateScopes: [],
          prerequisiteReports: [],
          failureReports: [],
        }}
        isCalculatingDamage={false}
        preferencesLoaded={true}
        tablePreferences={null}
        onSetTablePreferences={vi.fn()}
        onResetTablePreferences={vi.fn()}
      />,
    );

    expect(html).toContain('data-collapsible-open="false"');
  });
});
