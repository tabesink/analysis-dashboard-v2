import type {
  DamageCell,
  DamageFailureReport,
  DamageInspectResponse,
  DamageInspectScopeState,
} from '@/types/api';

export type InspectDamageViewState = {
  showEmptyState: boolean;
  showStaleWarning: boolean;
  showCalculateAction: boolean;
  showPrerequisiteGuidance: boolean;
  calculateScopes: DamageInspectScopeState[];
  prerequisiteReports: DamageFailureReport[];
  failureReports: DamageFailureReport[];
};

export function resolveInspectDamageViewState(params: {
  response: DamageInspectResponse | null;
  canWrite: boolean;
}): InspectDamageViewState {
  const scopes = params.response?.scopes ?? [];
  const hasCurrentResults = scopes.some((scope) => scope.has_current_results);
  const hasStaleResults = scopes.some((scope) => scope.has_stale_results);
  const hasDisplayableResults = (params.response?.channels.length ?? 0) > 0;
  const showStaleWarning = Boolean(params.response?.has_stale_values);
  const calculateScopes = scopes.filter(
    (scope) => scope.can_start_calculation && scope.has_active_schedule,
  );
  const prerequisiteReports = scopes
    .map((scope) => scope.prerequisite_report)
    .filter((report): report is DamageFailureReport => Boolean(report));
  const failureReports = scopes
    .map((scope) => scope.failure_report)
    .filter((report): report is DamageFailureReport => Boolean(report));

  const showCalculateAction = params.canWrite && calculateScopes.length > 0;
  const showPrerequisiteGuidance =
    params.canWrite &&
    !hasCurrentResults &&
    prerequisiteReports.length > 0 &&
    calculateScopes.length === 0;
  const showEmptyState =
    !hasDisplayableResults && !hasCurrentResults && !hasStaleResults;

  return {
    showEmptyState,
    showStaleWarning,
    showCalculateAction,
    showPrerequisiteGuidance,
    calculateScopes,
    prerequisiteReports,
    failureReports,
  };
}

export function isDamageCellStale(cell: DamageCell | undefined): boolean {
  return cell?.status === 'stale';
}

export function isDamageCellDisplayable(cell: DamageCell | undefined): boolean {
  return cell?.status === 'current' || cell?.status === 'stale' || cell?.status === 'error';
}

export function toPlotDamageCell(cell: DamageCell): DamageCell {
  if (cell.status === 'error') {
    return {
      damage: cell.damage,
      status: 'error',
      error: cell.error ?? null,
    };
  }
  if (!isDamageCellDisplayable(cell)) {
    return {
      damage: cell.damage,
      status: cell.status,
      error: cell.error ?? null,
    };
  }
  return {
    damage: cell.damage,
    status: 'ok',
    error: cell.error ?? null,
  };
}
