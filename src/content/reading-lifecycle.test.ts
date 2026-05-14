import {
  claimReadingTrackerOwner,
  isReadingTrackerOwner,
  shouldContinueTracking,
  shouldFlushTrackingProgress,
  shouldStartReadingTracker,
  shouldStartTrackingOnVisibilityChange,
  shouldUsePrefetchedSiteSettings,
} from './reading-lifecycle';

describe('reading tracker lifecycle', () => {
  it('starts tracking when a tab becomes visible without an active tracker', () => {
    expect(shouldStartTrackingOnVisibilityChange('visible', false)).toBe(true);
  });

  it('does not restart tracking when a visible tab already has an active tracker', () => {
    expect(shouldStartTrackingOnVisibilityChange('visible', true)).toBe(false);
  });

  it('does not start tracking when a tab becomes hidden', () => {
    expect(shouldStartTrackingOnVisibilityChange('hidden', false)).toBe(false);
  });

  it('starts tracking when site reading progress is enabled or missing', () => {
    expect(shouldStartReadingTracker(undefined)).toBe(true);
    expect(shouldStartReadingTracker(true)).toBe(true);
  });

  it('does not start tracking when site reading progress is disabled', () => {
    expect(shouldStartReadingTracker(false)).toBe(false);
  });

  it('uses prefetched site settings only for the same site', () => {
    expect(shouldUsePrefetchedSiteSettings('react.dev::learn', 'react.dev::learn')).toBe(true);
    expect(shouldUsePrefetchedSiteSettings('react.dev::learn', 'react.dev::reference-react')).toBe(false);
    expect(shouldUsePrefetchedSiteSettings(undefined, 'react.dev::learn')).toBe(false);
  });

  it('lets the latest content script owner invalidate older owners', () => {
    const root = document.createElement('html');
    claimReadingTrackerOwner(root, 'first');
    expect(isReadingTrackerOwner(root, 'first')).toBe(true);

    claimReadingTrackerOwner(root, 'second');
    expect(isReadingTrackerOwner(root, 'first')).toBe(false);
    expect(isReadingTrackerOwner(root, 'second')).toBe(true);
  });

  it('continues tracking only for the active owner on the same url', () => {
    expect(shouldContinueTracking({
      isActiveOwner: true,
      trackedUrl: 'https://ui.shadcn.com/docs/cli',
      currentUrl: 'https://ui.shadcn.com/docs/cli',
    })).toBe(true);
    expect(shouldContinueTracking({
      isActiveOwner: false,
      trackedUrl: 'https://ui.shadcn.com/docs/cli',
      currentUrl: 'https://ui.shadcn.com/docs/cli',
    })).toBe(false);
    expect(shouldContinueTracking({
      isActiveOwner: true,
      trackedUrl: 'https://ui.shadcn.com/docs/cli',
      currentUrl: 'https://ui.shadcn.com/docs/components/button',
    })).toBe(false);
  });

  it('allows final flush for the active owner after route changes or aborts', () => {
    expect(shouldFlushTrackingProgress({
      isActiveOwner: true,
      isFinalFlush: true,
      isSignalAborted: true,
      trackedUrl: 'https://reactnative.dev/docs/view',
      currentUrl: 'https://reactnative.dev/docs/text',
    })).toBe(true);
  });

  it('blocks live flush after route changes and all flushes from stale owners', () => {
    expect(shouldFlushTrackingProgress({
      isActiveOwner: true,
      isFinalFlush: false,
      isSignalAborted: false,
      trackedUrl: 'https://reactnative.dev/docs/view',
      currentUrl: 'https://reactnative.dev/docs/text',
    })).toBe(false);
    expect(shouldFlushTrackingProgress({
      isActiveOwner: false,
      isFinalFlush: true,
      isSignalAborted: true,
      trackedUrl: 'https://reactnative.dev/docs/view',
      currentUrl: 'https://reactnative.dev/docs/text',
    })).toBe(false);
  });
});
