// @vitest-environment happy-dom

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { DamageComparisonViewModel } from '@/features/inspect-damage/lib/build-damage-comparison-view-model';
import type { DamageComparisonState, DamageComparisonValueMode } from '@/types/damage-comparison';
import { DamagePlotView } from './DamagePlotView';

type CapturedPlotInputsProps = {
  selectedChannelKeys: string[];
  valueMode: DamageComparisonValueMode;
  eventThreshold: number;
  onChannelToggle: (channelKey: string) => void;
  onValueModeChange: (valueMode: DamageComparisonValueMode) => void;
  onEventThresholdChange: (eventThreshold: number) => void;
};
const capturedPlotInputs: CapturedPlotInputsProps[] = [];
const toastError = vi.fn();

vi.mock('@/components/dashboard/side-panel/ComparisonPlotInputsSection', () => ({
  ComparisonPlotInputsSection: (props: CapturedPlotInputsProps) => {
    capturedPlotInputs.push(props);
    return <div data-testid="comparison-plot-inputs" />;
  },
}));

vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
  },
}));

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const comparison: DamageComparisonState = {
  reference: { selected_event_ids: ['ref-1'] },
  target: { selected_event_ids: ['target-1'] },
  selected_channel_keys: ['bj_x_force', 'bj_y_force'],
  value_mode: 'absolute',
  aggregation_event_scope: 'selected_only',
};

const comparisonViewModel: DamageComparisonViewModel = {
  inspectEventIds: ['ref-1', 'target-1'],
  emptyState: null,
  selectionSummary: {
    referenceEventCount: 1,
    targetEventCount: 1,
    channelCount: 2,
    valueMode: 'absolute',
  },
  subtitleText: '',
  legendText: '',
  aggregates: {
    program_version: [
      {
        dataset: 'reference',
        program_id: 'Program-A',
        version: 'v1',
        absolute_damage: 14,
        normalized_damage: 0.35,
        selected_value: 14,
      },
      {
        dataset: 'target',
        program_id: 'Program-B',
        version: 'v2',
        absolute_damage: 38,
        normalized_damage: 0.76,
        selected_value: 38,
      },
    ],
    event_channel: [
      {
        dataset: 'reference',
        event_id: 'ref-1',
        program_id: 'Program-A',
        version: 'v1',
        channel_key: 'bj_x_force',
        channel_label: 'BJ X Force',
        absolute_damage: 10,
        normalized_damage: 0.5,
        selected_value: 10,
      },
      {
        dataset: 'target',
        event_id: 'target-1',
        program_id: 'Program-B',
        version: 'v2',
        channel_key: 'bj_x_force',
        channel_label: 'BJ X Force',
        absolute_damage: 30,
        normalized_damage: 0.6,
        selected_value: 30,
      },
    ],
    channel: [
      {
        dataset: 'reference',
        channel_key: 'bj_x_force',
        channel_label: 'BJ X Force',
        absolute_damage: 10,
        normalized_damage: 0.5,
        selected_value: 10,
      },
      {
        dataset: 'target',
        channel_key: 'bj_x_force',
        channel_label: 'BJ X Force',
        absolute_damage: 30,
        normalized_damage: 0.6,
        selected_value: 30,
      },
      {
        dataset: 'reference',
        channel_key: 'bj_y_force',
        channel_label: 'BJ Y Force',
        absolute_damage: 4,
        normalized_damage: 0.2,
        selected_value: 4,
      },
      {
        dataset: 'target',
        channel_key: 'bj_y_force',
        channel_label: 'BJ Y Force',
        absolute_damage: 8,
        normalized_damage: 0.16,
        selected_value: 8,
      },
    ],
    channel_delta: [
      {
        channel_key: 'bj_x_force',
        channel_label: 'BJ X Force',
        reference_damage: 10,
        target_damage: 30,
        reference_normalized: 0.5,
        target_normalized: 0.6,
        absolute_delta: 20,
        percent_difference: 200,
        ratio: 3,
        normalized_ratio: 1.2,
        low_reference: false,
        low_reference_reason: null,
        selected_metric: 'absolute_delta',
        selected_value: 20,
      },
      {
        channel_key: 'bj_y_force',
        channel_label: 'BJ Y Force',
        reference_damage: 4,
        target_damage: 8,
        reference_normalized: 0.2,
        target_normalized: 0.16,
        absolute_delta: 4,
        percent_difference: 100,
        ratio: 2,
        normalized_ratio: 0.8,
        low_reference: false,
        low_reference_reason: null,
        selected_metric: 'absolute_delta',
        selected_value: 4,
      },
    ],
    meta: {
      value_mode: 'absolute',
      low_reference_threshold: 1e-12,
      program_version: { normalized_denominator: 'dataset_total_damage' },
      event_channel: { normalized_denominator: 'dataset_total_damage' },
      channel: { normalized_denominator: 'dataset_total_damage' },
      channel_delta: {
        normalized_denominator: 'target_channel_share_over_reference_channel_share',
      },
    },
  },
};

function renderPlotView(
  overrides: Partial<DamageComparisonState> = {},
  onUpdateComparison: (patch: Partial<DamageComparisonState>) => void = () => {},
) {
  capturedPlotInputs.length = 0;
  return renderToStaticMarkup(
    <DamagePlotView
      comparison={{ ...comparison, ...overrides }}
      comparisonViewModel={comparisonViewModel}
      onUpdateComparison={onUpdateComparison}
    />,
  );
}

describe('DamagePlotView', () => {
  it('renders a Customize button in the damage plots header', () => {
    const markup = renderPlotView();

    expect(markup).toContain('aria-label="Customize plots"');
    expect(markup).toContain('Customize');
  });

  it('toggles selected channels from Customize controls', () => {
    const onUpdateComparison = vi.fn();
    renderPlotView({}, onUpdateComparison);

    capturedPlotInputs[0]?.onChannelToggle('bj_y_force');
    expect(onUpdateComparison).toHaveBeenCalledWith({
      selected_channel_keys: ['bj_x_force'],
    });
  });

  it('prevents deselecting the final channel from Customize controls', () => {
    toastError.mockClear();
    const onUpdateComparison = vi.fn();
    renderPlotView({ selected_channel_keys: ['bj_x_force'] }, onUpdateComparison);

    capturedPlotInputs[0]?.onChannelToggle('bj_x_force');
    expect(onUpdateComparison).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith('At least one channel must be selected');
  });

  it('updates comparison value mode from Customize controls', () => {
    const onUpdateComparison = vi.fn();
    renderPlotView({}, onUpdateComparison);

    capturedPlotInputs[0]?.onValueModeChange('normalized');
    expect(onUpdateComparison).toHaveBeenCalledWith({ value_mode: 'normalized' });
  });

  it('passes the default event threshold to Customize controls', () => {
    renderPlotView();

    expect(capturedPlotInputs[0]?.eventThreshold).toBe(5);
  });

  it('does not render the in-plot damage scale toggle', () => {
    const markup = renderPlotView();

    expect(markup).not.toContain('aria-label="Damage scale"');
    expect(markup).not.toContain('aria-label="Set damage scale to normal"');
    expect(markup).not.toContain('aria-label="Set damage scale to log"');
  });

  it('renders four 2D cards in a two-column grid', () => {
    const markup = renderPlotView();
    const cards = markup.match(/data-plot-type="[^"]+"/g) ?? [];

    expect(cards).toHaveLength(4);
    expect(markup).toContain('grid-cols-2');
    expect(markup).toContain('grid-rows-2');
    expect(markup).toContain('data-plot-type="cumulative_by_channel"');
    expect(markup).toContain('data-plot-type="target_delta_vs_reference"');
    expect(markup).toContain('data-plot-type="reference_absolute_by_event"');
    expect(markup).toContain('data-plot-type="target_absolute_by_event"');
  });

  it('renders the cumulative-by-channel 2D card with grouped bar content', () => {
    const markup = renderPlotView();

    expect(markup).toContain('Cumulative by channel');
    expect(markup).toContain('data-bar-id="reference-0"');
    expect(markup).toContain('data-bar-id="target-0"');
  });

  it('renders the target-delta card with diverging content instead of placeholder copy', () => {
    const markup = renderPlotView();

    expect(markup).toContain('Target Δ vs Reference by channel');
    expect(markup).toContain('data-delta-zero-baseline="true"');
  });

  it('renders reference and target absolute-by-event cards', () => {
    const markup = renderPlotView();

    expect(markup).toContain('Reference absolute damage by event');
    expect(markup).toContain('Target absolute damage by event');
    expect(markup).toContain('data-stacked-event-plot="true"');
    expect(markup).toContain('data-stacked-bar-id="reference_event-0-0"');
    expect(markup).toContain('data-stacked-bar-id="target_event-0-0"');
  });

  it('does not render the 3D plot canvas', () => {
    const markup = renderPlotView();

    expect(markup).not.toContain('data-testid="damage-plot-canvas"');
    expect(markup).not.toContain('Loading 3D canvas');
    expect(markup).not.toContain('data-focused-3d-plot-type');
    expect(markup).not.toContain('data-testid="color-legend"');
  });

  it('does not render the legacy overlay plot rail', () => {
    const markup = renderPlotView();

    expect(markup).not.toContain('data-testid="overlay-controls"');
    expect(markup).not.toContain('Version slice');
    expect(markup).not.toContain('aria-label="Plot type"');
  });
});
