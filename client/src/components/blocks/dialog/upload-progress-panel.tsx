'use client';

import { type ReactNode } from 'react';
import { Progress } from '@/components/ui/progress';
import type { UploadProgressPhase } from '@/features/database-upload/upload-operation-types';

const UPLOAD_PHASES: Array<{ id: UploadProgressPhase; label: string }> = [
  { id: 'uploading', label: 'Uploading files' },
  { id: 'validating', label: 'Validating and converting' },
  { id: 'processing', label: 'Processing events' },
];

type StepTone = 'pending' | 'active' | 'done';

function phaseTone(phase: UploadProgressPhase, target: UploadProgressPhase): StepTone {
  const order: UploadProgressPhase[] = ['uploading', 'validating', 'processing'];
  const currentIndex = order.indexOf(phase);
  const targetIndex = order.indexOf(target);
  if (currentIndex > targetIndex) return 'done';
  if (currentIndex === targetIndex) return 'active';
  return 'pending';
}

interface PhaseStepProps {
  label: string;
  tone: StepTone;
  isLast: boolean;
  children?: ReactNode;
}

function PhaseStep({ label, tone, isLast, children }: PhaseStepProps) {
  const pending = tone === 'pending';

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center w-5 shrink-0 pt-0.5">
        {tone === 'done' ? (
          <div className="h-2.5 w-2.5 rounded-full bg-foreground shrink-0" aria-hidden />
        ) : tone === 'active' ? (
          <div
            className="h-2.5 w-2.5 rounded-full bg-foreground shrink-0 animate-stepper-pulse"
            aria-hidden
          />
        ) : (
          <div
            className="h-2.5 w-2.5 rounded-full border-2 border-muted-foreground/40 shrink-0"
            aria-hidden
          />
        )}
        {!isLast ? (
          <div className="w-px flex-1 min-h-[10px] bg-border mt-1 mb-0" aria-hidden />
        ) : null}
      </div>
      <div className={`min-w-0 flex-1 space-y-2 ${pending ? 'opacity-50' : ''} pb-5`}>
        <span
          className={
            tone === 'active'
              ? 'text-sm font-medium text-foreground'
              : 'text-sm text-muted-foreground'
          }
        >
          {label}
        </span>
        {children}
      </div>
    </div>
  );
}

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
  const showDeterminate = progress > 0 && progress < 100;

  return (
    <div className="px-6 py-4 space-y-4">
      <div className="space-y-2 border-b border-border pb-3">
        <p className="text-xs text-muted-foreground leading-relaxed">{progressMessage}</p>
      </div>

      <div className="space-y-0">
        {UPLOAD_PHASES.map((phase, index) => {
          const tone = phaseTone(progressPhase, phase.id);
          const isActive = tone === 'active';

          return (
            <PhaseStep
              key={phase.id}
              label={phase.label}
              tone={tone}
              isLast={index === UPLOAD_PHASES.length - 1}
            >
              {isActive ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="truncate">{progressMessage || 'Working…'}</span>
                    {showDeterminate ? (
                      <span className="tabular-nums shrink-0">{Math.round(progress)}%</span>
                    ) : null}
                  </div>
                  <Progress
                    value={showDeterminate ? progress : 0}
                    indeterminate={!showDeterminate}
                    className="h-1.5"
                  />
                </div>
              ) : null}
            </PhaseStep>
          );
        })}
      </div>
    </div>
  );
}
