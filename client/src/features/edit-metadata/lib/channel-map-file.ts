export const ALLOWED_CHANNEL_MAP_BASENAMES = new Set(['channel_map.yml', 'channel_map.yaml']);

export function channelMapBasename(file: File): string {
  const path = (file.webkitRelativePath || file.name).replace(/\\/g, '/');
  return (path.split('/').pop() ?? path).toLowerCase();
}

export function isValidChannelMapFilename(file: File): boolean {
  return ALLOWED_CHANNEL_MAP_BASENAMES.has(channelMapBasename(file));
}

function isFolderSelection(file: File): boolean {
  const relativePath = file.webkitRelativePath ?? '';
  return relativePath.includes('/');
}

export function validateChannelMapUploadSelection(files: File[]): {
  file: File | null;
  error: string | null;
} {
  if (files.length !== 1) {
    return {
      file: null,
      error: 'Select exactly one channel_map.yml or channel_map.yaml file.',
    };
  }

  const file = files[0];
  if (isFolderSelection(file)) {
    return {
      file: null,
      error:
        'File folders are not supported here. Select a single channel_map.yml or channel_map.yaml file.',
    };
  }

  if (!isValidChannelMapFilename(file)) {
    return {
      file: null,
      error: 'Only channel_map.yml or channel_map.yaml is accepted.',
    };
  }

  return { file, error: null };
}
