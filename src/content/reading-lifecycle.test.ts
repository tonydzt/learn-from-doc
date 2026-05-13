import { shouldStartReadingTracker, shouldStartTrackingOnVisibilityChange, shouldUsePrefetchedSiteSettings } from './reading-lifecycle';

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
});
