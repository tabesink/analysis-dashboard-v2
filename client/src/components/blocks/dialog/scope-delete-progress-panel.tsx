'use client';

import type { ScopeDeleteProgressPhase } from '@/features/database-scope-delete/scope-delete-operation-types';
import {
  ActiveStepIndeterminateProgress,
  OperationProgressMessage,
  OperationProgressPanel,
  PhaseStep,
  phaseTone,
} from '@/components/blocks/dialog/operation-progress-stepper';

const DELETE_PHASES: Array<{ id: ScopeDeleteProgressPhase; label: string }> = [
  { id: 'measurements', label: 'Removing measurements and events' },
  { id: 'artifacts', label: 'Removing artifacts and channel maps' },
  { id: 'files', label: 'Cleaning up files' },
];

const DELETE_PHASE_ORDER: ScopeDeleteProgressPhase[] = ['measurements', 'artifacts', 'files'];

export interface ScopeDeleteProgressPanelProps {
  progressPhase: ScopeDeleteProgressPhase;
  progressMessage: string;
}

/** Progress body aligned with DatabaseOperationModal import/export progress styling. */
export function ScopeDeleteProgressPanel({
  progressPhase,
  progressMessage,
}: ScopeDeleteProgressPanelProps) {
  return (
    <OperationProgressPanel
      header={
        <>
          <OperationProgressMessage>{progressMessage}</OperationProgressMessage>
          <p className="text-xs text-muted-foreground">
            Keep this dialog open until you see the summary.
          </p>
        </>
      }
    >
      {DELETE_PHASES.map((phase, index) => {
        const tone = phaseTone(progressPhase, phase.id, DELETE_PHASE_ORDER);
        const isActive = tone === 'active';

        return (
          <PhaseStep
            key={phase.id}
            label={phase.label}
            tone={tone}
            isLast={index === DELETE_PHASES.length - 1}
          >
            {isActive ? (
              <ActiveStepIndeterminateProgress message={progressMessage} />
            ) : null}
          </PhaseStep>
        );
      })}
    </OperationProgressPanel>
  );
}
