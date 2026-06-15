import {
  discoverEventDelimiter,
  rspEventNameFromFile,
} from '@/features/edit-metadata/lib/build-durability-schedule-rows';
import { getEventDisplayName } from '@/lib/utils';
import type { EventMetadata } from '@/types/api';

type EventNameSource = Pick<EventMetadata, 'event_id' | 'source_file'>;

export function resolveRspEventName(
  event: EventNameSource,
  delimiterToken: string | null = null,
): string {
  const sourceFile = event.source_file?.trim();
  if (sourceFile) {
    const rspName = rspEventNameFromFile(sourceFile, delimiterToken);
    if (rspName) return rspName;
    const stem = sourceFile.replace(/\.[^/.]+$/, '').split(/[/\\]/).pop() ?? sourceFile;
    return stem || getEventDisplayName(event.event_id);
  }
  return getEventDisplayName(event.event_id);
}

export function buildRspEventNameById(
  events: readonly EventNameSource[],
): ReadonlyMap<string, string> {
  const sourceFiles = events
    .map((event) => event.source_file?.trim())
    .filter((sourceFile): sourceFile is string => Boolean(sourceFile));
  const delimiterToken = discoverEventDelimiter(sourceFiles);

  return new Map(
    events.map((event) => [event.event_id, resolveRspEventName(event, delimiterToken)]),
  );
}
