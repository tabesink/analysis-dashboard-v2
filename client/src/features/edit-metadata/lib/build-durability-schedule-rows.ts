import type { DurabilityScheduleEventRow, EventMetadata } from '@/types/api';

export interface DurabilityScheduleEntry {
  pattern: string;
  repeats: number;
  weight: number;
}

export interface DurabilityScheduleRow {
  id: string;
  rspFileName: string;
  rspEventName: string;
  schedulePattern: string;
  scheduleSequence: number | null;
  weight: number | null;
  repeats: number | null;
  preload: number | null;
}

const PLACEHOLDER_ROW_ID_PREFIX = 'schedule-placeholder::';

function placeholderRowId(pattern: string, scheduleSequence: number): string {
  return `${PLACEHOLDER_ROW_ID_PREFIX}${scheduleSequence}::${pattern}`;
}

function isPlaceholderRowId(rowId: string): boolean {
  return rowId.startsWith(PLACEHOLDER_ROW_ID_PREFIX);
}

interface TokenStats {
  fileCount: number;
  firstPosition: number;
}

function fileStem(sourceFile: string): string {
  const baseName = sourceFile.split(/[/\\]/).pop() ?? sourceFile;
  return baseName.replace(/\.[^/.]+$/, '');
}

export function formatSchedulePattern(pattern: string): string {
  if (pattern.includes('*')) {
    return pattern;
  }
  return `*${pattern}*`;
}

export function barePatternFromDisplay(pattern: string): string {
  if (!pattern.includes('*')) {
    return pattern;
  }
  return pattern.replace(/^\*/, '').replace(/\*$/, '');
}

export function rowsFromSavedEventRows(
  eventRows: DurabilityScheduleEventRow[],
  entries: DurabilityScheduleEntry[] = [],
): DurabilityScheduleRow[] {
  const rows = eventRows.map((row) => ({
    id: row.event_id,
    rspFileName: row.rsp_file_name,
    rspEventName: row.rsp_event_name,
    schedulePattern: formatSchedulePattern(row.pattern),
    scheduleSequence: row.schedule_sequence,
    weight: row.weight,
    repeats: row.repeats,
    preload: null,
  }));
  return addUnmatchedPatternPlaceholderRows(rows, entries);
}

export function rowsToSavePayload(rows: DurabilityScheduleRow[]): DurabilityScheduleEventRow[] {
  return rows
    .filter((row) => !isPlaceholderRowId(row.id))
    .map((row) => ({
      event_id: row.id,
      rsp_file_name: row.rspFileName,
      rsp_event_name: row.rspEventName,
      pattern: barePatternFromDisplay(row.schedulePattern),
      repeats: row.repeats,
      weight: row.weight,
      schedule_sequence: row.scheduleSequence,
    }));
}

export function discoverEventDelimiter(fileNames: string[]): string | null {
  const tokenStats = new Map<string, TokenStats>();

  for (const fileName of fileNames) {
    const tokens = fileStem(fileName).split('_');
    const seenTokens = new Set<string>();

    for (let position = 0; position < tokens.length; position += 1) {
      const token = tokens[position];
      if (!token || seenTokens.has(token)) {
        continue;
      }
      seenTokens.add(token);

      const stats = tokenStats.get(token) ?? { fileCount: 0, firstPosition: position };
      stats.fileCount += 1;
      stats.firstPosition = Math.min(stats.firstPosition, position);
      tokenStats.set(token, stats);
    }
  }

  if (tokenStats.size === 0) {
    return null;
  }

  let delimiter: string | null = null;
  let bestScore: [number, number] | null = null;

  for (const [token, stats] of tokenStats) {
    const score: [number, number] = [stats.fileCount, -stats.firstPosition];
    if (bestScore === null || score[0] > bestScore[0] || (score[0] === bestScore[0] && score[1] > bestScore[1])) {
      delimiter = token;
      bestScore = score;
    }
  }

  return delimiter;
}

export function rspEventNameFromFile(sourceFile: string, delimiterToken: string | null): string {
  const stem = fileStem(sourceFile);
  const tokens = stem.split('_');

  if (delimiterToken && tokens.includes(delimiterToken)) {
    return tokens.slice(0, tokens.indexOf(delimiterToken)).join('_');
  }

  return stem;
}

export function matchSchedulePattern(stem: string, patterns: string[]): string | null {
  const matches = patterns.filter((pattern) => stem.includes(pattern));
  if (matches.length === 0) {
    return null;
  }

  return matches.reduce((longest, current) => (current.length > longest.length ? current : longest));
}

export function buildDurabilityScheduleRows(
  events: EventMetadata[],
  entries: DurabilityScheduleEntry[],
): DurabilityScheduleRow[] {
  const sourceFiles = events
    .map((event) => event.source_file?.trim())
    .filter((sourceFile): sourceFile is string => Boolean(sourceFile));
  const delimiterToken = discoverEventDelimiter(sourceFiles);

  const indexedEntries = entries.map((entry, index) => ({
    ...entry,
    scheduleSequence: index + 1,
    displayPattern: formatSchedulePattern(entry.pattern),
  }));
  const patterns = entries.map((entry) => entry.pattern);

  const rows = events
    .filter((event) => Boolean(event.source_file?.trim()))
    .map((event) => {
      const sourceFile = event.source_file!.trim();
      const stem = fileStem(sourceFile);
      const matchedPattern = matchSchedulePattern(stem, patterns);
      const match = indexedEntries.find((entry) => entry.pattern === matchedPattern);

      return {
        id: event.event_id,
        rspFileName: sourceFile,
        rspEventName: rspEventNameFromFile(sourceFile, delimiterToken),
        schedulePattern: match?.displayPattern ?? '',
        scheduleSequence: match?.scheduleSequence ?? null,
        weight: match?.weight ?? null,
        repeats: match?.repeats ?? null,
        preload: null,
      };
    });
  return addUnmatchedPatternPlaceholderRows(rows, entries);
}

function addUnmatchedPatternPlaceholderRows(
  rows: DurabilityScheduleRow[],
  entries: DurabilityScheduleEntry[],
): DurabilityScheduleRow[] {
  const matchedPatterns = new Set(
    rows
      .map((row) => barePatternFromDisplay(row.schedulePattern).trim())
      .filter((pattern) => pattern.length > 0),
  );

  const placeholderRows = entries
    .map((entry, index): DurabilityScheduleRow | null => {
      const pattern = entry.pattern.trim();
      if (!pattern || matchedPatterns.has(pattern)) {
        return null;
      }
      return {
        id: placeholderRowId(pattern, index + 1),
        rspFileName: '-',
        rspEventName: '-',
        schedulePattern: formatSchedulePattern(pattern),
        scheduleSequence: index + 1,
        weight: entry.weight,
        repeats: entry.repeats,
        preload: null,
      };
    })
    .filter((row): row is DurabilityScheduleRow => row !== null);

  return [...rows, ...placeholderRows].sort((left, right) => {
    const leftSequence = left.scheduleSequence ?? Number.MAX_SAFE_INTEGER;
    const rightSequence = right.scheduleSequence ?? Number.MAX_SAFE_INTEGER;
    if (leftSequence !== rightSequence) {
      return leftSequence - rightSequence;
    }
    return left.rspFileName.localeCompare(right.rspFileName);
  });
}
