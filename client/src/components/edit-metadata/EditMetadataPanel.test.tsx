import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { EditMetadataPanel } from '@/components/edit-metadata/EditMetadataPanel';

const mockUseQuery = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    loading: vi.fn(),
    warning: vi.fn(),
  },
}));

let mockAuthRole = 'admin';

vi.mock('@/stores/auth-store', () => ({
  useAuthStore: <T,>(selector: (state: { user: { role: string } }) => T) =>
    selector({ user: { role: mockAuthRole } }),
}));

vi.mock('@/hooks/use-filter-options', () => ({
  useFilterOptions: () => ({
    data: {
      Steering: { column: 'steering', values: ['LHD', 'RHD'], order: 1, source: 'schema' },
      Status: { column: 'status', values: ['Draft', 'Approved'], order: 0, source: 'schema' },
    },
    isLoading: false,
  }),
}));

vi.mock('@/lib/api', () => ({
  dashboardApi: {
    getEvents: vi.fn(),
    updateProgramVersionMetadata: vi.fn(),
  },
}));

vi.mock('@/lib/metadata-save-cache', () => ({
  invalidateQueriesAfterMetadataSave: vi.fn(),
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
}));

vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: () => <input type="checkbox" />,
}));

describe('EditMetadataPanel', () => {
  it('shows read-only messaging and keeps Save disabled when write access is denied', () => {
    mockAuthRole = 'user';
    mockUseQuery.mockReturnValue({
      data: {
        events: [
          {
            event_id: 'e1',
            program_id: 'P1',
            version: 'V1',
            steering: 'LHD',
            status: 'Draft',
            rfq: true,
            dv: false,
            pv: false,
            post_prod: false,
            gvw: '4000',
          },
        ],
      },
      isFetching: false,
      error: null,
    });

    const markup = renderToStaticMarkup(
      <EditMetadataPanel scope={{ programId: 'P1', version: 'V1' }} canWrite={false} />,
    );

    expect(markup).toContain('data-testid="edit-metadata-read-only-notice"');
    expect(markup).toContain('Read-only access — contact admin');
    expect(markup).toMatch(/disabled/);
  });

  it('shows admin-only guidance for status when the user is not an admin', () => {
    mockAuthRole = 'user';
    mockUseQuery.mockReturnValue({
      data: {
        events: [
          {
            event_id: 'e1',
            program_id: 'P1',
            version: 'V1',
            steering: 'LHD',
            status: 'Draft',
            rfq: true,
            dv: false,
            pv: false,
            post_prod: false,
            gvw: '4000',
          },
        ],
      },
      isFetching: false,
      error: null,
    });

    const markup = renderToStaticMarkup(
      <EditMetadataPanel scope={{ programId: 'P1', version: 'V1' }} />,
    );

    expect(markup).toContain('Admin access is required to edit this field.');
  });

  it('renders with an empty scope and keeps Save disabled', () => {
    mockAuthRole = 'admin';
    mockUseQuery.mockReturnValue({
      data: undefined,
      isFetching: false,
      error: null,
    });

    const markup = renderToStaticMarkup(
      <EditMetadataPanel scope={{ programId: '', version: '' }} />,
    );

    expect(markup).toContain('data-testid="edit-metadata-panel"');
    expect(markup).toContain('Save');
    expect(markup).toMatch(/disabled/);
  });

  it('initializes draft values from the supplied scope and keeps Save disabled until dirty', () => {
    mockAuthRole = 'admin';
    mockUseQuery.mockReturnValue({
      data: {
        events: [
          {
            event_id: 'e1',
            program_id: 'P1',
            version: 'V1',
            steering: 'LHD',
            status: 'Draft',
            rfq: true,
            dv: false,
            pv: false,
            post_prod: false,
            gvw: '4000',
          },
        ],
      },
      isFetching: false,
      error: null,
    });

    const markup = renderToStaticMarkup(
      <EditMetadataPanel scope={{ programId: 'P1', version: 'V1' }} />,
    );

    expect(markup).toContain('Applicable Phases');
    expect(markup).toContain('data-testid="edit-metadata-save"');
    expect(markup).toMatch(/disabled/);
  });
});
