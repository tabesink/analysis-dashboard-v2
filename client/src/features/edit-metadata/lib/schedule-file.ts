export function isValidScheduleFilename(file: File): boolean {
  const path = (file.webkitRelativePath || file.name).replace(/\\/g, '/');
  const basename = (path.split('/').pop() ?? path).toLowerCase();
  return basename.endsWith('.sch');
}

function isFolderSelection(file: File): boolean {
  const relativePath = file.webkitRelativePath ?? '';
  return relativePath.includes('/');
}

export function validateScheduleUploadSelection(files: File[]): {
  file: File | null;
  error: string | null;
} {
  if (files.length !== 1) {
    return {
      file: null,
      error: 'Select exactly one .sch schedule file.',
    };
  }

  const file = files[0];
  if (isFolderSelection(file)) {
    return {
      file: null,
      error: 'File folders are not supported here. Select a single .sch schedule file.',
    };
  }

  if (!isValidScheduleFilename(file)) {
    return {
      file: null,
      error: 'Schedule file must use the .sch extension.',
    };
  }

  return { file, error: null };
}
