'use client';

import { Separator } from '@/components/ui/separator';
import { LoadDataEventTreeSection } from './LoadDataSection';
import type { DamageComparisonState, LoadDatasetSelectionState } from '@/types/damage-comparison';
import type { EventMetadata } from '@/types/api';

type ComparisonDatasetKey = keyof Pick<DamageComparisonState, 'reference' | 'target'>;

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
    onUpdateComparison({
      [dataset]: { selected_event_ids } as LoadDatasetSelectionState,
    });
  };

  return (
    <>
      <LoadDataEventTreeSection
        sectionTitle="Reference Load Data"
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
        sectionTitle="Target Load Data"
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
