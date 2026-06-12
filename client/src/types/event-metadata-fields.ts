/**
 * Shared optional metadata fields used across event/dataset/upload types.
 */

export type EventStatus = 'Approved' | 'Obsolete' | 'Pending';

export interface EventMetadataOptionalFields {
  job_number?: string;
  work_order?: string;
  rfq?: boolean;
  dv?: boolean;
  pv?: boolean;
  post_prod?: boolean;
  suspension_component?: string;
  axle_location?: string;
  gvw?: string;
  gross_vehicle_weight_range_lbs?: string;
  fgawr?: string;
  fgawr_range_lbs?: string;
  rgawr?: string;
  rgawr_range_lbs?: string;
  drive_type?: string;
  material_construction?: string;
  steering_position?: string;
  damper_type?: string;
  vehicle_type?: string;
}

export interface EventIdentity {
  event_id: string;
  program_id: string;
  version: string;
}
