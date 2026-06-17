import { toast } from 'sonner';
import { showShortInfoToast } from '@/lib/feedback/short-info-toast';

import type { DamageCalculationCompletionToast } from '@/features/edit-metadata/lib/damage-calculation-task-completion';

type ToastEmitter = (toastMessage: DamageCalculationCompletionToast) => void;

let toastEmitter: ToastEmitter = (toastMessage) => {
  if (toastMessage.tone === 'error') {
    toast.error(toastMessage.message);
    return;
  }
  if (toastMessage.tone === 'success') {
    toast.success(toastMessage.message);
    return;
  }
  showShortInfoToast(toastMessage.message);
};

export function emitDamageCalculationCompletionToast(
  toastMessage: DamageCalculationCompletionToast,
): void {
  toastEmitter(toastMessage);
}

export function setDamageCalculationToastEmitterForTests(emitter: ToastEmitter): void {
  toastEmitter = emitter;
}

export function resetDamageCalculationToastEmitterForTests(): void {
  toastEmitter = (toastMessage) => {
    if (toastMessage.tone === 'error') {
      toast.error(toastMessage.message);
      return;
    }
    if (toastMessage.tone === 'success') {
      toast.success(toastMessage.message);
      return;
    }
    showShortInfoToast(toastMessage.message);
  };
}
