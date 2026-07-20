import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { AccountSession } from '../../../../src/settings/account-session';
import { AccountPage } from './AccountPage';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function renderAccountPage(props: Partial<React.ComponentProps<typeof AccountPage>> = {}) {
  const container = document.createElement('div');
  document.body.append(container);
  let root: Root;
  act(() => {
    root = createRoot(container);
    root.render(React.createElement(AccountPage, {
      accountBusy: false,
      accountError: null,
      accountSession: null,
      loginAccount: vi.fn(),
      logoutAccount: vi.fn(),
      refreshAccountPermissions: vi.fn(),
      ...props,
    }));
  });
  return {
    container,
    unmount() {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe('AccountPage', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders a login form when no account session exists', () => {
    const { container, unmount } = renderAccountPage();

    expect(container.querySelector('input[type="email"]')).not.toBeNull();
    expect(container.querySelector('input[type="password"]')).not.toBeNull();
    expect(container.textContent).toContain('Server account');
    expect(container.textContent).toContain('Log in');

    unmount();
  });

  it('submits email and password to the login handler', () => {
    const loginAccount = vi.fn();
    const { container, unmount } = renderAccountPage({ loginAccount });
    const email = container.querySelector('input[type="email"]') as HTMLInputElement;
    const password = container.querySelector('input[type="password"]') as HTMLInputElement;
    const form = container.querySelector('form') as HTMLFormElement;

    act(() => {
      email.value = 'reader@example.com';
      email.dispatchEvent(new Event('input', { bubbles: true }));
      password.value = 'secret';
      password.dispatchEvent(new Event('input', { bubbles: true }));
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(loginAccount).toHaveBeenCalledWith('reader@example.com', 'secret');

    unmount();
  });

  it('shows logged in user permissions and logout actions', () => {
    const accountSession: AccountSession = {
      accessToken: 'token-1',
      user: { id: 'user-1', email: 'reader@example.com', name: 'Reader' },
      permissions: {
        canSync: true,
        canPullServerData: false,
        canTestSystemIndexes: true,
        hiddenPermission: true,
      },
      visiblePermissions: [
        { key: 'canPullServerData', label: 'Pull from server' },
        { key: 'canSync', label: 'Sync devices' },
        { key: 'canTestSystemIndexes', label: 'Test system indexes' },
      ],
      expiresAt: Date.parse('2100-01-01T00:00:00Z'),
      updatedAt: 1,
    };
    const logoutAccount = vi.fn();
    const refreshAccountPermissions = vi.fn();
    const { container, unmount } = renderAccountPage({
      accountSession,
      logoutAccount,
      refreshAccountPermissions,
    });

    expect(container.textContent).toContain('Reader');
    expect(container.textContent).toContain('reader@example.com');
    expect([...container.querySelectorAll('.permission-row span')].map((element) => element.textContent)).toEqual([
      'Pull from server',
      'Sync devices',
      'Test system indexes',
    ]);
    expect([...container.querySelectorAll('.permission-row strong')].map((element) => element.textContent)).toEqual([
      'Disabled',
      'Enabled',
      'Enabled',
    ]);
    expect(container.textContent).not.toContain('hiddenPermission');

    const buttons = [...container.querySelectorAll('button')];
    act(() => {
      buttons.find((button) => button.textContent === 'Refresh permissions')?.click();
      buttons.find((button) => button.textContent === 'Log out')?.click();
    });

    expect(refreshAccountPermissions).toHaveBeenCalled();
    expect(logoutAccount).toHaveBeenCalled();

    unmount();
  });

  it('hides a false test-system-indexes permission without hiding other disabled permissions', () => {
    const { container, unmount } = renderAccountPage({
      accountSession: {
        accessToken: 'token-1',
        user: { id: 'user-1', email: 'reader@example.com' },
        permissions: {
          canSync: false,
          canPullServerData: true,
          canTestSystemIndexes: false,
        },
        visiblePermissions: [
          { key: 'canSync', label: 'Sync devices' },
          { key: 'canTestSystemIndexes', label: 'Test system indexes' },
        ],
        expiresAt: Date.parse('2100-01-01T00:00:00Z'),
        updatedAt: 1,
      },
    });

    expect(container.textContent).toContain('Sync devices');
    expect(container.textContent).toContain('Disabled');
    expect(container.textContent).not.toContain('Test system indexes');

    unmount();
  });

  it('shows expired account status and the stored expiry time', () => {
    const { container, unmount } = renderAccountPage({
      now: Date.parse('2026-06-10T00:00:00Z'),
      accountSession: {
        accessToken: 'token-1',
        user: { id: 'user-1', email: 'reader@example.com' },
        permissions: {
          canSync: false,
          canPullServerData: true,
          canTestSystemIndexes: false,
        },
        visiblePermissions: [{ key: 'canPullServerData', label: 'Pull from server' }],
        expiresAt: Date.parse('2026-06-09T00:00:00Z'),
        updatedAt: 1,
      },
    });

    expect(container.textContent).toContain('Login expired');
    expect(container.textContent).toContain('Expires at');
    expect(container.textContent).toContain('2026');
    expect(container.querySelector('input[type="email"]')).not.toBeNull();

    unmount();
  });
});
