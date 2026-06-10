'use client';

import { useEffect, useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FileDropZone } from '@/components/shared';

export interface UploadScheduleSectionProps {
  enabled: boolean;
  selectionKey: string;
  onExtract?: (file: File) => void;
  isExtracting?: boolean;
}

export function UploadScheduleSection({
  enabled,
  selectionKey,
  onExtract,
  isExtracting = false,
}: UploadScheduleSectionProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    setSelectedFile(null);
  }, [selectionKey]);

  const handleFilesSelected = (files: File[]) => {
    if (!enabled || isExtracting) {
      return;
    }
    const schFile = files.find((file) => file.name.toLowerCase().endsWith('.sch'));
    if (schFile) {
      setSelectedFile(schFile);
      onExtract?.(schFile);
    }
  };

  return (
    <div className="space-y-2">
        <FileDropZone
          inputId="edit-metadata-schedule-upload-input"
          accept=".sch"
          disabled={!enabled || isExtracting}
          primaryLabel="Upload schedule file"
          hint=".sch durability schedule"
          onFilesSelected={handleFilesSelected}
        />

        {selectedFile && enabled ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs text-muted-foreground">
                {isExtracting ? 'Extracting schedule...' : '1 selected'}
              </span>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setSelectedFile(null)}
                disabled={isExtracting}
              >
                Clear
              </Button>
            </div>
            <div className="flex items-center gap-2 rounded px-2 py-1 text-xs">
              {isExtracting ? (
                <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
              ) : (
                <FileText className="size-3.5 shrink-0 text-muted-foreground" />
              )}
              <span className="truncate">{selectedFile.name}</span>
            </div>
          </div>
        ) : null}
    </div>
  );
}
