import { shouldStartTrackingOnVisibilityChange } from './reading-lifecycle';

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
});
