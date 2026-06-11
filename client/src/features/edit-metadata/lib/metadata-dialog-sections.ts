export type MetadataDialogSection =
  | 'edit-metadata'
  | 'assign-channels'
  | 'durability-schedule';

export function isMetadataDialogSectionActive(
  activeSection: MetadataDialogSection,
  section: MetadataDialogSection,
): boolean {
  return activeSection === section;
}

export function metadataDialogSectionNavClassName(isActive: boolean): string {
  const base =
    'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-normal text-[var(--foreground)]';
  return isActive
    ? `${base} bg-[var(--secondary)]`
    : `${base} hover:bg-[var(--secondary)]/60`;
}
