import { browser } from 'wxt/browser';
import { getAdapterForPage, getAdapterForUrl } from '../src/adapters';
import { collectIndexLinks, getPageAdapterContext, runIndexMeasurement } from '../src/content/indexing';
import { claimReadingTrackerOwner, shouldStartTrackingOnVisibilityChange } from '../src/content/reading-lifecycle';
import { runReadingTracker, type ReadingTrackerStop } from '../src/content/reading-tracker';
import { removeProgressUi } from '../src/content/progress-ui';
import { getIndexedScopeForCurrentPage, hasOriginPermissionFromBackground } from '../src/content/runtime-client';
import type { RuntimeMessage } from '../src/shared/messages';
import { lfdDebug } from '../src/shared/logger';
import { isIndexingUrl, normalizePageUrl, siteIdFor } from '../src/shared/url';

// 判断当前页面是否允许启动阅读相关能力。
// 固定支持站点直接放行；用户授权过 origin 或该 URL 已属于某个索引范围时，也允许动态注入。
async function canRunReadingFeatures(): Promise<boolean> {
  if (getAdapterForUrl(location.href)) return true;
  if (await hasOriginPermissionFromBackground()) return true;
  return Boolean(await getIndexedScopeForCurrentPage());
}

export default defineContentScript({
  matches: [
    'https://react.dev/*',
    'https://playwright.dev/docs*',
    'https://developers.openai.com/*',
  ],
  runAt: 'document_end',
  async main(ctx) {
    // 每次 content script 实例启动时认领一个 ownerId。
    // 如果热更新、重复注入或 SPA 路由切换产生旧 tracker，owner 校验会阻止旧实例继续写进度。
    const ownerId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    claimReadingTrackerOwner(document.documentElement, ownerId);
    let activeTracker: { controller: AbortController; stop: ReadingTrackerStop } | undefined;
    // routeVersion 用来丢弃过期的异步 startTracking 结果，避免慢启动的旧页面 tracker 覆盖新页面。
    let routeVersion = 0;

    // 当前页面所属的站点范围 ID，用来判断 background 推送的站点设置是否影响当前页面。
    const currentSiteId = () => {
      const scope = getAdapterForPage(location.href)?.getDocScope();
      return scope ? siteIdFor(scope.host, scope.scopeKey) : undefined;
    };

    // 停止当前阅读 tracker：中断事件监听、触发 tracker 自己的最终 flush，并移除页面注入 UI。
    const stopTracking = async () => {
      const tracker = activeTracker;
      activeTracker = undefined;
      if (!tracker) return;
      tracker.controller.abort();
      await tracker.stop();
    };

    // 为当前 URL 启动阅读 tracker。
    // 这个函数会先停掉旧 tracker，再按当前页面状态决定是否真的启动新 tracker。
    const startTracking = async (reason: string) => {
      const version = ++routeVersion;
      await stopTracking();

      // background 打开的索引测量页只做正文高度测量，不记录用户阅读进度。
      if (isIndexingUrl(location.href)) return;
      if (!await canRunReadingFeatures()) return;

      lfdDebug('reading tracker route start requested', {
        reason,
        url: location.href,
        normalizedUrl: normalizePageUrl(location.href),
        ownerId,
      });

      const controller = new AbortController();
      const stop = await runReadingTracker(controller.signal, ownerId);
      if (!stop) return;

      // 启动期间如果 SPA 又跳到新 URL，这个 tracker 已经过期，立即清理。
      if (version !== routeVersion || controller.signal.aborted) {
        controller.abort();
        await stop();
        return;
      }

      activeTracker = { controller, stop };
    };

    // 响应 popup/options/background 发给当前 tab 的消息。
    // 入口层只做分发，具体索引、adapter context、阅读 UI 逻辑都在 src/content/* 模块里。
    browser.runtime.onMessage.addListener((message: RuntimeMessage) => {
      if (message.type === 'CONTENT_SCRIPT_PING') return true;
      if (message.type === 'GET_PAGE_ADAPTER_CONTEXT') return getPageAdapterContext();
      if (message.type === 'COLLECT_INDEX_LINKS') return collectIndexLinks();
      if (message.type === 'INDEX_PROGRESS_UPDATED') return startTracking('index-progress-updated');
      if (message.type === 'SITE_SETTINGS_UPDATED' && message.siteId === currentSiteId()) {
        if (message.settings.readingProgressEnabled) return startTracking('site-settings-enabled');
        return stopTracking().then(removeProgressUi);
      }
      return undefined;
    });

    // WXT 会在 history navigation 时触发这个事件；React/Docusaurus 这类 SPA 不会重新注入 content script。
    ctx.addEventListener(window, 'wxt:locationchange', () => {
      void startTracking('locationchange');
    });
    ctx.addEventListener(document, 'visibilitychange', () => {
      // 后台标签页首次注入时正文可能还不可用，切回可见后补一次启动。
      if (shouldStartTrackingOnVisibilityChange(document.visibilityState, Boolean(activeTracker))) {
        void startTracking('visibilitychange');
      }
    });
    ctx.onInvalidated(() => {
      // 扩展热更新、content script 失效或页面卸载前尽量清理 tracker。
      void stopTracking();
    });

    if (isIndexingUrl(location.href)) {
      // 索引测量模式由 background 打开的临时 tab 触发，只回传正文高度和诊断信息。
      await runIndexMeasurement();
      return;
    }

    // 普通阅读模式：页面满足运行条件时启动 tracker；否则保持 content script 空运行。
    if (await canRunReadingFeatures()) {
      await startTracking('initial-load');
    }
  },
});
