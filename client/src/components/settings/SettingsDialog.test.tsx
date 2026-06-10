import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { SettingsDialog } from '@/components/settings/SettingsDialog';

let mockIsOpen = false;
let mockRoute: 'user-management' | 'database' | 'changelog' = 'user-management';

vi.mock('@radix-ui/react-dialog', () => ({
  Root: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog-root">{children}</div> : null,
  Portal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Overlay: () => <div data-testid="dialog-overlay" />,
  Content: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  Title: ({ children }: { children: React.ReactNode }) => <h1>{children}</h1>,
}));

vi.mock('@/stores/auth-store', () => ({
  selectIsAdmin: (state: { user: { role: string } | null }) =>
    state.user?.role === 'admin',
  useAuthStore: <T,>(selector: (state: { user: { role: string } }) => T) =>
    selector({ user: { role: 'admin' } }),
}));

vi.mock('@/stores/settings-dialog-store', () => ({
  closeSettingsDialog: vi.fn(),
  setSettingsDialogOpen: vi.fn(),
  setSettingsDialogRoute: vi.fn(),
  useSettingsDialogStore: <T,>(
    selector: (state: { isOpen: boolean; route: 'user-management' | 'database' | 'changelog' }) => T,
  ) => selector({ isOpen: mockIsOpen, route: mockRoute }),
}));

vi.mock('@/components/settings/panels/UserManagementSettingsPanel', () => ({
  UserManagementSettingsPanel: () => <div data-testid="user-management-panel" />,
}));

vi.mock('@/components/settings/panels/DatabaseSettingsPanel', () => ({
  DatabaseSettingsPanel: () => <div data-testid="database-panel" />,
}));

vi.mock('@/components/settings/panels/ChangelogSettingsPanel', () => ({
  ChangelogSettingsPanel: () => <div data-testid="changelog-panel" />,
}));

describe('SettingsDialog', () => {
  it('renders nothing when closed', () => {
    mockIsOpen = false;
    mockRoute = 'user-management';
    const markup = renderToStaticMarkup(<SettingsDialog />);
    expect(markup).toBe('');
  });

  it('shows Users panel when opened', () => {
    mockIsOpen = true;
    mockRoute = 'user-management';
    const markup = renderToStaticMarkup(<SettingsDialog />);
    expect(markup).toContain('Users');
    expect(markup).toContain('data-testid="user-management-panel"');
  });

  it('switches to Database panel on route change', () => {
    mockIsOpen = true;
    mockRoute = 'database';
    const markup = renderToStaticMarkup(<SettingsDialog />);
    expect(markup).toContain('Database');
    expect(markup).toContain('data-testid="database-panel"');
  });

  it('switches to Changelog panel on route change', () => {
    mockIsOpen = true;
    mockRoute = 'changelog';
    const markup = renderToStaticMarkup(<SettingsDialog />);
    expect(markup).toContain('Changelog');
    expect(markup).toContain('data-testid="changelog-panel"');
  });
});
