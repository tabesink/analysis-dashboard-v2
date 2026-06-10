import type { ScopeDeletePlan } from '@/features/database-scope-delete/build-scope-delete-plan';

export type ScopeDeleteWizardStep = 'confirm' | 'progress' | 'summary';

export type ScopeDeleteProgressPhase = 'measurements' | 'artifacts' | 'files';

export interface ScopeDeleteCompletionResult {
  success: boolean;
  title: string;
  message: string;
  elapsedSeconds?: number;
  detailLines?: string[];
}

export interface ScopeDeleteOperationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wizardStep: ScopeDeleteWizardStep;
  blocking: boolean;
  plan: ScopeDeletePlan | null;
  progressPhase: ScopeDeleteProgressPhase;
  progressMessage: string;
  completionResult?: ScopeDeleteCompletionResult | null;
  onConfirmDelete?: () => void;
  onCloseSummary?: () => void;
}
