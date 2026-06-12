import type {
  DamageFailureReport,
  DurabilityScheduleContextResponse,
} from '@/types/api';

export type ScheduleDamageResponseResolution =
  | { kind: 'damage_task'; taskId: string }
  | { kind: 'prerequisite_report'; report: DamageFailureReport }
  | { kind: 'none' };

export function resolveScheduleDamageResponse(
  response: DurabilityScheduleContextResponse,
): ScheduleDamageResponseResolution {
  if (
    response.schedule_command_outcome === 'calculation_started' ||
    response.schedule_command_outcome === 'reused_active_task'
  ) {
    if (response.damage_task_id) {
      return { kind: 'damage_task', taskId: response.damage_task_id };
    }
    return { kind: 'none' };
  }

  if (response.schedule_command_outcome === 'validation_blocked') {
    if (response.damage_prerequisite_report) {
      return {
        kind: 'prerequisite_report',
        report: response.damage_prerequisite_report,
      };
    }
    return { kind: 'none' };
  }

  if (response.damage_task_id) {
    return { kind: 'damage_task', taskId: response.damage_task_id };
  }

  if (response.damage_prerequisite_report) {
    return {
      kind: 'prerequisite_report',
      report: response.damage_prerequisite_report,
    };
  }

  return { kind: 'none' };
}
