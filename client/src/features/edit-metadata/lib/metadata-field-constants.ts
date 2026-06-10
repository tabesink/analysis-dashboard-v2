export const RAW_WEIGHT_FIELDS = [
  { key: 'gvw', label: 'GVW (lbs)' },
  { key: 'fgawr', label: 'FGAWR (lbs)' },
  { key: 'rgawr', label: 'RGAWR (lbs)' },
] as const;

export const PHASE_FIELDS = [
  { key: 'rfq', label: 'RFQ' },
  { key: 'dv', label: 'DV' },
  { key: 'pv', label: 'PV' },
  { key: 'post_prod', label: 'Post-Prod' },
] as const;

export const EXCLUDED_METADATA_COLUMNS = new Set([
  'rfq',
  'dv',
  'pv',
  'post_prod',
  'gross_vehicle_weight_range_lbs',
  'fgawr_range_lbs',
  'rgawr_range_lbs',
]);
