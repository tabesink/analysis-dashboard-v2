'use client';

import { ScrollArea } from '@/components/ui/scroll-area';
import { SidePanelLayout } from '@/components/shared';
import { UploadDataSection, type UploadDataSectionProps } from './UploadDataSection';

export interface DatabaseSidePanelProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  uploadDataProps: UploadDataSectionProps;
}

export function DatabaseSidePanel({
  isCollapsed,
  onToggleCollapse,
  uploadDataProps,
}: DatabaseSidePanelProps) {
  return (
    <SidePanelLayout
      isCollapsed={isCollapsed}
      onToggleCollapse={onToggleCollapse}
      expandedWidth="w-[320px]"
    >
      <ScrollArea className="flex-1 min-h-0 w-full">
        <div className="p-5 space-y-5 overflow-hidden">
          <UploadDataSection {...uploadDataProps} />
        </div>
      </ScrollArea>
    </SidePanelLayout>
  );
}
