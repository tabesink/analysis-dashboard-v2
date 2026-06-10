export type UploadWizardStep = 'progress' | 'summary';

export type UploadProgressPhase = 'uploading' | 'validating' | 'processing';

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
  completionResult?: UploadCompletionResult | null;
  onCancelUpload?: () => void;
  onCloseSummary?: () => void;
}
