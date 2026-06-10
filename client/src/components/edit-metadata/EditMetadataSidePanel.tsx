'use client';

import { ScrollArea } from '@/components/ui/scroll-area';
import { SidePanelLayout, SidePanelSection } from '@/components/shared';
import {
  SelectDatasetSection,
  type SelectDatasetSectionProps,
} from './SelectDatasetSection';
import {
  UploadScheduleSection,
  type UploadScheduleSectionProps,
} from './UploadScheduleSection';

export interface EditMetadataSidePanelProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  selectDatasetProps: SelectDatasetSectionProps;
  uploadScheduleProps: UploadScheduleSectionProps;
}

export function EditMetadataSidePanel({
  isCollapsed,
  onToggleCollapse,
  selectDatasetProps,
  uploadScheduleProps,
}: EditMetadataSidePanelProps) {
  return (
    <SidePanelLayout
      isCollapsed={isCollapsed}
      onToggleCollapse={onToggleCollapse}
      expandedWidth="w-[320px]"
    >
      <ScrollArea className="flex-1 min-h-0 w-full">
        <div className="p-5 overflow-hidden">
          <SidePanelSection
            title="Select Dataset"
            subtitle="Edit event metadata for the selected program/version."
            defaultExpanded
          >
            <div className="space-y-4">
              <UploadScheduleSection {...uploadScheduleProps} />
              <SelectDatasetSection {...selectDatasetProps} />
            </div>
          </SidePanelSection>
        </div>
      </ScrollArea>
    </SidePanelLayout>
  );
}
