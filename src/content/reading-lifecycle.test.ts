import {
  shouldContinueTracking,
  shouldFlushTrackingProgress,
  shouldStartReadingTracker,
  shouldRestartTrackingForUrl,
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

  it('does not restart tracking for anchor-only route changes on the same page', () => {
    expect(shouldRestartTrackingForUrl({
      activeTrackedUrl: 'https://fastapi.tiangolo.com/tutorial/body/',
      forceRefresh: false,
      hasActiveTracker: true,
      nextTrackedUrl: 'https://fastapi.tiangolo.com/tutorial/body/',
    })).toBe(false);
  });

  it('restarts tracking on the same page when a refresh is explicitly requested', () => {
    expect(shouldRestartTrackingForUrl({
      activeTrackedUrl: 'https://fastapi.tiangolo.com/tutorial/body/',
      forceRefresh: true,
      hasActiveTracker: true,
      nextTrackedUrl: 'https://fastapi.tiangolo.com/tutorial/body/',
    })).toBe(true);
  });

  it('starts tracking when site reading progress is enabled or missing', () => {
    expect(shouldStartReadingTracker({
      siteReadingProgressEnabled: undefined,
      pageReadingProgressEnabled: undefined,
      defaultPageReadingProgressEnabled: true,
    })).toBe(true);
    expect(shouldStartReadingTracker({
      siteReadingProgressEnabled: true,
      pageReadingProgressEnabled: undefined,
      defaultPageReadingProgressEnabled: true,
    })).toBe(true);
  });

  it('does not start tracking when site reading progress is disabled', () => {
    expect(shouldStartReadingTracker({
      siteReadingProgressEnabled: false,
      pageReadingProgressEnabled: true,
      defaultPageReadingProgressEnabled: true,
    })).toBe(false);
  });

  it('uses page settings before the app default', () => {
    expect(shouldStartReadingTracker({
      siteReadingProgressEnabled: true,
      pageReadingProgressEnabled: true,
      defaultPageReadingProgressEnabled: false,
    })).toBe(true);
    expect(shouldStartReadingTracker({
      siteReadingProgressEnabled: true,
      pageReadingProgressEnabled: false,
      defaultPageReadingProgressEnabled: true,
    })).toBe(false);
  });

  it('uses the app default when the page has no override', () => {
    expect(shouldStartReadingTracker({
      siteReadingProgressEnabled: true,
      pageReadingProgressEnabled: undefined,
      defaultPageReadingProgressEnabled: false,
    })).toBe(false);
  });

  it('uses prefetched site settings only for the same site', () => {
    expect(shouldUsePrefetchedSiteSettings('react.dev::learn', 'react.dev::learn')).toBe(true);
    expect(shouldUsePrefetchedSiteSettings('react.dev::learn', 'react.dev::reference-react')).toBe(false);
    expect(shouldUsePrefetchedSiteSettings(undefined, 'react.dev::learn')).toBe(false);
  });

  it('continues tracking only while active on the same url', () => {
    expect(shouldContinueTracking({
      isSignalAborted: false,
      trackedUrl: 'https://ui.shadcn.com/docs/cli',
      currentUrl: 'https://ui.shadcn.com/docs/cli',
    })).toBe(true);
    expect(shouldContinueTracking({
      isSignalAborted: true,
      trackedUrl: 'https://ui.shadcn.com/docs/cli',
      currentUrl: 'https://ui.shadcn.com/docs/cli',
    })).toBe(false);
    expect(shouldContinueTracking({
      isSignalAborted: false,
      trackedUrl: 'https://ui.shadcn.com/docs/cli',
      currentUrl: 'https://ui.shadcn.com/docs/components/button',
    })).toBe(false);
  });

  it('allows final flush after route changes or aborts', () => {
    expect(shouldFlushTrackingProgress({
      isFinalFlush: true,
      isSignalAborted: true,
      trackedUrl: 'https://reactnative.dev/docs/view',
      currentUrl: 'https://reactnative.dev/docs/text',
    })).toBe(true);
  });

  it('blocks live flush after route changes or aborts', () => {
    expect(shouldFlushTrackingProgress({
      isFinalFlush: false,
      isSignalAborted: false,
      trackedUrl: 'https://reactnative.dev/docs/view',
      currentUrl: 'https://reactnative.dev/docs/text',
    })).toBe(false);
    expect(shouldFlushTrackingProgress({
      isFinalFlush: false,
      isSignalAborted: true,
      trackedUrl: 'https://reactnative.dev/docs/view',
      currentUrl: 'https://reactnative.dev/docs/view',
    })).toBe(false);
  });
});
