import { post } from './client';
import type { DamageCalculateResponse, DamageInspectResponse } from '@/types/api';

export const damageApi = {
  inspect(eventIds: string[]): Promise<DamageInspectResponse> {
    return post<DamageInspectResponse>('/api/v1/damage/inspect', {
      event_ids: eventIds,
    });
  },

  inspectCalculated(): Promise<DamageInspectResponse> {
    return post<DamageInspectResponse>('/api/v1/damage/inspect', {
      include_all_calculated: true,
    });
  },

  calculate(programId: string, version: string): Promise<DamageCalculateResponse> {
    return post<DamageCalculateResponse>('/api/v1/damage/calculate', {
      program_id: programId,
      version,
    });
  },

  backfill(programId: string, version: string): Promise<DamageCalculateResponse> {
    return post<DamageCalculateResponse>('/api/v1/damage/backfill', {
      program_id: programId,
      version,
    });
  },
};
