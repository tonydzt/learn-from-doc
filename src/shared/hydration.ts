export function waitForPageHydration(doc: Document = document, timeoutMs = 8000): Promise<void> {
  const root = doc.documentElement;

  // 有些文档站在前端应用还没水合完成时，会在根节点上标记 data-has-hydrated="false"。
  // 如果没有这个标记，或者标记已经不是 "false"，说明页面已经可以安全读取 DOM。
  if (!root || root.getAttribute('data-has-hydrated') !== 'false') return Promise.resolve();

  return new Promise((resolve) => {
    let settled = false;
    let timeout: ReturnType<typeof globalThis.setTimeout> | undefined;

    const done = () => {
      // MutationObserver 和 timeout 都可能结束等待；settled 用来保证只 resolve 一次，
      // 并且 observer/timer 这些资源也只清理一次。
      if (settled) return;
      settled = true;
      observer.disconnect();
      if (timeout) globalThis.clearTimeout(timeout);
      resolve();
    };

    // 等 data-has-hydrated 从 "false" 变成其他值。这里只监听这个属性，
    // 避免页面启动过程中的其他 DOM 变化反复触发回调。
    const observer = new MutationObserver(() => {
      if (root.getAttribute('data-has-hydrated') !== 'false') done();
    });
    observer.observe(root, { attributes: true, attributeFilter: ['data-has-hydrated'] });

    // 防止站点一直保留这个标记，或者水合脚本没有执行，导致这里永远等下去。
    timeout = globalThis.setTimeout(done, timeoutMs);
  });
}
