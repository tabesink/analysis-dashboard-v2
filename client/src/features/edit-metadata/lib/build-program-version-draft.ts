import type { EventMetadata, FilterOptions } from '@/types/api';

import {
  EXCLUDED_METADATA_COLUMNS,
  PHASE_FIELDS,
  RAW_WEIGHT_FIELDS,
} from './metadata-field-constants';

export type MetadataDraftValues = Record<string, string>;

export type PhaseDraftValues = {
  rfq: boolean;
  dv: boolean;
  pv: boolean;
  post_prod: boolean;
};

export function toClearedDraftValues(options: FilterOptions): MetadataDraftValues {
  const nextDrafts: MetadataDraftValues = {};
  for (const [displayName] of Object.entries(options)) {
    nextDrafts[displayName] = '';
  }
  for (const field of RAW_WEIGHT_FIELDS) {
    nextDrafts[field.label] = '';
  }
  return nextDrafts;
}

export function toClearedPhaseDraftValues(): PhaseDraftValues {
  return {
    rfq: false,
    dv: false,
    pv: false,
    post_prod: false,
  };
}

export function buildProgramVersionDraftValues(
  options: FilterOptions,
  events: EventMetadata[],
): { draft: MetadataDraftValues; baseline: MetadataDraftValues } {
  const draft: MetadataDraftValues = {};
  const baseline: MetadataDraftValues = {};

  const resolveField = (key: string, rawValues: (string | null | undefined)[]) => {
    const values = new Set<string>();
    let hasEmpty = false;
    for (const raw of rawValues) {
      const normalized = typeof raw === 'string' ? raw.trim() : '';
      if (normalized) {
        values.add(normalized);
      } else {
        hasEmpty = true;
      }
    }
    if (values.size === 1 && !hasEmpty) {
      draft[key] = Array.from(values)[0];
      baseline[key] = Array.from(values)[0];
      return;
    }
    if (values.size === 1 && hasEmpty) {
      draft[key] = Array.from(values)[0];
      baseline[key] = '';
      return;
    }
    draft[key] = '';
    baseline[key] = '';
  };

  for (const [displayName, config] of Object.entries(options)) {
    if (EXCLUDED_METADATA_COLUMNS.has(config.column)) {
      continue;
    }
    resolveField(
      displayName,
      events.map((event) => event[config.column as keyof EventMetadata] as string | null | undefined),
    );
  }
  for (const field of RAW_WEIGHT_FIELDS) {
    resolveField(
      field.label,
      events.map((event) => event[field.key as keyof EventMetadata] as string | null | undefined),
    );
  }

  return { draft, baseline };
}

export function buildProgramVersionPhaseDraftValues(events: EventMetadata[]): PhaseDraftValues {
  const fieldValues: PhaseDraftValues = toClearedPhaseDraftValues();
  for (const field of PHASE_FIELDS) {
    const allTrue = events.every((event) => Boolean(event[field.key as keyof EventMetadata]));
    fieldValues[field.key] = allTrue;
  }
  return fieldValues;
}

export function toTimestamp(value: string | undefined | null): number {
  if (!value) {
    return 0;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function buildSelectionMetadata(events: EventMetadata[]) {
  const uniqueStatusValues = new Set<string>();
  events.forEach((event) => {
    const statusValue = event.status?.trim();
    if (statusValue) {
      uniqueStatusValues.add(statusValue);
    }
  });
  const latestUpdatedEvent = events.reduce<EventMetadata | null>((latest, event) => {
    const latestTs = toTimestamp(latest?.updated_at ?? latest?.created_at);
    const eventTs = toTimestamp(event.updated_at ?? event.created_at);
    return eventTs > latestTs ? event : latest;
  }, null);
  const latestUploadedEvent = events.reduce<EventMetadata | null>((latest, event) => {
    const latestTs = toTimestamp(latest?.created_at);
    const eventTs = toTimestamp(event.created_at);
    return eventTs > latestTs ? event : latest;
  }, null);

  return {
    lastUpdatedBy:
      latestUpdatedEvent?.last_updated_by_username ??
      latestUpdatedEvent?.last_updated_by_user_id ??
      latestUpdatedEvent?.uploaded_by_user_id ??
      null,
    lastUpdatedAt: latestUpdatedEvent?.updated_at ?? latestUpdatedEvent?.created_at ?? null,
    uploadedBy:
      latestUploadedEvent?.uploaded_by_username ?? latestUploadedEvent?.uploaded_by_user_id ?? null,
    uploadedAt: latestUploadedEvent?.created_at ?? null,
    status:
      uniqueStatusValues.size === 1
        ? Array.from(uniqueStatusValues)[0]
        : uniqueStatusValues.size > 1
          ? 'Mixed'
          : null,
  };
}
