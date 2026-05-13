export function shouldStartTrackingOnVisibilityChange(
  visibilityState: DocumentVisibilityState,
  hasActiveTracker: boolean,
): boolean {
  return visibilityState === 'visible' && !hasActiveTracker;
}

export function shouldStartReadingTracker(readingProgressEnabled: boolean | undefined): boolean {
  return readingProgressEnabled !== false;
}

export function shouldUsePrefetchedSiteSettings(prefetchedSiteId: string | undefined, currentSiteId: string): boolean {
  return prefetchedSiteId === currentSiteId;
}
