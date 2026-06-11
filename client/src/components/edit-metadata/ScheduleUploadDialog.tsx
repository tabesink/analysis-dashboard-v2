'use client';

import { useEffect, useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';

import { FileDropZone } from '@/components/shared/FileDropZone';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { validateScheduleUploadSelection } from '@/features/edit-metadata/lib/schedule-file';

export interface ScheduleUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  programId: string;
  version: string;
  disabled?: boolean;
  isUploading?: boolean;
  onUpload: (file: File) => Promise<void>;
}

export function ScheduleUploadDialog({
  open,
  onOpenChange,
  programId,
  version,
  disabled = false,
  isUploading = false,
  onUpload,
}: ScheduleUploadDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setSelectedFile(null);
      setValidationError(null);
    }
  }, [open, programId, version]);

  const handleFilesSelected = (files: File[]) => {
    if (disabled || isUploading) {
      return;
    }
    const { file, error } = validateScheduleUploadSelection(files);
    if (error || !file) {
      setSelectedFile(null);
      setValidationError(error ?? 'Schedule file must use the .sch extension.');
      return;
    }
    setValidationError(null);
    setSelectedFile(file);
    void onUpload(file);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="schedule-upload-dialog"
        overlayClassName="bg-transparent backdrop-blur-none"
      >
        <DialogHeader>
          <DialogTitle></DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <FileDropZone
            inputId="assign-schedule-upload-input"
            accept=".sch"
            disabled={disabled || isUploading}
            primaryLabel="Upload a schedule file"
            hint=".sch durability schedule"
            onFilesSelected={handleFilesSelected}
          />

          {validationError ? (
            <p className="text-xs text-destructive" data-testid="schedule-upload-error">
              {validationError}
            </p>
          ) : null}

          {selectedFile ? (
            <div className="flex items-center gap-2 rounded px-2 py-1 text-xs">
              {isUploading ? (
                <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
              ) : (
                <FileText className="size-3.5 shrink-0 text-muted-foreground" />
              )}
              <span className="truncate">{selectedFile.name}</span>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
