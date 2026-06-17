'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { LoadingSpinner, SidePanelLayout } from '@/components/shared';
import { Skeleton } from '@/components/ui/skeleton';
import { GlobalFilters } from '@/components/dashboard/side-panel/GlobalFilters';
import {
  ComparisonLoadDataSections,
} from '@/components/dashboard/side-panel';
import { useEventCatalog } from '@/hooks/use-event-catalog';
import { useInspectDamageState } from '@/hooks/use-inspect-damage-state';
import { useInspectDamageSelectedEvents } from '@/hooks/use-inspect-damage-selected-events';
import { useDashboardWorkspace } from '@/modules/dashboard-workspace';
import { useAuthStore } from '@/stores/auth-store';
import { isDamageCalculationActive } from '@/stores/damage-calculation-store';
import { DAMAGE_CHANNELS } from '@/features/inspect-damage-3d/lib/damage-channel-axis';
import { DamagePlotView } from '@/features/inspect-damage-3d/components/DamagePlotView';
import { buildRspEventNameById } from '@/features/inspect-damage-3d/lib/resolve-rsp-event-name';
import {
  buildDamageComparisonViewModel,
  getComparisonInspectEventIds,
} from '@/features/inspect-damage/lib/build-damage-comparison-view-model';
import { damageApi } from '@/lib/api';
import type { DamageComparisonState } from '@/types/damage-comparison';

const DEFAULT_COMPARISON_CHANNEL_KEYS = DAMAGE_CHANNELS.map((channel) => channel.key);

export default function InspectDamagePage() {
  const router = useRouter();
  const authStatus = useAuthStore((s) => s.status);
  const [sidePanelCollapsed, setSidePanelCollapsed] = useState(false);
  const { comparison, updateComparison, isSessionReady } = useInspectDamageState();
  const { events, isLoading: isEventsLoading } = useEventCatalog();
  useDashboardWorkspace();
  const effectiveComparison = useMemo<DamageComparisonState>(
    () =>
      comparison.selected_channel_keys.length > 0
        ? comparison
        : {
            ...comparison,
            selected_channel_keys: DEFAULT_COMPARISON_CHANNEL_KEYS,
          },
    [comparison],
  );
  const comparisonInspectEventIds = useMemo(
    () => getComparisonInspectEventIds(effectiveComparison),
    [effectiveComparison],
  );
  const inspectEventIds = comparisonInspectEventIds;
  const { selectedEvents } = useInspectDamageSelectedEvents(
    inspectEventIds,
    events,
  );
  const eventNameByEventId = useMemo(() => buildRspEventNameById(selectedEvents), [selectedEvents]);
  const isPanelReady = isSessionReady && !isEventsLoading;
  const expandSidePanel = () => setSidePanelCollapsed(false);
  const inspectScopes = useMemo(
    () =>
      Array.from(
        new Map(
          selectedEvents.map((event) => [
            `${event.program_id}::${event.version}`,
            { programId: event.program_id, version: event.version },
          ]),
        ).values(),
      ),
    [selectedEvents],
  );
  const isDamageCalculationRunning = inspectScopes.some((scope) =>
    isDamageCalculationActive(scope),
  );
  const {
    data: damageResponse = null,
    error: inspectError,
  } = useQuery({
    queryKey: ['damage-inspect', inspectEventIds],
    queryFn: () => damageApi.inspect(inspectEventIds),
    enabled: inspectEventIds.length > 0,
    refetchInterval: isDamageCalculationRunning ? 2000 : false,
  });
  const comparisonViewModel = useMemo(
    () =>
      buildDamageComparisonViewModel({
        comparison: effectiveComparison,
        response: damageResponse,
      }),
    [damageResponse, effectiveComparison],
  );

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.replace('/login');
    }
  }, [authStatus, router]);

  if (authStatus === 'loading' || authStatus === 'idle') {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[calc(100vh-3.5rem)]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 min-h-[calc(100vh-3.5rem)]">
      <div className="flex gap-0 h-[calc(100vh-7rem)]">
        <SidePanelLayout
          isCollapsed={sidePanelCollapsed}
          onToggleCollapse={() => setSidePanelCollapsed((prev) => !prev)}
          expandedWidth="w-[320px]"
        >
          <ScrollArea className="flex-1 min-h-0 w-full">
            <div className="p-5 space-y-5">
              {!isPanelReady ? (
                <div className="space-y-4">
                  <Skeleton className="h-5 w-32 rounded" />
                  <Skeleton className="h-24 w-full rounded-lg" />
                </div>
              ) : (
                <>
                  <GlobalFilters
                    isCollapsed={sidePanelCollapsed}
                    onExpand={expandSidePanel}
                  />
                  <div className="py-1">
                    <Separator className="bg-border/70" />
                  </div>
                  <ComparisonLoadDataSections
                    comparison={comparison}
                    events={events}
                    isLoading={isEventsLoading}
                    onUpdateComparison={updateComparison}
                    isCollapsed={sidePanelCollapsed}
                    onExpand={expandSidePanel}
                  />
                </>
              )}
            </div>
          </ScrollArea>
        </SidePanelLayout>

        <div className="flex-1 min-w-0 min-h-0">
          <Card className="h-full min-w-0 flex-1 rounded-r-lg rounded-l-none flex flex-col gap-0 overflow-hidden shadow-subtle border py-0">
            {inspectError ? (
              <div className="m-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {inspectError.message}
              </div>
            ) : null}
            <DamagePlotView
              comparison={effectiveComparison}
              comparisonViewModel={comparisonViewModel}
              eventNameByEventId={eventNameByEventId}
              onUpdateComparison={updateComparison}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
