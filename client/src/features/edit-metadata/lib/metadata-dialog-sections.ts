export type MetadataDialogSection =
  | 'edit-metadata'
  | 'assign-channels'
  | 'durability-schedule';

const METADATA_DIALOG_SECTION_LABELS: Record<MetadataDialogSection, string> = {
  'edit-metadata': 'Edit Metadata',
  'assign-channels': 'Assign Channels',
  'durability-schedule': 'Assign Schedule',
};

export function metadataDialogSectionLabel(section: MetadataDialogSection): string {
  return METADATA_DIALOG_SECTION_LABELS[section];
}

export function isMetadataDialogSectionActive(
  activeSection: MetadataDialogSection,
  section: MetadataDialogSection,
): boolean {
  return activeSection === section;
}

export function metadataDialogSectionNavClassName(isActive: boolean): string {
  const base =
    'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-normal text-foreground transition-colors';
  return isActive
    ? `${base} bg-secondary`
    : `${base} hover:bg-secondary/60`;
}
