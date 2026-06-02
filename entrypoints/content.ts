import { browser } from 'wxt/browser';
import { getAdapterForPage, getAdapterForUrl } from '../src/adapters';
import { collectIndexLinks, getPageAdapterContext, runIndexMeasurement } from '../src/content/indexing';
import {
  shouldRestartTrackingForUrl,
  shouldStartTrackingOnVisibilityChange,
} from '../src/content/reading-lifecycle';
import { runReadingTracker, type ReadingTrackerStop } from '../src/content/reading-tracker';
import { removeProgressUi } from '../src/content/progress-ui';
import { getIndexedScopeForCurrentPage, hasOriginPermissionFromBackground } from '../src/content/runtime-client';
import type { RuntimeMessage } from '../src/shared/messages';
import { lfdDebug } from '../src/shared/logger';
import {
  CONTENT_SCRIPT_BOOTING_ATTR,
  CONTENT_SCRIPT_PENDING_ATTR,
  CONTENT_SCRIPT_READY_ATTR,
  INJECTION_SOURCE_ATTR,
} from '../src/shared/constants';
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
    const root = document.documentElement;
    if (root.hasAttribute(CONTENT_SCRIPT_BOOTING_ATTR) || root.hasAttribute(CONTENT_SCRIPT_READY_ATTR)) {
      lfdDebug('content script startup skipped: instance already active', {
        url: location.href,
        booting: root.hasAttribute(CONTENT_SCRIPT_BOOTING_ATTR),
        ready: root.hasAttribute(CONTENT_SCRIPT_READY_ATTR),
      });
      return;
    }
    root.setAttribute(CONTENT_SCRIPT_BOOTING_ATTR, 'true');

    const injectionSource = document.documentElement.getAttribute(INJECTION_SOURCE_ATTR) ?? 'manifest-or-unknown';
    let activeTracker: { controller: AbortController; stop: ReadingTrackerStop } | undefined;
    let activeTrackedUrl: string | undefined;
    let ready = false;
    let observedHref = location.href;
    // routeVersion 用来丢弃过期的异步 startTracking 结果，避免慢启动的旧页面 tracker 覆盖新页面。
    let routeVersion = 0;

    // 当前页面所属的站点范围 ID，用来判断 background 推送的站点设置是否影响当前页面。
    const currentSiteId = () => {
      const scope = getAdapterForPage(location.href)?.getDocScope();
      return scope ? siteIdFor(scope.host, scope.scopeKey) : undefined;
    };

    // 停止当前阅读 tracker：中断事件监听、触发 tracker 自己的最终 flush。
    const stopTracking = async (options: { removeUi?: boolean } = {}) => {
      const tracker = activeTracker;
      activeTracker = undefined;
      activeTrackedUrl = undefined;
      if (!tracker) return;
      tracker.controller.abort();
      await tracker.stop(options);
    };

    // 为当前 URL 启动阅读 tracker。
    // 这个函数会先停掉旧 tracker，再按当前页面状态决定是否真的启动新 tracker。
    const startTracking = async (reason: string, options: { forceRefresh?: boolean } = {}) => {
      const nextTrackedUrl = normalizePageUrl(location.href);
      // 这段逻辑是为了优化部分文档，在同一个页面，经过不同锚点的时候，页面url发生变化的情况，因为url后面带着#hash锚点的名字，这种情况不希望重启 tracker。因为重启tracker会卸载ui然后重新加载ui，导致页面重新渲染，发生闪烁效果，体验不好。
      // activeTrackedUrl 只有在 tracker 成功启动后才赋值，所以首次启动时它是 undefined；
      // 这时 activeTracker 也为空，shouldRestartTrackingForUrl 会允许启动。
      // 例如：
      // - 首次打开 /tutorial/body/#without-pydantic：
      //   activeTracker=false，activeTrackedUrl=undefined -> 启动 tracker。
      // - 滚动到 /tutorial/body/#editor-support：
      //   activeTracker=true，activeTrackedUrl 和 nextTrackedUrl 都是去掉 hash 后的 /tutorial/body/ -> 跳过重启。
      // - 索引完成或站点设置重新启用：
      //   forceRefresh=true -> 即使 normalized URL 没变，也强制重启以刷新页面索引/设置状态。
      if (!shouldRestartTrackingForUrl({
        activeTrackedUrl,
        forceRefresh: options.forceRefresh === true,
        hasActiveTracker: Boolean(activeTracker),
        nextTrackedUrl,
      })) return;

      const version = ++routeVersion;
      await stopTracking({ removeUi: false });

      // background 打开的索引测量页只做正文高度测量，不记录用户阅读进度。
      if (isIndexingUrl(location.href)) return;
      if (!await canRunReadingFeatures()) return;

      lfdDebug('reading tracker route start requested', {
        reason,
        url: location.href,
        normalizedUrl: normalizePageUrl(location.href),
        injectionSource,
      });

      const controller = new AbortController();
      const stop = await runReadingTracker(controller.signal);
      if (!stop) return;

      // 启动期间如果 SPA 又跳到新 URL，这个 tracker 已经过期，立即清理。
      if (version !== routeVersion || controller.signal.aborted) {
        controller.abort();
        await stop();
        return;
      }

      activeTracker = { controller, stop };
      activeTrackedUrl = nextTrackedUrl;
    };

    const markReady = () => {
      ready = true;
      root.setAttribute(CONTENT_SCRIPT_READY_ATTR, 'true');
      root.removeAttribute(CONTENT_SCRIPT_BOOTING_ATTR);
      root.removeAttribute(CONTENT_SCRIPT_PENDING_ATTR);
    };

    const handleObservedLocationChange = (reason: string) => {
      if (location.href === observedHref) return;
      observedHref = location.href;
      void startTracking(reason);
    };

    try {
      // 响应 popup/options/background 发给当前 tab 的消息。
      // 入口层只做分发，具体索引、adapter context、阅读 UI 逻辑都在 src/content/* 模块里。
      const onRuntimeMessage = (message: RuntimeMessage) => {
        if (message.type === 'GET_PAGE_ADAPTER_CONTEXT') return getPageAdapterContext();
        if (message.type === 'COLLECT_INDEX_LINKS') return collectIndexLinks();
        if (message.type === 'INDEX_PROGRESS_UPDATED') return startTracking('index-progress-updated', { forceRefresh: true });
        if (message.type === 'SITE_SETTINGS_UPDATED' && message.siteId === currentSiteId()) {
          if (message.settings.readingProgressEnabled) return startTracking('site-settings-enabled', { forceRefresh: true });
          return stopTracking().then(removeProgressUi);
        }
        return undefined;
      };
      browser.runtime.onMessage.addListener(onRuntimeMessage);

      // WXT 会在 history navigation 时触发这个事件；React/Docusaurus 这类 SPA 不会重新注入 content script。
      ctx.addEventListener(window, 'wxt:locationchange', () => {
        handleObservedLocationChange('locationchange');
      });
      // 有些站点首次 SPA 跳转可能漏掉 WXT 的 locationchange；轮询 URL 作为兜底，不依赖重复注入。
      const locationPoll = globalThis.setInterval(() => handleObservedLocationChange('location-poll'), 500);
      ctx.addEventListener(document, 'visibilitychange', () => {
        // 后台标签页首次注入时正文可能还不可用，切回可见后补一次启动。
        if (shouldStartTrackingOnVisibilityChange(document.visibilityState, Boolean(activeTracker))) {
          void startTracking('visibilitychange');
        }
      });
      ctx.onInvalidated(() => {
        // 扩展热更新、content script 失效或页面卸载前清理入口监听，并尽量停止 tracker。
        root.removeAttribute(CONTENT_SCRIPT_READY_ATTR);
        root.removeAttribute(CONTENT_SCRIPT_BOOTING_ATTR);
        root.removeAttribute(CONTENT_SCRIPT_PENDING_ATTR);
        globalThis.clearInterval(locationPoll);
        browser.runtime.onMessage.removeListener(onRuntimeMessage);
        void stopTracking();
      });

      if (isIndexingUrl(location.href)) {
        // 索引测量模式由 background 打开的临时 tab 触发，只回传正文高度和诊断信息。
        await runIndexMeasurement();
        markReady();
        return;
      }

      // 普通阅读模式：页面满足运行条件时启动 tracker；否则保持 content script 空运行。
      if (await canRunReadingFeatures()) {
        await startTracking('initial-load');
      }
      markReady();
    } catch (error) {
      if (!ready) root.removeAttribute(CONTENT_SCRIPT_BOOTING_ATTR);
      throw error;
    }
  },
});
