import {
  PROGRAM_SCOPE_PREFIX,
  VERSION_SCOPE_PREFIX,
} from '@/components/upload/DatabaseEventTree';
import type { ProgramVersionSummary } from '@/types/upload';

export interface ParsedDeleteSelection {
  programScopes: string[];
  versionScopes: Array<{ program_id: string; version: string }>;
  eventIds: string[];
}

export interface ScopeDeleteSummary {
  scopeCount: number;
  programCount: number;
  versionCount: number;
  eventCount: number;
  artifactCount: number;
  hasScopeDeletes: boolean;
  detailLines: string[];
}

export interface ScopeDeletePlan extends ParsedDeleteSelection {
  effectiveVersionScopes: Array<{ program_id: string; version: string }>;
  summary: ScopeDeleteSummary;
}

export function parseDeleteSelection(selectedKeys: string[]): ParsedDeleteSelection {
  const programScopes: string[] = [];
  const versionScopes: Array<{ program_id: string; version: string }> = [];
  const eventIds: string[] = [];

  for (const key of selectedKeys) {
    if (key.startsWith(PROGRAM_SCOPE_PREFIX)) {
      programScopes.push(key.slice(PROGRAM_SCOPE_PREFIX.length));
      continue;
    }
    if (key.startsWith(VERSION_SCOPE_PREFIX)) {
      const raw = key.slice(VERSION_SCOPE_PREFIX.length);
      const [program_id, version] = raw.split('::');
      if (program_id && version) {
        versionScopes.push({ program_id, version });
      }
      continue;
    }
    eventIds.push(key);
  }

  return { programScopes, versionScopes, eventIds };
}

function findVersionSummary(
  programVersions: ProgramVersionSummary[],
  program_id: string,
  version: string,
): ProgramVersionSummary | undefined {
  return programVersions.find(
    (item) => item.program_id === program_id && item.version === version,
  );
}

function estimateScopeCounts(
  programScopes: string[],
  versionScopes: Array<{ program_id: string; version: string }>,
  eventIds: string[],
  programVersions: ProgramVersionSummary[],
): Pick<ScopeDeleteSummary, 'eventCount' | 'artifactCount'> {
  const programScopeSet = new Set(programScopes);
  let eventCount = eventIds.length;
  let artifactCount = 0;

  for (const programId of programScopes) {
    for (const summary of programVersions) {
      if (summary.program_id !== programId) continue;
      eventCount += summary.event_count;
      artifactCount += summary.pending_artifact_count;
    }
  }

  for (const scope of versionScopes) {
    if (programScopeSet.has(scope.program_id)) continue;
    const summary = findVersionSummary(programVersions, scope.program_id, scope.version);
    eventCount += summary?.event_count ?? 0;
    artifactCount += summary?.pending_artifact_count ?? 0;
  }

  return { eventCount, artifactCount };
}

function buildDetailLines(
  programScopes: string[],
  effectiveVersionScopes: Array<{ program_id: string; version: string }>,
  eventCount: number,
  artifactCount: number,
  eventIds: string[],
): string[] {
  const lines: string[] = [];

  if (programScopes.length > 0) {
    const label =
      programScopes.length === 1
        ? `Program ${programScopes[0]}`
        : `${programScopes.length} programs (${programScopes.join(', ')})`;
    lines.push(label);
  }

  if (effectiveVersionScopes.length > 0) {
    const versionLabels = effectiveVersionScopes.map(
      (scope) => `${scope.program_id} / ${scope.version}`,
    );
    lines.push(
      effectiveVersionScopes.length === 1
        ? `Version ${versionLabels[0]}`
        : `${effectiveVersionScopes.length} versions (${versionLabels.join(', ')})`,
    );
  }

  if (eventIds.length > 0) {
    lines.push(
      `${eventIds.length} individual event${eventIds.length === 1 ? '' : 's'}`,
    );
  }

  lines.push(`~${eventCount.toLocaleString()} events and ~${artifactCount.toLocaleString()} artifacts`);

  return lines;
}

export function buildScopeDeletePlan(
  selectedKeys: string[],
  programVersions: ProgramVersionSummary[],
): ScopeDeletePlan {
  const { programScopes, versionScopes, eventIds } = parseDeleteSelection(selectedKeys);
  const programScopeSet = new Set(programScopes);
  const effectiveVersionScopes = versionScopes.filter(
    (item) => !programScopeSet.has(item.program_id),
  );
  const scopeCount = programScopes.length + effectiveVersionScopes.length;
  const hasScopeDeletes = scopeCount > 0;
  const { eventCount, artifactCount } = estimateScopeCounts(
    programScopes,
    effectiveVersionScopes,
    eventIds,
    programVersions,
  );

  return {
    programScopes,
    versionScopes,
    effectiveVersionScopes,
    eventIds,
    summary: {
      scopeCount,
      programCount: programScopes.length,
      versionCount: effectiveVersionScopes.length,
      eventCount,
      artifactCount,
      hasScopeDeletes,
      detailLines: buildDetailLines(
        programScopes,
        effectiveVersionScopes,
        eventCount,
        artifactCount,
        eventIds,
      ),
    },
  };
}
