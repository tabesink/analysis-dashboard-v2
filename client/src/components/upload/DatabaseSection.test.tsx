import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { DatabaseSection } from '@/features/database/portability';

const baseProps = {
  isAdmin: true,
  isCreatingDatabase: false,
  isConnectingDatabase: false,
  isExporting: false,
  exportProgress: undefined,
  onCreateDatabase: vi.fn(),
  onConnectDatabase: vi.fn(),
  onExportDatabase: vi.fn(),
};

describe('DatabaseSection import removal', () => {
  it('does not render an import control in the active admin database workflow', () => {
    const markup = renderToStaticMarkup(<DatabaseSection {...baseProps} />);

    expect(markup).toContain('Database Administration');
    expect(markup).toContain('Create Managed Database');
    expect(markup).toContain('Switch Active Database');
    expect(markup).toContain('Export Active Database');
    expect(markup).not.toContain('Import Database');
    expect(markup).not.toContain('Database import is no longer available in this workflow');
  });
});
