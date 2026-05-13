export function shouldStartTrackingOnVisibilityChange(
  visibilityState: DocumentVisibilityState,
  hasActiveTracker: boolean,
): boolean {
  return visibilityState === 'visible' && !hasActiveTracker;
}
