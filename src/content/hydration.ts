import { waitForPageHydration } from '../shared/hydration';

// 阅读进度跟踪需要更稳定的正文 DOM，所以等待时间给得更长。
export const READING_HYDRATION_TIMEOUT_MS = 8000;
export const READING_IDLE_TIMEOUT_MS = 1200;

// 索引测量只需要尽快拿到页面高度，不能拖慢太久，所以使用更短的等待时间。
export const INDEXING_HYDRATION_TIMEOUT_MS = 500;
export const INDEXING_IDLE_TIMEOUT_MS = 200;

export function afterHydration(
  hydrationTimeoutMs = READING_HYDRATION_TIMEOUT_MS,
  idleTimeoutMs = READING_IDLE_TIMEOUT_MS,
): Promise<void> {
  // 第一步先等站点自己的 hydration 标记结束，避免在前端框架还没渲染完时读取 DOM。
  return waitForPageHydration(document, hydrationTimeoutMs).then(() => new Promise((resolve) => {
    const run = () => resolve();

    // hydration 结束后再等一次浏览器空闲，让后续的懒渲染、布局计算有机会完成。
    // 支持 requestIdleCallback 的浏览器会在空闲时执行；timeout 保证最多只等 idleTimeoutMs。
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(run, { timeout: idleTimeoutMs });
      return;
    }

    // Firefox 等环境可能没有 requestIdleCallback，用短 setTimeout 兜底；
    // 这里最多等 500ms，避免因为较大的 idleTimeoutMs 让索引流程明显变慢。
    globalThis.setTimeout(run, Math.min(idleTimeoutMs, 500));
  }));
}
