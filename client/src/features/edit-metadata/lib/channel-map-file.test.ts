import { describe, expect, it } from 'vitest';

import {
  channelMapBasename,
  isValidChannelMapFilename,
  validateChannelMapUploadSelection,
} from '@/features/edit-metadata/lib/channel-map-file';

function fileWithRelativePath(name: string, relativePath: string): File {
  const file = new File(['x_col: 0'], name, { type: 'application/x-yaml' });
  Object.defineProperty(file, 'webkitRelativePath', {
    value: relativePath,
    configurable: true,
  });
  return file;
}

describe('channel-map-file', () => {
  it('normalizes basename from file path and case', () => {
    const file = fileWithRelativePath(
      'CHANNEL_MAP.YML',
      'nested/folder/CHANNEL_MAP.YML',
    );
    expect(channelMapBasename(file)).toBe('channel_map.yml');
    expect(isValidChannelMapFilename(file)).toBe(true);
  });

  it('rejects unrelated yaml basenames', () => {
    const file = new File(['x_col: 0'], 'other_map.yaml', {
      type: 'application/x-yaml',
    });
    expect(isValidChannelMapFilename(file)).toBe(false);
  });

  it('rejects zero and multi-file selections', () => {
    expect(validateChannelMapUploadSelection([]).error).toContain('exactly one');

    const first = new File(['x_col: 0'], 'channel_map.yml');
    const second = new File(['x_col: 1'], 'channel_map.yaml');
    expect(validateChannelMapUploadSelection([first, second]).error).toContain(
      'exactly one',
    );
  });

  it('rejects folder selections even when basename is valid', () => {
    const folderFile = fileWithRelativePath(
      'channel_map.yml',
      'folder/channel_map.yml',
    );
    expect(validateChannelMapUploadSelection([folderFile]).error).toContain(
      'folders',
    );
  });

  it('accepts one valid file and returns it', () => {
    const file = new File(['x_col: 0'], 'channel_map.yaml');
    const result = validateChannelMapUploadSelection([file]);
    expect(result.error).toBeNull();
    expect(result.file).toBe(file);
  });
});
