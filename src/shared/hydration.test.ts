import { waitForPageHydration } from './hydration';

describe('waitForPageHydration', () => {
  it('resolves immediately when the page has no hydration marker', async () => {
    document.documentElement.removeAttribute('data-has-hydrated');

    await expect(waitForPageHydration(document)).resolves.toBeUndefined();
  });

  it('waits for Docusaurus hydration marker to change', async () => {
    document.documentElement.setAttribute('data-has-hydrated', 'false');
    const done = vi.fn();

    const pending = waitForPageHydration(document).then(done);
    await Promise.resolve();
    expect(done).not.toHaveBeenCalled();

    document.documentElement.setAttribute('data-has-hydrated', 'true');
    await pending;

    expect(done).toHaveBeenCalledOnce();
  });
});
