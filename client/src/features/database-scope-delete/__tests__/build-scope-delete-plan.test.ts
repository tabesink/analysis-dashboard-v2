import { describe, expect, it } from 'vitest';

import {
  buildScopeDeletePlan,
  parseDeleteSelection,
} from '@/features/database-scope-delete/build-scope-delete-plan';
import {
  PROGRAM_SCOPE_PREFIX,
  VERSION_SCOPE_PREFIX,
} from '@/components/upload/DatabaseEventTree';
import type { ProgramVersionSummary } from '@/types/upload';

const programVersions: ProgramVersionSummary[] = [
  {
    program_id: 'P1',
    version: 'V1',
    event_count: 100,
    statuses: ['Approved'],
    has_channel_map: true,
    missing_channel_map: false,
    pending_artifact_count: 2,
    failed_artifact_count: 0,
  },
  {
    program_id: 'P1',
    version: 'V2',
    event_count: 40,
    statuses: ['Pending'],
    has_channel_map: false,
    missing_channel_map: true,
    pending_artifact_count: 3,
    failed_artifact_count: 1,
  },
  {
    program_id: 'P2',
    version: 'V1',
    event_count: 10,
    statuses: ['Approved'],
    has_channel_map: true,
    missing_channel_map: false,
    pending_artifact_count: 0,
    failed_artifact_count: 0,
  },
];

describe('parseDeleteSelection', () => {
  it('separates program scopes, version scopes, and event ids', () => {
    const selection = parseDeleteSelection([
      `${PROGRAM_SCOPE_PREFIX}P1`,
      `${VERSION_SCOPE_PREFIX}P2::V1`,
      'event-a',
    ]);

    expect(selection.programScopes).toEqual(['P1']);
    expect(selection.versionScopes).toEqual([{ program_id: 'P2', version: 'V1' }]);
    expect(selection.eventIds).toEqual(['event-a']);
  });
});

describe('buildScopeDeletePlan', () => {
  it('summarizes selected program and version scopes for confirmation', () => {
    const plan = buildScopeDeletePlan(
      [
        `${PROGRAM_SCOPE_PREFIX}P1`,
        `${VERSION_SCOPE_PREFIX}P2::V1`,
        `${VERSION_SCOPE_PREFIX}P1::V2`,
      ],
      programVersions,
    );

    expect(plan.programScopes).toEqual(['P1']);
    expect(plan.effectiveVersionScopes).toEqual([{ program_id: 'P2', version: 'V1' }]);
    expect(plan.summary.scopeCount).toBe(2);
    expect(plan.summary.eventCount).toBe(150);
    expect(plan.summary.artifactCount).toBe(5);
    expect(plan.summary.detailLines.some((line) => line.includes('P1'))).toBe(true);
    expect(plan.summary.detailLines.some((line) => line.includes('150'))).toBe(true);
  });
});
