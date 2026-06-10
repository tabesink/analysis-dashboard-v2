import type { DeleteProgramVersionScopeResponse } from '@/types/upload';
import type { ScopeDeletePlan } from '@/features/database-scope-delete/build-scope-delete-plan';
import type { ScopeDeleteProgressPhase } from '@/features/database-scope-delete/ScopeDeleteOperationModal';

export interface ScopeDeleteProgressUpdate {
  phase: ScopeDeleteProgressPhase;
  message: string;
}

export interface ExecuteScopeDeleteDeps {
  plan: ScopeDeletePlan;
  deleteProgramVersionScope: (payload: {
    program_id: string;
    version?: string;
  }) => Promise<DeleteProgramVersionScopeResponse>;
  deleteDatasets: (eventIds: string[]) => Promise<{ deleted_count: number }>;
  onProgress: (update: ScopeDeleteProgressUpdate) => void;
}

export interface ExecuteScopeDeleteResult {
  success: boolean;
  deletedEventCount: number;
  deletedArtifactCount: number;
  scopeCount: number;
  errorMessage?: string;
}

function scopeProgressMessage(
  scopeLabel: string,
  phase: ScopeDeleteProgressPhase,
): string {
  switch (phase) {
    case 'measurements':
      return `${scopeLabel}: removing measurements and events…`;
    case 'artifacts':
      return `${scopeLabel}: removing artifacts and channel maps…`;
    case 'files':
      return `${scopeLabel}: cleaning up files…`;
    default:
      return `${scopeLabel}: deleting…`;
  }
}

function formatScopeLabel(
  programId: string,
  version: string | null,
  index: number,
  total: number,
): string {
  const target = version ? `${programId} / ${version}` : programId;
  return total === 1 ? `Deleting ${target}` : `Deleting ${target} (${index}/${total})`;
}

export async function executeScopeDelete({
  plan,
  deleteProgramVersionScope,
  deleteDatasets,
  onProgress,
}: ExecuteScopeDeleteDeps): Promise<ExecuteScopeDeleteResult> {
  const scopes: Array<{ program_id: string; version?: string }> = [
    ...plan.programScopes.map((program_id) => ({ program_id })),
    ...plan.effectiveVersionScopes,
  ];
  const totalScopes = scopes.length;
  let deletedEventCount = 0;
  let deletedArtifactCount = 0;

  try {
    for (let index = 0; index < scopes.length; index += 1) {
      const scope = scopes[index];
      const scopeLabel = formatScopeLabel(
        scope.program_id,
        scope.version ?? null,
        index + 1,
        totalScopes,
      );

      onProgress({
        phase: 'measurements',
        message: scopeProgressMessage(scopeLabel, 'measurements'),
      });

      const result = await deleteProgramVersionScope(scope);
      deletedEventCount += result.event_count;
      deletedArtifactCount += result.artifact_count;

      onProgress({
        phase: 'artifacts',
        message: scopeProgressMessage(scopeLabel, 'artifacts'),
      });
      onProgress({
        phase: 'files',
        message: scopeProgressMessage(scopeLabel, 'files'),
      });
    }

    if (plan.eventIds.length > 0) {
      onProgress({
        phase: 'measurements',
        message: `Deleting ${plan.eventIds.length} selected event${
          plan.eventIds.length === 1 ? '' : 's'
        }…`,
      });
      await deleteDatasets(plan.eventIds);
      deletedEventCount += plan.eventIds.length;
    }

    return {
      success: true,
      deletedEventCount,
      deletedArtifactCount,
      scopeCount: plan.summary.scopeCount,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to delete program/version scope';
    return {
      success: false,
      deletedEventCount,
      deletedArtifactCount,
      scopeCount: plan.summary.scopeCount,
      errorMessage: message.includes('another user')
        ? 'Contact an admin to delete data owned by another user.'
        : message,
    };
  }
}
