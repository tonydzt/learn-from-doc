const READING_TRACKER_OWNER_ATTR = 'data-developer-docs-progress-tracker-owner';

export function claimReadingTrackerOwner(root: HTMLElement, ownerId: string): void {
  root.setAttribute(READING_TRACKER_OWNER_ATTR, ownerId);
}

export function isReadingTrackerOwner(root: HTMLElement, ownerId: string): boolean {
  return root.getAttribute(READING_TRACKER_OWNER_ATTR) === ownerId;
}

export function shouldContinueTracking(input: {
  isActiveOwner: boolean;
  trackedUrl: string;
  currentUrl: string;
}): boolean {
  return input.isActiveOwner && input.trackedUrl === input.currentUrl;
}

export function shouldFlushTrackingProgress(input: {
  isActiveOwner: boolean;
  isFinalFlush: boolean;
  isSignalAborted: boolean;
  trackedUrl: string;
  currentUrl: string;
}): boolean {
  if (!input.isActiveOwner) return false;
  if (input.isFinalFlush) return true;
  return !input.isSignalAborted && input.trackedUrl === input.currentUrl;
}

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
