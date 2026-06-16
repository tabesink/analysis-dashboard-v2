import type { UploadMetadata } from '@/types/upload';

export type UploadDataExtension = '.csv' | '.rsp';

export interface UploadSelectionSummary {
  dataFiles: File[];
  channelMapFile: File | undefined;
  csvCount: number;
  rspCount: number;
  channelMapCount: number;
  dataCount: number;
  ignoredCount: number;
  hasMixedDataTypes: boolean;
}

export const REQUIRED_UPLOAD_FIELDS = [
  'Program ID',
  'Load Version',
  'Job Number',
  'Work Order',
] as const;

const OPTIONAL_UPLOAD_METADATA_FIELD_MAP = {
  'Suspension Component': 'suspension_component',
  'Axle Location': 'axle_location',
  GVW: 'gvw',
  FGAWR: 'fgawr',
  RGAWR: 'rgawr',
  'Drive Type': 'drive_type',
  "Mat'l & Const": 'material_construction',
  Material: 'material_construction',
  Steering: 'steering_position',
  'Steering Position': 'steering_position',
  'Damper Type': 'damper_type',
  'Vehicle Type': 'vehicle_type',
} as const satisfies Record<string, keyof UploadMetadata>;

const REQUIRED_UPLOAD_LABELS: Record<(typeof REQUIRED_UPLOAD_FIELDS)[number], string> = {
  'Program ID': 'Job ID',
  'Load Version': 'Load Version',
  'Job Number': 'Program ID',
  'Work Order': 'Work Order',
};

function channelMapBasename(file: File): string {
  const path = (file.webkitRelativePath || file.name).replace(/\\/g, '/');
  return (path.split('/').pop() ?? path).toLowerCase();
}

export function isChannelMapFile(file: File): boolean {
  const baseName = channelMapBasename(file);
  return baseName === 'channel_map.yaml' || baseName === 'channel_map.yml';
}

export function getDataFileExtension(file: File): UploadDataExtension | null {
  const filename = file.name.toLowerCase();
  if (filename.endsWith('.csv')) return '.csv';
  if (filename.endsWith('.rsp')) return '.rsp';
  return null;
}

export function summarizeUploadSelection(selectedFiles: File[]): UploadSelectionSummary {
  const dataFiles: File[] = [];
  const channelMapFiles: File[] = [];

  selectedFiles.forEach((file) => {
    if (isChannelMapFile(file)) {
      channelMapFiles.push(file);
      return;
    }
    if (getDataFileExtension(file)) {
      dataFiles.push(file);
    }
  });

  const csvCount = dataFiles.filter((file) => getDataFileExtension(file) === '.csv').length;
  const rspCount = dataFiles.filter((file) => getDataFileExtension(file) === '.rsp').length;
  const channelMapCount = channelMapFiles.length;
  const dataCount = dataFiles.length;
  const ignoredCount = Math.max(0, selectedFiles.length - dataCount - channelMapCount);

  return {
    dataFiles,
    channelMapFile: channelMapFiles[0],
    csvCount,
    rspCount,
    channelMapCount,
    dataCount,
    ignoredCount,
    hasMixedDataTypes: csvCount > 0 && rspCount > 0,
  };
}

export function getMissingRequiredUploadFields(
  filters: Record<string, string>,
): (typeof REQUIRED_UPLOAD_FIELDS)[number][] {
  return REQUIRED_UPLOAD_FIELDS.filter((field) => !filters[field]?.trim());
}

export function buildUploadMetadataPayload(
  filters: Record<string, string>,
  options: { isAdmin: boolean },
):
  | { ok: true; metadata: UploadMetadata }
  | { ok: false; missingField: (typeof REQUIRED_UPLOAD_FIELDS)[number]; message: string } {
  const missingField = getMissingRequiredUploadFields(filters)[0];
  if (missingField) {
    return {
      ok: false,
      missingField,
      message: `Please enter a ${REQUIRED_UPLOAD_LABELS[missingField]}`,
    };
  }

  const metadata: UploadMetadata = {
    program_id: filters['Program ID'].trim(),
    version: filters['Load Version'].trim(),
    // Program ID field maps to the existing job_number payload contract.
    job_number: filters['Job Number'].trim(),
    work_order: filters['Work Order'].trim(),
  };

  Object.entries(OPTIONAL_UPLOAD_METADATA_FIELD_MAP).forEach(([displayName, metadataKey]) => {
    const value = filters[displayName]?.trim();
    if (value) {
      metadata[metadataKey] = value;
    }
  });

  const statusValue = filters['Status']?.trim();
  if (options.isAdmin && statusValue) {
    metadata.status = statusValue;
  }

  return { ok: true, metadata };
}

export interface UploadFeedbackNotifier {
  error: (message: string) => void;
  info: (message: string) => void;
}

export function notifyUploadPreflightFeedback(args: {
  metadataResult: ReturnType<typeof buildUploadMetadataPayload>;
  selectionSummary: UploadSelectionSummary;
  notifier: UploadFeedbackNotifier;
}): boolean {
  const { metadataResult, selectionSummary, notifier } = args;

  if (!metadataResult.ok) {
    notifier.error(metadataResult.message);
    return false;
  }

  if (selectionSummary.dataCount === 0) {
    notifier.error('No CSV or RSP files found');
    return false;
  }

  if (selectionSummary.hasMixedDataTypes) {
    notifier.error('Upload either CSV files or RSP files, not both');
    return false;
  }

  if (selectionSummary.ignoredCount > 0) {
    notifier.info(
      `${selectionSummary.ignoredCount} unrelated file${selectionSummary.ignoredCount === 1 ? '' : 's'} will be ignored`,
    );
  }

  return true;
}
