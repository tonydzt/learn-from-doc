export function shouldContinueTracking(input: {
  isSignalAborted: boolean;
  trackedUrl: string;
  currentUrl: string;
}): boolean {
  return !input.isSignalAborted && input.trackedUrl === input.currentUrl;
}

export function shouldFlushTrackingProgress(input: {
  isFinalFlush: boolean;
  isSignalAborted: boolean;
  trackedUrl: string;
  currentUrl: string;
}): boolean {
  if (input.isFinalFlush) return true;
  return !input.isSignalAborted && input.trackedUrl === input.currentUrl;
}

export function shouldStartTrackingOnVisibilityChange(
  visibilityState: DocumentVisibilityState,
  hasActiveTracker: boolean,
): boolean {
  return visibilityState === 'visible' && !hasActiveTracker;
}

export function shouldRestartTrackingForUrl(input: {
  activeTrackedUrl: string | undefined;
  forceRefresh: boolean;
  hasActiveTracker: boolean;
  nextTrackedUrl: string;
}): boolean {
  if (input.forceRefresh) return true;
  return !input.hasActiveTracker || input.activeTrackedUrl !== input.nextTrackedUrl;
}

export function shouldStartReadingTracker(readingProgressEnabled: boolean | undefined): boolean {
  return readingProgressEnabled !== false;
}

export function shouldUsePrefetchedSiteSettings(prefetchedSiteId: string | undefined, currentSiteId: string): boolean {
  return prefetchedSiteId === currentSiteId;
}
