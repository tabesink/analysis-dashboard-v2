import { describe, expect, it, vi, beforeEach } from 'vitest';

import { executeScopeDelete } from '@/features/database-scope-delete/execute-scope-delete';
import { buildScopeDeletePlan } from '@/features/database-scope-delete/build-scope-delete-plan';
import { PROGRAM_SCOPE_PREFIX } from '@/components/upload/DatabaseEventTree';
import type { ProgramVersionSummary } from '@/types/upload';

const deleteProgramVersionScope = vi.fn();
const deleteDatasets = vi.fn();

const programVersions: ProgramVersionSummary[] = [
  {
    program_id: 'P1',
    version: 'V1',
    event_count: 5,
    statuses: ['Approved'],
    has_channel_map: true,
    missing_channel_map: false,
    pending_artifact_count: 1,
    failed_artifact_count: 0,
  },
];

describe('executeScopeDelete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteProgramVersionScope.mockResolvedValue({
      deleted: true,
      program_id: 'P1',
      version: null,
      event_count: 5,
      artifact_count: 1,
    });
    deleteDatasets.mockResolvedValue({ deleted_count: 0, event_ids: [] });
  });

  it('deletes selected program scope and returns summary counts', async () => {
    const plan = buildScopeDeletePlan([`${PROGRAM_SCOPE_PREFIX}P1`], programVersions);

    const result = await executeScopeDelete({
      plan,
      deleteProgramVersionScope,
      deleteDatasets,
      onProgress: vi.fn(),
    });

    expect(deleteProgramVersionScope).toHaveBeenCalledWith({ program_id: 'P1' });
    expect(result.success).toBe(true);
    expect(result.deletedEventCount).toBe(5);
    expect(result.deletedArtifactCount).toBe(1);
  });
});
