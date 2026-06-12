'use client';

import type { ChannelReprocessProgressPhase } from '@/features/edit-metadata/lib/derived-task-progress';
import type { DamageCalculationProgressPhase } from '@/features/edit-metadata/lib/damage-calculation-progress';
import type { DerivedTaskKind } from '@/types/api';
import {
  ActiveStepProgress,
  OperationProgressMessage,
  OperationProgressPanel,
  PhaseStep,
  phaseTone,
} from '@/components/blocks/dialog/operation-progress-stepper';

const CHANNEL_REPROCESS_PHASES: Array<{ id: ChannelReprocessProgressPhase; label: string }> = [
  { id: 'validating', label: 'Validating artifacts' },
  { id: 'generating', label: 'Generating cross-plot data' },
];

const DAMAGE_CALCULATION_PHASES: Array<{ id: DamageCalculationProgressPhase; label: string }> = [
  { id: 'validating', label: 'Validating schedule rows' },
  { id: 'calculating', label: 'Calculating load history damage' },
];

export interface DerivedDataProgressPanelProps {
  taskKind?: DerivedTaskKind;
  progress: number;
  progressPhase: ChannelReprocessProgressPhase | DamageCalculationProgressPhase;
  progressMessage: string;
}

export function DerivedDataProgressPanel({
  taskKind = 'channel_reprocess',
  progress,
  progressPhase,
  progressMessage,
}: DerivedDataProgressPanelProps) {
  const phases =
    taskKind === 'damage_calculation'
      ? DAMAGE_CALCULATION_PHASES
      : CHANNEL_REPROCESS_PHASES;
  const phaseOrder = phases.map((phase) => phase.id);

  return (
    <OperationProgressPanel
      header={<OperationProgressMessage>{progressMessage}</OperationProgressMessage>}
    >
      {phases.map((phase, index) => {
        const tone = phaseTone(progressPhase, phase.id, phaseOrder);
        const isActive = tone === 'active';

        return (
          <PhaseStep
            key={phase.id}
            label={phase.label}
            tone={tone}
            isLast={index === phases.length - 1}
          >
            {isActive ? (
              <ActiveStepProgress message={progressMessage} progress={progress} />
            ) : null}
          </PhaseStep>
        );
      })}
    </OperationProgressPanel>
  );
}
