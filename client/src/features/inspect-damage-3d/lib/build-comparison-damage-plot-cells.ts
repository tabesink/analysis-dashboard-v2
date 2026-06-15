import type { DamageComparisonViewModel } from '@/features/inspect-damage/lib/build-damage-comparison-view-model';
import type { DamagePlotType } from './damage-plot-overlay-types';
import type {
  DamageChannelDefinition,
  DamagePlotCell,
} from './damage-plot-types';

const ALL_VERSIONS = 'All versions';

type BuildComparisonDamagePlotCellsInput = {
  viewModel: DamageComparisonViewModel;
  plotType: DamagePlotType;
  selectedChannelKeys: readonly string[];
  version: string | undefined;
  channels: readonly DamageChannelDefinition[];
  eventNameByEventId?: ReadonlyMap<string, string>;
};

type ComparisonDamagePlotCellsResult = {
  cells: DamagePlotCell[];
  channels: DamageChannelDefinition[];
  versions: string[];
  effectiveVersion: string | undefined;
  emptyMessage: string;
};

type DatasetKey = 'reference' | 'target';

function titleCaseDataset(dataset: DatasetKey): string {
  return dataset === 'reference' ? 'Reference' : 'Target';
}

function sortVersions(versions: Iterable<string>): string[] {
  return Array.from(new Set(versions))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function getSelectedChannels(
  channels: readonly DamageChannelDefinition[],
  selectedChannelKeys: readonly string[],
): DamageChannelDefinition[] {
  const selected = new Set(selectedChannelKeys);
  return channels.filter((channel) => selected.has(channel.key));
}

function getChannelIndex(
  channelIndexByKey: ReadonlyMap<string, number>,
  channelKey: string,
): number | null {
  return channelIndexByKey.get(channelKey) ?? null;
}

function buildSelectedChannelLookup(
  selectedChannels: readonly DamageChannelDefinition[],
): {
  selectedChannelSet: ReadonlySet<string>;
  channelIndexByKey: ReadonlyMap<string, number>;
} {
  return {
    selectedChannelSet: new Set<string>(selectedChannels.map((channel) => channel.key)),
    channelIndexByKey: new Map<string, number>(
      selectedChannels.map((channel, index) => [channel.key, index]),
    ),
  };
}

function makeCell(params: {
  eventId: string;
  eventLabel: string;
  eventIndex: number;
  version: string;
  channel: DamageChannelDefinition;
  channelIndex: number;
  damage: number;
  programId?: string | null;
}): DamagePlotCell {
  return {
    eventId: params.eventId,
    eventLabel: params.eventLabel,
    eventIndex: params.eventIndex,
    version: params.version,
    channelKey: params.channel.key,
    channelLabel: params.channel.label,
    channelIndex: params.channelIndex,
    damage: params.damage,
    metadata: {
      program_id: params.programId ?? null,
    },
  };
}

function isFiniteNonNegative(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function buildEventKey(dataset: DatasetKey, eventId: string): string {
  return `${dataset}::${eventId}`;
}

function buildEventLabel(
  dataset: DatasetKey,
  eventId: string,
  eventNameByEventId?: ReadonlyMap<string, string>,
): string {
  const rspEventName = eventNameByEventId?.get(eventId);
  if (rspEventName) return rspEventName;
  return `${titleCaseDataset(dataset)} · ${eventId}`;
}

function buildEventIndexByKey(
  rows: ReadonlyArray<{ dataset: DatasetKey; event_id: string }>,
  inspectEventIds: readonly string[],
): ReadonlyMap<string, number> {
  const eventIndexByKey = new Map<string, number>();
  const seen = new Set<string>();

  const appendEvents = (dataset: DatasetKey) => {
    for (const eventId of inspectEventIds) {
      const key = buildEventKey(dataset, eventId);
      if (seen.has(key)) continue;
      if (!rows.some((row) => row.dataset === dataset && row.event_id === eventId)) continue;
      eventIndexByKey.set(key, eventIndexByKey.size);
      seen.add(key);
    }
    for (const row of rows) {
      if (row.dataset !== dataset) continue;
      const key = buildEventKey(row.dataset, row.event_id);
      if (seen.has(key)) continue;
      eventIndexByKey.set(key, eventIndexByKey.size);
      seen.add(key);
    }
  };

  appendEvents('reference');
  appendEvents('target');
  return eventIndexByKey;
}

function buildEventChannelCells(input: {
  viewModel: DamageComparisonViewModel;
  selectedChannels: readonly DamageChannelDefinition[];
  effectiveVersion: string | undefined;
  eventNameByEventId?: ReadonlyMap<string, string>;
}): DamagePlotCell[] {
  const aggregates = input.viewModel.aggregates;
  if (!aggregates) return [];
  const { selectedChannelSet, channelIndexByKey } = buildSelectedChannelLookup(
    input.selectedChannels,
  );

  const filteredRows = aggregates.event_channel.filter((row) => {
    if (!selectedChannelSet.has(row.channel_key)) return false;
    if (
      input.effectiveVersion &&
      input.effectiveVersion !== ALL_VERSIONS &&
      row.version !== input.effectiveVersion
    ) {
      return false;
    }
    return isFiniteNonNegative(row.selected_value);
  });

  const eventIndexByKey = buildEventIndexByKey(filteredRows, input.viewModel.inspectEventIds);

  return filteredRows.flatMap((row) => {
    const channelIndex = getChannelIndex(channelIndexByKey, row.channel_key);
    if (channelIndex === null) return [];
    const channel = input.selectedChannels[channelIndex];
    if (!channel) return [];
    const eventKey = buildEventKey(row.dataset, row.event_id);
    const eventIndex = eventIndexByKey.get(eventKey);
    if (eventIndex === undefined) return [];

    return makeCell({
      eventId: row.event_id,
      eventLabel: buildEventLabel(row.dataset, row.event_id, input.eventNameByEventId),
      eventIndex,
      version: row.version,
      channel,
      channelIndex,
      damage: row.selected_value,
      programId: row.program_id,
    });
  });
}

function buildDeltaCells(input: {
  viewModel: DamageComparisonViewModel;
  selectedChannels: readonly DamageChannelDefinition[];
}): DamagePlotCell[] {
  const aggregates = input.viewModel.aggregates;
  if (!aggregates) return [];
  const { selectedChannelSet, channelIndexByKey } = buildSelectedChannelLookup(
    input.selectedChannels,
  );

  return aggregates.channel_delta.flatMap((row) => {
    if (!selectedChannelSet.has(row.channel_key)) return [];
    if (!isFiniteNumber(row.selected_value)) return [];
    const channelIndex = getChannelIndex(channelIndexByKey, row.channel_key);
    if (channelIndex === null) return [];
    const channel = input.selectedChannels[channelIndex];
    if (!channel) return [];
    const direction = row.absolute_delta > 0 ? 'Target higher' : row.absolute_delta < 0 ? 'Target lower' : 'No change';
    return makeCell({
      eventId: `delta::${row.channel_key}`,
      eventLabel: direction,
      eventIndex: 0,
      version: ALL_VERSIONS,
      channel,
      channelIndex,
      damage: Math.abs(row.selected_value),
    });
  });
}

export function getComparisonDamagePlotVersions(
  viewModel: DamageComparisonViewModel,
): string[] {
  if (!viewModel.aggregates) return [];
  const versions = sortVersions(
    viewModel.aggregates.event_channel.map((row) => row.version),
  );
  return versions.length > 1 ? [ALL_VERSIONS, ...versions] : versions;
}

export function buildComparisonDamagePlotCells(
  input: BuildComparisonDamagePlotCellsInput,
): ComparisonDamagePlotCellsResult {
  const selectedChannels = getSelectedChannels(input.channels, input.selectedChannelKeys);
  const versions = getComparisonDamagePlotVersions(input.viewModel);
  const effectiveVersion =
    input.version && versions.includes(input.version)
      ? input.version
      : versions[0];

  if (selectedChannels.length === 0) {
    return {
      cells: [],
      channels: [],
      versions,
      effectiveVersion,
      emptyMessage: 'Select one or more channels to render comparison damage.',
    };
  }

  const cells =
    input.plotType === 'target_delta_vs_reference'
      ? buildDeltaCells({
          viewModel: input.viewModel,
          selectedChannels,
        })
      : buildEventChannelCells({
          viewModel: input.viewModel,
          selectedChannels,
          effectiveVersion,
          eventNameByEventId: input.eventNameByEventId,
        });

  return {
    cells,
    channels: selectedChannels,
    versions,
    effectiveVersion,
    emptyMessage: 'No renderable comparison damage values are available for this selection.',
  };
}
