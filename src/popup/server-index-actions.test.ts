import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ServerIndexActions, serverAccountCapabilities } from './server-index-actions';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function renderActions(props: Partial<React.ComponentProps<typeof ServerIndexActions>> = {}) {
  const container = document.createElement('div');
  document.body.append(container);
  let root: Root;
  act(() => {
    root = createRoot(container);
    root.render(React.createElement(ServerIndexActions, {
      canPull: false,
      canPullReview: false,
      canUpload: false,
      indexed: false,
      language: 'en',
      serverBusy: false,
      serverIndex: undefined,
      serverError: null,
      onPull: vi.fn(),
      onPullReview: vi.fn(),
      onUpload: vi.fn(),
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

describe('ServerIndexActions', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('shows pull when a server index is available, pull is allowed, and the site is not indexed locally', () => {
    const { container, unmount } = renderActions({
      canPull: true,
      indexed: false,
      serverIndex: { available: true, kinds: ['system'], pageCount: 3, updatedAt: 1 },
    });

    expect(container.textContent).toContain('Pull from server');
    expect(container.textContent).toContain('3 pages');

    unmount();
  });

  it('keeps cached pull actions enabled when no server action is running', () => {
    const { container, unmount } = renderActions({
      canPull: true,
      indexed: false,
      serverBusy: false,
      serverIndex: { available: true, kinds: ['user_upload'], pageCount: 3, updatedAt: 1 },
    });

    expect(container.querySelector('button')?.disabled).toBe(false);

    unmount();
  });

  it('does not show pull when the site is already indexed locally', () => {
    const { container, unmount } = renderActions({
      canPull: true,
      indexed: true,
      serverIndex: { available: true, kinds: ['system'], pageCount: 3, updatedAt: 1 },
    });

    expect(container.textContent).not.toContain('Pull from server');

    unmount();
  });

  it('does not render a manual server availability check button', () => {
    const { container, unmount } = renderActions({
      canPull: true,
    });

    expect(container.textContent).not.toContain('Check server index');

    unmount();
  });

  it('hides pull when the server has no current-site index', () => {
    const { container, unmount } = renderActions({
      canPull: true,
      serverIndex: { available: false, kinds: [] },
    });

    expect(container.textContent).not.toContain('Pull from server');

    unmount();
  });

  it('hides normal pull when availability only has pending review indexes', () => {
    const { container, unmount } = renderActions({
      canPull: true,
      indexed: false,
      serverIndex: { available: true, kinds: ['pending_review'], pageCount: 3, updatedAt: 1 },
    });

    expect(container.textContent).not.toContain('Pull from server');

    unmount();
  });

  it('shows review pull when pending review is available and both permissions are allowed', () => {
    const onPullReview = vi.fn();
    const { container, unmount } = renderActions({
      canPull: true,
      canPullReview: true,
      indexed: false,
      serverIndex: { available: true, kinds: ['pending_review'], pageCount: 3, updatedAt: 1 },
      onPullReview,
    });

    expect(container.textContent).toContain('Pull test index from server');
    act(() => {
      [...container.querySelectorAll('button')]
        .find((button) => button.textContent === 'Pull test index from server')
        ?.click();
    });
    expect(onPullReview).toHaveBeenCalledTimes(1);

    unmount();
  });

  it('hides review pull without the review permission even when pending review is available', () => {
    const { container, unmount } = renderActions({
      canPull: true,
      canPullReview: false,
      indexed: false,
      serverIndex: { available: true, kinds: ['pending_review'], pageCount: 3, updatedAt: 1 },
    });

    expect(container.textContent).not.toContain('Pull test index from server');

    unmount();
  });

  it('shows upload only for indexed sites with sync permission', () => {
    const { container, unmount } = renderActions({
      canUpload: true,
      indexed: true,
    });

    expect(container.textContent).toContain('Upload to server');

    unmount();
  });

  it('does not call pull and upload handlers while busy', () => {
    const onPull = vi.fn();
    const onPullReview = vi.fn();
    const onUpload = vi.fn();
    const { container, unmount } = renderActions({
      canPull: true,
      canPullReview: true,
      canUpload: true,
      indexed: true,
      serverBusy: true,
      serverIndex: { available: true, kinds: ['system', 'pending_review'] },
      onPull,
      onPullReview,
      onUpload,
    });

    const buttons = [...container.querySelectorAll('button')];
    expect(buttons.every((button) => button.disabled)).toBe(true);

    act(() => {
      buttons.forEach((button) => button.click());
    });
    expect(onPull).not.toHaveBeenCalled();
    expect(onPullReview).not.toHaveBeenCalled();
    expect(onUpload).not.toHaveBeenCalled();

    unmount();
  });

  it('shows server errors without hiding local index actions', () => {
    const { container, unmount } = renderActions({
      canUpload: true,
      indexed: true,
      serverError: 'Could not pull server index.',
    });

    expect(container.textContent).toContain('Could not pull server index.');
    expect(container.textContent).toContain('Upload to server');

    unmount();
  });
});

describe('serverAccountCapabilities', () => {
  it('keeps server actions allowed for expired sessions so background auth can refresh tokens', () => {
    expect(serverAccountCapabilities({
      accessToken: 'token-1',
      refreshToken: 'refresh-token-1',
      user: { id: 'user-1', email: 'reader@example.com' },
      permissions: { canSync: true, canPullServerData: true, canTestSystemIndexes: true },
      visiblePermissions: [],
      expiresAt: 1,
      updatedAt: 1,
    }, 2)).toEqual({
      accountStatus: 'expired',
      canPull: true,
      canPullReview: true,
      canUpload: true,
    });
  });

  it('disables server actions only when there is no account session', () => {
    expect(serverAccountCapabilities(null, 2)).toEqual({
      accountStatus: 'logged-out',
      canPull: false,
      canPullReview: false,
      canUpload: false,
    });
  });
});
