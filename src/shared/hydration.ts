export function waitForPageHydration(doc: Document = document, timeoutMs = 8000): Promise<void> {
  const root = doc.documentElement;
  if (!root || root.getAttribute('data-has-hydrated') !== 'false') return Promise.resolve();

  return new Promise((resolve) => {
    let settled = false;
    let timeout: ReturnType<typeof globalThis.setTimeout> | undefined;

    const done = () => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      if (timeout) globalThis.clearTimeout(timeout);
      resolve();
    };

    const observer = new MutationObserver(() => {
      if (root.getAttribute('data-has-hydrated') !== 'false') done();
    });
    observer.observe(root, { attributes: true, attributeFilter: ['data-has-hydrated'] });

    timeout = globalThis.setTimeout(done, timeoutMs);
  });
}
