'use client';

import { type ReactNode } from 'react';
import { Progress } from '@/components/ui/progress';
import type { ScopeDeleteProgressPhase } from '@/features/database-scope-delete/scope-delete-operation-types';

const DELETE_PHASES: Array<{ id: ScopeDeleteProgressPhase; label: string }> = [
  { id: 'measurements', label: 'Removing measurements and events' },
  { id: 'artifacts', label: 'Removing artifacts and channel maps' },
  { id: 'files', label: 'Cleaning up files' },
];

type StepTone = 'pending' | 'active' | 'done';

function phaseTone(
  phase: ScopeDeleteProgressPhase,
  target: ScopeDeleteProgressPhase,
): StepTone {
  const order: ScopeDeleteProgressPhase[] = ['measurements', 'artifacts', 'files'];
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
    <div className="px-6 py-4 space-y-4">
      <div className="space-y-2 border-b border-border pb-3">
        <p className="text-xs text-muted-foreground leading-relaxed">{progressMessage}</p>
        <p className="text-xs text-muted-foreground">
          Keep this dialog open until you see the summary.
        </p>
      </div>

      <div className="space-y-0">
        {DELETE_PHASES.map((phase, index) => {
          const tone = phaseTone(progressPhase, phase.id);
          const isActive = tone === 'active';

          return (
            <PhaseStep
              key={phase.id}
              label={phase.label}
              tone={tone}
              isLast={index === DELETE_PHASES.length - 1}
            >
              {isActive ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">{progressMessage || 'Working…'}</p>
                  <Progress value={0} indeterminate className="h-1.5" />
                </div>
              ) : null}
            </PhaseStep>
          );
        })}
      </div>
    </div>
  );
}
