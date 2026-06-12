'use client';

import { type ReactNode } from 'react';
import { Progress } from '@/components/ui/progress';

export type StepTone = 'pending' | 'active' | 'done';

export function phaseTone<T extends string>(
  phase: T,
  target: T,
  order: readonly T[],
): StepTone {
  const currentIndex = order.indexOf(phase);
  const targetIndex = order.indexOf(target);
  if (currentIndex > targetIndex) return 'done';
  if (currentIndex === targetIndex) return 'active';
  return 'pending';
}

export interface PhaseStepProps {
  label: string;
  tone: StepTone;
  isLast: boolean;
  /** Right column: e.g. "48%" while active, "12s" when done */
  trailing?: ReactNode;
  children?: ReactNode;
}

export function PhaseStep({ label, tone, isLast, trailing, children }: PhaseStepProps) {
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
        <div className="flex items-start justify-between gap-3">
          <span
            className={
              tone === 'active'
                ? 'text-sm font-medium text-foreground'
                : 'text-sm text-muted-foreground'
            }
          >
            {label}
          </span>
          {trailing != null ? (
            <span className="tabular-nums text-xs text-muted-foreground shrink-0 pt-0.5">
              {trailing}
            </span>
          ) : null}
        </div>
        {children}
      </div>
    </div>
  );
}

export function StepperTimeline({ children }: { children: ReactNode }) {
  return <div className="space-y-0">{children}</div>;
}

export interface OperationProgressPanelProps {
  header: ReactNode;
  children: ReactNode;
}

export function OperationProgressPanel({ header, children }: OperationProgressPanelProps) {
  return (
    <div className="px-6 py-4 space-y-4">
      <div className="space-y-2 border-b border-border pb-3">{header}</div>
      <StepperTimeline>{children}</StepperTimeline>
    </div>
  );
}

export function OperationProgressMessage({ children }: { children: ReactNode }) {
  return <p className="text-xs text-muted-foreground leading-relaxed">{children}</p>;
}

export function ActiveStepProgress({
  message,
  progress,
}: {
  message: string;
  progress: number;
}) {
  const showDeterminate = progress > 0 && progress < 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="truncate">{message || 'Working…'}</span>
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
  );
}

export function ActiveStepIndeterminateProgress({ message }: { message: string }) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{message || 'Working…'}</p>
      <Progress value={0} indeterminate className="h-1.5" />
    </div>
  );
}
