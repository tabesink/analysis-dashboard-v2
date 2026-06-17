import type { UploadProgressPhase } from '@/types/upload';

export type UploadWizardStep = 'progress' | 'summary';

export interface UploadCompletionResult {
  success: boolean;
  title: string;
  message: string;
  elapsedSeconds?: number;
  detailLines?: string[];
}

export interface UploadOperationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wizardStep: UploadWizardStep;
  blocking: boolean;
  progress: number;
  progressPhase: UploadProgressPhase;
  progressMessage: string;
  isCancelling?: boolean;
  completionResult?: UploadCompletionResult | null;
  onCancelUpload?: () => void;
  onCloseSummary?: () => void;
}
