/**
 * API request/response type definitions
 */

import type {
  EventIdentity,
  EventMetadataOptionalFields,
  EventStatus,
} from './event-metadata-fields';

// Event metadata from server
export interface EventMetadata extends EventIdentity, EventMetadataOptionalFields {
  uploaded_by_user_id?: string;
  uploaded_by_username?: string;
  last_updated_by_user_id?: string;
  last_updated_by_username?: string;
  status: EventStatus;
  custom_fields?: Record<string, string>;
  source_file?: string;
  row_count?: number;
  has_channel_map?: boolean;
  missing_channel_map?: boolean;
  selectable_for_plotting?: boolean;
  created_at?: string;
  updated_at?: string;
}

// Data selection state
export interface DataState {
  program_ids: string[];
  versions: string[];
  selected_event_ids: string[];
}

// Global filters applied to all events
export type GlobalFilters = Record<string, string[] | string | undefined> & {
  event_id_query?: string;
};

// Events request/response
export interface EventsRequest {
  program_ids?: string[];
  versions?: string[];
  global_filters: GlobalFilters;
}

export interface EventsResponse {
  events: EventMetadata[];
  total_count: number;
  has_more: boolean;
}

export interface EventMetadataUpdateFields {
  job_number?: string | null;
  work_order?: string | null;
  rfq?: boolean | null;
  dv?: boolean | null;
  pv?: boolean | null;
  post_prod?: boolean | null;
  suspension_component?: string | null;
  axle_location?: string | null;
  gvw?: string | null;
  fgawr?: string | null;
  rgawr?: string | null;
  drive_type?: string | null;
  material_construction?: string | null;
  steering_position?: string | null;
  damper_type?: string | null;
  vehicle_type?: string | null;
  status?: string | null;
}

export interface EventMetadataUpdateRequest extends EventMetadataUpdateFields {
  if_unmodified_since: string | null;
}

export interface ProgramVersionMetadataUpdateRequest {
  program_id: string;
  version: string;
  updates: EventMetadataUpdateFields;
}

export interface ProgramVersionMetadataUpdateResponse {
  program_id: string;
  version: string;
  updated_event_count: number;
  status?: string | null;
  uploaded_by_user_id?: string | null;
  uploaded_by_username?: string | null;
  last_updated_by_user_id?: string | null;
  last_updated_by_username?: string | null;
  uploaded_at?: string | null;
  last_updated_at?: string | null;
}

// Filter option entry from server (includes column mapping and order)
export interface FilterOptionEntry {
  column: string;
  order: number;
  values: string[];
  source?: 'core' | 'custom';
  data_type?: string;
}

// Filter options (dynamic from server) - keyed by display name
export type FilterOptions = Record<string, FilterOptionEntry>;

export interface CustomFieldDefinitionRequest {
  field_key: string;
  display_name: string;
  data_type?: string;
  is_filterable?: boolean;
}

export interface CustomFieldDefinitionResponse {
  field_key: string;
  display_name: string;
  data_type: string;
  is_filterable: boolean;
  created_by_user_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ProgramCustomFieldValuesResponse {
  program_id: string;
  values_by_field: Record<string, string[]>;
}

export interface ChannelMapEditorEntry {
  plot_key: string;
  x_col: number;
  y_col: number;
}

export interface ChannelMapEditorResponse {
  program_id: string;
  version: string;
  has_channel_map: boolean;
  missing_channel_map: boolean;
  entries: ChannelMapEditorEntry[];
  preview_lines: string[];
  column_count: number;
  pending_artifact_count: number;
  failed_artifact_count: number;
}

// fallow-ignore-next-line unused-type
export interface ChannelMapProcessResult {
  program_id: string;
  version: string;
  processed_count: number;
  failed_count: number;
  total_rows: number;
  processed: Array<Record<string, unknown>>;
  failed: Array<Record<string, unknown>>;
}

export type DerivedTaskKind = 'channel_reprocess' | 'damage_calculation';

export interface DerivedTaskStartResponse {
  task_id: string;
  task_kind: DerivedTaskKind;
  reused_existing_task: boolean;
}

export interface DerivedTaskStatusEvent {
  task_id: string;
  task_kind: DerivedTaskKind;
  status: string;
  phase: string;
  sub_phase?: string | null;
  progress_message?: string | null;
  completed_events: number;
  total_events: number;
  current_event?: string | null;
  error?: string | null;
  result?: Record<string, unknown> | null;
}

export interface DurabilityScheduleEntryPreview {
  pattern: string;
  repeats: number;
  weight: number;
}

export interface DurabilityScheduleEventRow {
  event_id: string;
  rsp_file_name: string;
  rsp_event_name: string;
  pattern: string;
  repeats: number | null;
  weight: number | null;
  schedule_sequence: number | null;
}

export interface DurabilitySchedulePreview {
  schedule_id: string | null;
  multiplier: number;
  entry_count: number;
  entries: DurabilityScheduleEntryPreview[];
  entries_preview: DurabilityScheduleEntryPreview[];
  event_rows?: DurabilityScheduleEventRow[];
  delimiter_token?: string | null;
}

export interface DurabilityScheduleSaveRequest {
  program_id: string;
  version: string;
  multiplier: number;
  event_rows: DurabilityScheduleEventRow[];
  delimiter_token?: string | null;
}

export interface DurabilityScheduleContextResponse {
  program_id: string;
  version: string;
  schedule_id: number;
  artifact_uri: string;
  schedule_sha256: string;
  source_filename: string;
  parse_preview: DurabilitySchedulePreview;
  schedule_command_outcome?:
    | 'calculation_started'
    | 'reused_active_task'
    | 'rescaled_scheduled_damage'
    | 'validation_blocked'
    | 'failed_to_start';
  damage_task_id?: string;
  damage_task_status?: 'validating' | 'calculating' | 'completed' | 'failed';
  updated_damage_rows?: number | null;
  damage_prerequisite_report?: DamageFailureReport;
}

export interface DurabilityScheduleAttachResponse extends DurabilityScheduleContextResponse {
  replaced_previous: boolean;
  previous_schedule_id: number | null;
}

export type DamageFailureField =
  | 'repeats'
  | 'weight'
  | 'rspEventName'
  | 'schedulePattern'
  | 'event_id'
  | 'channel';

export interface DamageFailureIssue {
  event_id?: string;
  event_name?: string;
  field: DamageFailureField;
  code: string;
  message: string;
}

export interface DamageFailureReport {
  summary: string;
  issues: DamageFailureIssue[];
}

export interface DamageChannelMetadata {
  channel_key: string;
  channel_name: string;
  unit?: string | null;
}

export interface DamageCell {
  damage: number | null;
  base_damage?: number | null;
  status: string;
  error?: string | null;
  stale_reason?: string | null;
}

export interface DamageInspectScopeState {
  program_id: string;
  version: string;
  has_current_results: boolean;
  has_stale_results: boolean;
  needs_damage_repair?: boolean;
  has_active_schedule: boolean;
  can_start_calculation: boolean;
  prerequisite_report?: DamageFailureReport | null;
  failure_report?: DamageFailureReport | null;
  active_damage_task_id?: string | null;
}

export interface DamageCalculateResponse {
  damage_task_id?: string | null;
  task_kind?: 'damage_calculation' | null;
  reused_existing_task?: boolean | null;
  damage_prerequisite_report?: DamageFailureReport | null;
}

export interface DamageInspectRow {
  event_id: string;
  job_number?: string | null;
  work_order?: string | null;
  program_id: string;
  version?: string | null;
  damages: Record<string, DamageCell>;
}

export interface DamageInspectResponse {
  channels: DamageChannelMetadata[];
  rows: DamageInspectRow[];
  has_stale_values?: boolean;
  scopes?: DamageInspectScopeState[];
}

// ============================================================================
// Standard API Error Response
// ============================================================================

/**
 * Standard error response structure from the API
 */
// fallow-ignore-next-line unused-type
export interface APIErrorResponse {
  error: string;
  message: string;
  details?: Record<string, string[]>;
}


// ============================================================================
// SVG Plot Data Types (Client-Side Rendering)
// ============================================================================

/**
 * Single data point for SVG rendering
 */
export interface SVGPoint {
  x: number;
  y: number;
}

/**
 * Curve data for a single event on a plot
 */
export interface SVGCurveData {
  event_id: string;
  points: SVGPoint[];
  x_array?: Float32Array;
  y_array?: Float32Array;
  color?: string;
}

/**
 * All curves for a single plot
 */
export interface SVGPlotCurvesData {
  curves: SVGCurveData[];
  x_label: string;
  y_label: string;
  x_unit: string;
  y_unit: string;
}

/**
 * Metadata about the SVG plot data response
 */
export interface SVGPlotMetadata {
  total_events: number;
  total_points: number;
  scale_factor: number;
}

/**
 * Response from GET /api/v1/dashboard/plots/data
 */
// fallow-ignore-next-line unused-type
export interface SVGPlotDataResponse {
  plots: Record<string, SVGPlotCurvesData>;
  metadata: SVGPlotMetadata;
}

