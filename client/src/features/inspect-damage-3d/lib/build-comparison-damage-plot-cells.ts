import type { DamageComparisonViewModel } from '@/features/inspect-damage/lib/build-damage-comparison-view-model';
import type { DamagePlotType } from './damage-plot-overlay-types';
import type {
  DamageChannelDefinition,
  DamageChannelKey,
  DamagePlotCell,
} from './damage-plot-types';

const ALL_VERSIONS = 'All versions';

type BuildComparisonDamagePlotCellsInput = {
  viewModel: DamageComparisonViewModel;
  plotType: DamagePlotType;
  selectedChannelKeys: readonly string[];
  version: string | undefined;
  channels: readonly DamageChannelDefinition[];
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

function firstSelectedChannel(
  selectedChannels: readonly DamageChannelDefinition[],
): DamageChannelDefinition | null {
  return selectedChannels[0] ?? null;
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

function buildChannelTotalsCells(input: {
  viewModel: DamageComparisonViewModel;
  selectedChannels: readonly DamageChannelDefinition[];
  effectiveVersion: string | undefined;
}): DamagePlotCell[] {
  const aggregates = input.viewModel.aggregates;
  if (!aggregates) return [];
  const { selectedChannelSet, channelIndexByKey } = buildSelectedChannelLookup(
    input.selectedChannels,
  );
  const sums = new Map<string, {
    dataset: DatasetKey;
    channelKey: DamageChannelKey;
    value: number;
  }>();

  for (const row of aggregates.event_channel) {
    if (!selectedChannelSet.has(row.channel_key)) continue;
    if (input.effectiveVersion && input.effectiveVersion !== ALL_VERSIONS && row.version !== input.effectiveVersion) {
      continue;
    }
    const key = `${row.dataset}::${row.channel_key}`;
    const current = sums.get(key);
    sums.set(key, {
      dataset: row.dataset,
      channelKey: row.channel_key as DamageChannelKey,
      value: (current?.value ?? 0) + row.selected_value,
    });
  }

  return Array.from(sums.values()).flatMap((row) => {
    const channelIndex = getChannelIndex(channelIndexByKey, row.channelKey);
    if (channelIndex === null || !isFiniteNonNegative(row.value)) return [];
    const channel = input.selectedChannels[channelIndex];
    if (!channel) return [];
    const eventIndex = row.dataset === 'reference' ? 0 : 1;
    return makeCell({
      eventId: row.dataset,
      eventLabel: titleCaseDataset(row.dataset),
      eventIndex,
      version: input.effectiveVersion ?? ALL_VERSIONS,
      channel,
      channelIndex,
      damage: row.value,
    });
  });
}

function buildEventChannelCells(input: {
  viewModel: DamageComparisonViewModel;
  selectedChannels: readonly DamageChannelDefinition[];
  effectiveVersion: string | undefined;
}): DamagePlotCell[] {
  const aggregates = input.viewModel.aggregates;
  if (!aggregates) return [];
  const { selectedChannelSet, channelIndexByKey } = buildSelectedChannelLookup(
    input.selectedChannels,
  );
  const eventIndexByKey = new Map<string, number>();

  return aggregates.event_channel.flatMap((row) => {
    if (!selectedChannelSet.has(row.channel_key)) return [];
    if (input.effectiveVersion && input.effectiveVersion !== ALL_VERSIONS && row.version !== input.effectiveVersion) {
      return [];
    }
    if (!isFiniteNonNegative(row.selected_value)) return [];

    const eventKey = `${row.dataset}::${row.event_id}`;
    if (!eventIndexByKey.has(eventKey)) {
      eventIndexByKey.set(eventKey, eventIndexByKey.size);
    }
    const channelIndex = getChannelIndex(channelIndexByKey, row.channel_key);
    if (channelIndex === null) return [];
    const channel = input.selectedChannels[channelIndex];
    if (!channel) return [];

    return makeCell({
      eventId: eventKey,
      eventLabel: `${titleCaseDataset(row.dataset)} · ${row.event_id}`,
      eventIndex: eventIndexByKey.get(eventKey)!,
      version: row.version,
      channel,
      channelIndex,
      damage: row.selected_value,
      programId: row.program_id,
    });
  });
}

function buildProgramVersionCells(input: {
  viewModel: DamageComparisonViewModel;
  selectedChannels: readonly DamageChannelDefinition[];
  effectiveVersion: string | undefined;
}): DamagePlotCell[] {
  const aggregates = input.viewModel.aggregates;
  const channel = firstSelectedChannel(input.selectedChannels);
  if (!aggregates || !channel) return [];

  return aggregates.program_version.flatMap((row, index) => {
    if (input.effectiveVersion && input.effectiveVersion !== ALL_VERSIONS && row.version !== input.effectiveVersion) {
      return [];
    }
    if (!isFiniteNonNegative(row.selected_value)) return [];
    return makeCell({
      eventId: `${row.dataset}::${row.program_id}::${row.version}`,
      eventLabel: `${titleCaseDataset(row.dataset)} · ${row.program_id} / ${row.version}`,
      eventIndex: index,
      version: row.version,
      channel,
      channelIndex: 0,
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
    input.plotType === 'absolute_by_event'
      ? buildEventChannelCells({
          viewModel: input.viewModel,
          selectedChannels,
          effectiveVersion,
        })
      : input.plotType === 'cumulative_by_program_version'
        ? buildProgramVersionCells({
            viewModel: input.viewModel,
            selectedChannels,
            effectiveVersion,
          })
        : input.plotType === 'target_delta_vs_reference'
          ? buildDeltaCells({
              viewModel: input.viewModel,
              selectedChannels,
            })
          : buildChannelTotalsCells({
              viewModel: input.viewModel,
              selectedChannels,
              effectiveVersion,
            });

  return {
    cells,
    channels:
      input.plotType === 'cumulative_by_program_version'
        ? selectedChannels.slice(0, 1)
        : selectedChannels,
    versions,
    effectiveVersion,
    emptyMessage: 'No renderable comparison damage values are available for this selection.',
  };
}
