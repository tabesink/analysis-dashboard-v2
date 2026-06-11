import { buildDamageCalculationCompletionResult } from '@/features/edit-metadata/lib/damage-calculation-completion';
import type { DamageCalculationCompletionResult } from '@/features/edit-metadata/lib/damage-calculation-completion';
import type { DerivedTaskStatusEvent } from '@/types/api';

export type DamageCalculationTaskOrigin = 'manual' | 'automatic';

export interface DamageCalculationCompletionToast {
  message: string;
  tone: 'success' | 'error' | 'info';
}

export interface DamageCalculationCompletionBehavior {
  completionResult: DamageCalculationCompletionResult;
  status: 'completed' | 'failed';
  modalOpen: boolean;
  toast?: DamageCalculationCompletionToast;
}

export function resolveDamageCalculationCompletionBehavior(params: {
  event: DerivedTaskStatusEvent;
  origin: DamageCalculationTaskOrigin;
  modalWasOpen: boolean;
}): DamageCalculationCompletionBehavior {
  const completionResult = buildDamageCalculationCompletionResult(params.event);
  const status = params.event.status === 'failed' ? 'failed' : 'completed';

  if (params.origin === 'automatic' && status === 'failed') {
    return {
      completionResult,
      status,
      modalOpen: false,
      toast: {
        message: completionResult.message,
        tone: 'error',
      },
    };
  }

  if (params.origin === 'automatic' && status === 'completed' && !params.modalWasOpen) {
    return {
      completionResult,
      status,
      modalOpen: false,
    };
  }

  return {
    completionResult,
    status,
    modalOpen: true,
  };
}
