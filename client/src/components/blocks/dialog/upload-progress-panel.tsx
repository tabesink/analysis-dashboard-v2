'use client';

import type { UploadProgressPhase } from '@/types/upload';
import {
  ActiveStepProgress,
  OperationProgressMessage,
  OperationProgressPanel,
  PhaseStep,
  phaseTone,
} from '@/components/blocks/dialog/operation-progress-stepper';

const UPLOAD_PHASES: Array<{ id: UploadProgressPhase; label: string }> = [
  { id: 'uploading', label: 'Uploading files' },
  { id: 'validating', label: 'Validating and converting' },
  { id: 'processing', label: 'Processing events' },
];

const UPLOAD_PHASE_ORDER: UploadProgressPhase[] = ['uploading', 'validating', 'processing'];

export interface UploadProgressPanelProps {
  progress: number;
  progressPhase: UploadProgressPhase;
  progressMessage: string;
}

export function UploadProgressPanel({
  progress,
  progressPhase,
  progressMessage,
}: UploadProgressPanelProps) {
  return (
    <OperationProgressPanel
      header={<OperationProgressMessage>{progressMessage}</OperationProgressMessage>}
    >
      {UPLOAD_PHASES.map((phase, index) => {
        const tone = phaseTone(progressPhase, phase.id, UPLOAD_PHASE_ORDER);
        const isActive = tone === 'active';

        return (
          <PhaseStep
            key={phase.id}
            label={phase.label}
            tone={tone}
            isLast={index === UPLOAD_PHASES.length - 1}
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
