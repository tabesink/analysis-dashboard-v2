'use client';

import { type ReactNode } from 'react';
import { Progress } from '@/components/ui/progress';
import type { ChannelReprocessProgressPhase } from '@/features/edit-metadata/lib/derived-task-progress';
import type { DamageCalculationProgressPhase } from '@/features/edit-metadata/lib/damage-calculation-progress';
import type { DerivedTaskKind } from '@/types/api';

const CHANNEL_REPROCESS_PHASES: Array<{ id: ChannelReprocessProgressPhase; label: string }> = [
  { id: 'validating', label: 'Validating artifacts' },
  { id: 'generating', label: 'Generating cross-plot data' },
];

const DAMAGE_CALCULATION_PHASES: Array<{ id: DamageCalculationProgressPhase; label: string }> = [
  { id: 'validating', label: 'Validating schedule rows' },
  { id: 'calculating', label: 'Calculating load history damage' },
];

type StepTone = 'pending' | 'active' | 'done';

function phaseTone<T extends string>(phase: T, target: T, order: T[]): StepTone {
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
  const showDeterminate = progress > 0 && progress < 100;
  const phases =
    taskKind === 'damage_calculation'
      ? DAMAGE_CALCULATION_PHASES
      : CHANNEL_REPROCESS_PHASES;
  const phaseOrder = phases.map((phase) => phase.id);

  return (
    <div className="px-6 py-4 space-y-4">
      <div className="space-y-2 border-b border-border pb-3">
        <p className="text-xs text-muted-foreground leading-relaxed">{progressMessage}</p>
      </div>

      <div className="space-y-0">
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
