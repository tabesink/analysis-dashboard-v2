'use client';

import { Separator } from '@/components/ui/separator';
import { showShortInfoToast } from '@/lib/feedback/short-info-toast';
import { LoadDataEventTreeSection } from './LoadDataSection';
import type { DamageComparisonState, LoadDatasetSelectionState } from '@/types/damage-comparison';
import type { EventMetadata } from '@/types/api';

type ComparisonDatasetKey = keyof Pick<DamageComparisonState, 'reference' | 'target'>;

function getEventScopeKey(event: Pick<EventMetadata, 'program_id' | 'version'>): string {
  return `${event.program_id}::${event.version}`;
}

function selectedIdsEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

export function enforceSingleProgramVersionScope(params: {
  currentSelectedEventIds: string[];
  nextSelectedEventIds: string[];
  events: EventMetadata[];
}): string[] {
  const { currentSelectedEventIds, nextSelectedEventIds, events } = params;
  if (nextSelectedEventIds.length <= 1) return nextSelectedEventIds;

  const eventById = new Map(events.map((event) => [event.event_id, event]));
  const scopeToEventIds = new Map<string, string[]>();

  for (const eventId of nextSelectedEventIds) {
    const event = eventById.get(eventId);
    if (!event) continue;
    const scopeKey = getEventScopeKey(event);
    const scopedIds = scopeToEventIds.get(scopeKey);
    if (scopedIds) {
      scopedIds.push(eventId);
    } else {
      scopeToEventIds.set(scopeKey, [eventId]);
    }
  }

  if (scopeToEventIds.size <= 1) {
    return nextSelectedEventIds;
  }

  const previousIds = new Set(currentSelectedEventIds);
  const newlyAddedIds = nextSelectedEventIds.filter((eventId) => !previousIds.has(eventId));
  const latestAddedId = newlyAddedIds.at(-1);
  const latestAddedScope = latestAddedId
    ? eventById.get(latestAddedId)
    : undefined;

  if (latestAddedScope && latestAddedId) {
    const scopeKey = getEventScopeKey(latestAddedScope);
    return scopeToEventIds.get(scopeKey) ?? [latestAddedId];
  }

  const fallbackScopeIds = scopeToEventIds.values().next().value as string[] | undefined;
  return fallbackScopeIds ?? nextSelectedEventIds;
}

export function resolveComparisonLoadDataEmptyMessage(params: {
  dataset: ComparisonDatasetKey;
  visibleEventCount: number;
  selectableEventCount: number;
  referenceSelectedCount: number;
  targetSelectedCount: number;
}): string {
  const {
    dataset,
    visibleEventCount,
    selectableEventCount,
    referenceSelectedCount,
    targetSelectedCount,
  } = params;

  if (visibleEventCount === 0) {
    return 'No events match current filters';
  }
  if (selectableEventCount === 0) {
    return 'No selectable events available for comparison';
  }
  if (dataset === 'reference' && referenceSelectedCount === 0 && targetSelectedCount > 0) {
    return 'Select Reference events to compare against Target';
  }
  if (dataset === 'target' && targetSelectedCount === 0 && referenceSelectedCount > 0) {
    return 'Select Target events to compare against Reference';
  }
  return 'No events available';
}

export function ComparisonLoadDataSections({
  comparison,
  events,
  isLoading,
  onUpdateComparison,
  isCollapsed = false,
  onExpand,
}: {
  comparison: DamageComparisonState;
  events: EventMetadata[];
  isLoading: boolean;
  onUpdateComparison: (patch: Partial<DamageComparisonState>) => void;
  isCollapsed?: boolean;
  onExpand?: () => void;
}) {
  const referenceSelectedCount = comparison.reference.selected_event_ids.length;
  const targetSelectedCount = comparison.target.selected_event_ids.length;
  const selectableEventCount = events.filter(
    (event) => event.selectable_for_plotting !== false,
  ).length;

  const updateSelection = (
    dataset: ComparisonDatasetKey,
    selected_event_ids: string[],
  ) => {
    const currentSelectedEventIds = comparison[dataset].selected_event_ids;
    const normalizedSelectedEventIds = enforceSingleProgramVersionScope({
      currentSelectedEventIds,
      nextSelectedEventIds: selected_event_ids,
      events,
    });

    if (
      selected_event_ids.length > 0 &&
      !selectedIdsEqual(selected_event_ids, normalizedSelectedEventIds)
    ) {
      const sideLabel = dataset === 'reference' ? 'Reference' : 'Target';
      showShortInfoToast(
        `${sideLabel} can include one program/version scope at a time. Selection moved to the new scope.`,
      );
    }

    onUpdateComparison({
      [dataset]: { selected_event_ids: normalizedSelectedEventIds } as LoadDatasetSelectionState,
    });
  };
  return (
    <>
      <LoadDataEventTreeSection
        sectionTitle="Load Data (Reference)"
        selectedEventIds={comparison.reference.selected_event_ids}
        onSelectedEventIdsChange={(selected_event_ids) =>
          updateSelection('reference', selected_event_ids)
        }
        events={events}
        isLoading={isLoading}
        isCollapsed={isCollapsed}
        onExpand={onExpand}
        emptySelectionSubtitle="Select Reference events for comparison"
        emptyMessage={resolveComparisonLoadDataEmptyMessage({
          dataset: 'reference',
          visibleEventCount: events.length,
          selectableEventCount,
          referenceSelectedCount,
          targetSelectedCount,
        })}
      />
      <div className="py-1">
        <Separator className="bg-border/70" />
      </div>
      <LoadDataEventTreeSection
        sectionTitle="Load Data (Target)"
        selectedEventIds={comparison.target.selected_event_ids}
        onSelectedEventIdsChange={(selected_event_ids) =>
          updateSelection('target', selected_event_ids)
        }
        events={events}
        isLoading={isLoading}
        isCollapsed={isCollapsed}
        onExpand={onExpand}
        emptySelectionSubtitle="Select Target events for comparison"
        emptyMessage={resolveComparisonLoadDataEmptyMessage({
          dataset: 'target',
          visibleEventCount: events.length,
          selectableEventCount,
          referenceSelectedCount,
          targetSelectedCount,
        })}
      />
    </>
  );
}
