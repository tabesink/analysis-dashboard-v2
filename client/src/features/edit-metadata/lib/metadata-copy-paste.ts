import type { FilterOptions } from '@/types/api';

import { RAW_WEIGHT_FIELDS } from './metadata-field-constants';
import { isStatusField } from './metadata-field-helpers';
import type { MetadataDraftValues } from './build-program-version-draft';

export function buildCopyableMetadataKeys(options: FilterOptions): string[] {
  const keys: string[] = [];
  for (const [displayName, config] of Object.entries(options)) {
    if (isStatusField(displayName, config)) {
      continue;
    }
    keys.push(displayName);
  }
  for (const field of RAW_WEIGHT_FIELDS) {
    keys.push(field.label);
  }
  return keys;
}

export function snapshotMetadataForCopy(
  draftValues: MetadataDraftValues,
  keys: string[],
): MetadataDraftValues {
  const snapshot: MetadataDraftValues = {};
  for (const key of keys) {
    snapshot[key] = draftValues[key] ?? '';
  }
  return snapshot;
}

export function applyMetadataPaste(
  draftValues: MetadataDraftValues,
  clipboard: MetadataDraftValues,
  keys: string[],
): { nextDraft: MetadataDraftValues; dirtyKeys: string[] } {
  const nextDraft = { ...draftValues };
  const dirtyKeys: string[] = [];
  for (const key of keys) {
    nextDraft[key] = clipboard[key] ?? '';
    dirtyKeys.push(key);
  }
  return { nextDraft, dirtyKeys };
}
