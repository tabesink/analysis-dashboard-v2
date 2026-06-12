'use client';

import { useCallback, useMemo, type ComponentProps } from 'react';
import { Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { HierarchicalEventTree } from '@/components/dashboard/shared/HierarchicalEventTree';
import { useFilterState } from '@/hooks/use-filter-state';
import { useEventCatalog } from '@/hooks/use-event-catalog';
import { useEventTreeColorProps } from '@/hooks/use-event-tree-color-props';
import { SidePanelSection } from '@/components/shared';
import type { EventMetadata } from '@/types/api';

export type LoadDataEventTreeSectionProps = {
  sectionTitle: string;
  selectedEventIds: string[];
  onSelectedEventIdsChange: (nextSelectedEventIds: string[]) => void;
  events: EventMetadata[];
  isLoading: boolean;
  colorProps?: Partial<ComponentProps<typeof HierarchicalEventTree>>;
  isCollapsed?: boolean;
  onExpand?: () => void;
  emptyMessage?: string;
  emptySelectionSubtitle?: string;
  onSelectNone?: () => void;
};

export function LoadDataEventTreeSection({
  sectionTitle,
  selectedEventIds,
  onSelectedEventIdsChange,
  events,
  isLoading,
  colorProps = {},
  isCollapsed = false,
  onExpand,
  emptyMessage = 'No events available',
  emptySelectionSubtitle = 'Select events for analysis',
  onSelectNone,
}: LoadDataEventTreeSectionProps) {
  const selectedSet = useMemo(() => new Set(selectedEventIds), [selectedEventIds]);

  const isEventChecked = useCallback(
    (eventId: string) => selectedSet.has(eventId),
    [selectedSet],
  );

  const handleToggleEvent = useCallback(
    (eventId: string) => {
      const event = events.find((item) => item.event_id === eventId);
      if (event?.selectable_for_plotting === false) return;
      const nextSelectedEventIds = selectedSet.has(eventId)
        ? selectedEventIds.filter((id) => id !== eventId)
        : [...selectedEventIds, eventId];
      onSelectedEventIdsChange(nextSelectedEventIds);
    },
    [events, onSelectedEventIdsChange, selectedEventIds, selectedSet],
  );

  const handleBatchToggle = useCallback(
    (eventIds: string[], checked: boolean) => {
      const selectableIds = eventIds.filter((id) => {
        const event = events.find((item) => item.event_id === id);
        return event?.selectable_for_plotting !== false;
      });
      const selectableIdSet = new Set(selectableIds);
      const nextSelectedEventIds = checked
        ? [...new Set([...selectedEventIds, ...selectableIds])]
        : selectedEventIds.filter((id) => !selectableIdSet.has(id));
      onSelectedEventIdsChange(nextSelectedEventIds);
    },
    [events, onSelectedEventIdsChange, selectedEventIds],
  );

  const handleSelectAll = useCallback(() => {
    const allSelectableEventIds = events
      .filter((event) => event.selectable_for_plotting !== false)
      .map((event) => event.event_id);
    onSelectedEventIdsChange(allSelectableEventIds);
  }, [events, onSelectedEventIdsChange]);

  const handleSelectNone = useCallback(() => {
    if (onSelectNone) {
      onSelectNone();
      return;
    }
    onSelectedEventIdsChange([]);
  }, [onSelectNone, onSelectedEventIdsChange]);

  const sectionSubtitle =
    selectedEventIds.length > 0
      ? `${selectedEventIds.length} selected`
      : emptySelectionSubtitle;

  if (isCollapsed) {
    return (
      <Button
        variant="ghost"
        onClick={onExpand}
        className="p-2 rounded-lg transition-all text-muted-foreground hover:text-foreground hover:bg-accent"
        aria-label={`Expand ${sectionTitle} section`}
        title={sectionTitle}
      >
        <Database className="h-4 w-4" />
      </Button>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-5 w-32 rounded" />
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <SidePanelSection
      title={sectionTitle}
      subtitle={sectionSubtitle}
      defaultExpanded={true}
      contentClassName="overflow-x-auto"
    >
      <HierarchicalEventTree
        events={events}
        isChecked={isEventChecked}
        onToggleEvent={handleToggleEvent}
        onBatchSetChecked={handleBatchToggle}
        onSelectAll={handleSelectAll}
        onSelectNone={handleSelectNone}
        emptyMessage={emptyMessage}
        showExpandCollapseControls={false}
        defaultExpandPrograms={true}
        {...colorProps}
      />
    </SidePanelSection>
  );
}

export function LoadDataSection({
  isCollapsed = false,
  onExpand,
}: {
  isCollapsed?: boolean;
  onExpand?: () => void;
}) {
  const { dataState, updateDataState } = useFilterState();
  const { events, isLoading } = useEventCatalog();
  const colorProps = useEventTreeColorProps();

  return (
    <LoadDataEventTreeSection
      sectionTitle="Load Data"
      selectedEventIds={dataState.selected_event_ids}
      onSelectedEventIdsChange={(selected_event_ids) =>
        updateDataState({ selected_event_ids })
      }
      events={events}
      isLoading={isLoading}
      colorProps={colorProps}
      isCollapsed={isCollapsed}
      onExpand={onExpand}
      onSelectNone={() =>
        updateDataState({ selected_event_ids: [], program_ids: [], versions: [] })
      }
    />
  );
}
