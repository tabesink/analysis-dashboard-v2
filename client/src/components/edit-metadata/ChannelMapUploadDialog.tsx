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
import { validateChannelMapUploadSelection } from '@/features/edit-metadata/lib/channel-map-file';

export interface ChannelMapUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  programId: string;
  version: string;
  disabled?: boolean;
  isUploading?: boolean;
  onUpload: (file: File) => Promise<void>;
}

export function ChannelMapUploadDialog({
  open,
  onOpenChange,
  programId,
  version,
  disabled = false,
  isUploading = false,
  onUpload,
}: ChannelMapUploadDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setSelectedFile(null);
      setValidationError(null);
    }
  }, [open, programId, version]);

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
  };

  const handleFilesSelected = (files: File[]) => {
    if (disabled || isUploading) {
      return;
    }
    const { file, error } = validateChannelMapUploadSelection(files);
    if (error || !file) {
      setSelectedFile(null);
      setValidationError(error ?? 'Only channel_map.yml or channel_map.yaml is accepted.');
      return;
    }
    setValidationError(null);
    setSelectedFile(file);
    onOpenChange(false);
    void onUpload(file);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        data-testid="channel-map-upload-dialog"
        overlayClassName="bg-transparent backdrop-blur-none"
      >
        <DialogHeader>
          <DialogTitle></DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <FileDropZone
            inputId="assign-channels-channel-map-upload-input"
            accept=".yml,.yaml"
            disabled={disabled || isUploading}
            primaryLabel="Upload a channel map file"
            hint="File name must match 'channel_map.yaml'"
            onFilesSelected={handleFilesSelected}
          />

          {validationError ? (
            <p className="text-xs text-destructive" data-testid="channel-map-upload-error">
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
