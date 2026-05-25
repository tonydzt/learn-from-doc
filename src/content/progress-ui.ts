import { getAdapterForPage } from '../adapters';
import { t } from '../i18n/messages';
import { isSubdirectoryPage, pageProgressPercent, totalProgressPercent } from '../progress/calculations';
import { readingMapSegments, viewportMapSegment } from '../progress/reading-map';
import type { ViewedRange } from '../progress/ranges';
import type { AppSettings } from '../settings/app-settings';
import { DATA_ATTR } from '../shared/constants';
import type { PageIndexRecord, ProgressRecord } from '../storage/db';
import { getPagesFromBackground, getProgressForSiteFromBackground } from './runtime-client';

export type ProgressUiSnapshot = {
  pages: PageIndexRecord[];
  progress: ProgressRecord[];
};

function injectStyles() {
  // content script 会多次重新渲染 UI；样式只注入一次，避免页面中累积重复的 <style>。
  if (document.querySelector(`[${DATA_ATTR}="styles"]`)) return;
  const style = document.createElement('style');
  style.setAttribute(DATA_ATTR, 'styles');
  style.textContent = `
    .lfd-total-card {
      box-sizing: border-box;
      margin: 0 0 14px;
      padding: 12px;
      border: 1px solid rgba(15, 23, 42, 0.12);
      border-radius: 8px;
      background: linear-gradient(135deg, rgba(255,255,255,.96), rgba(246,248,251,.96));
      box-shadow: 0 10px 28px rgba(15, 23, 42, 0.08);
      color: #111827;
      font: 500 12px/1.35 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .lfd-total-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 8px;
    }
    .lfd-total-title {
      color: #475569;
      letter-spacing: .01em;
    }
    .lfd-total-value {
      color: #0f766e;
      font-weight: 750;
    }
    .lfd-total-track {
      overflow: hidden;
      height: 7px;
      border-radius: 999px;
      background: #e2e8f0;
    }
    .lfd-total-fill {
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, #14b8a6, #0f766e);
      transition: width 180ms ease;
    }
    .lfd-page-badge {
      display: inline-flex;
      flex: 0 0 auto;
      align-items: center;
      margin-left: 7px;
      padding: 1px 6px;
      border-radius: 999px;
      background: rgba(20, 184, 166, 0.1);
      color: #0f766e;
      font: 700 10px/1.5 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      vertical-align: middle;
      white-space: nowrap;
    }
    .lfd-page-link-with-badge {
      display: flex !important;
      align-items: center;
      gap: 7px;
    }
    .lfd-page-link-with-badge > :not([data-developer-docs-progress-tracker="page-badge"]) {
      flex: 1 1 auto;
      min-width: 0;
    }
    .lfd-page-link-with-badge > .lfd-page-badge {
      margin-left: 0;
    }
    .lfd-subdirectory-badge {
      background: rgba(220, 38, 38, 0.1);
      color: #dc2626;
    }
    .lfd-reading-map {
      position: fixed;
      top: 0;
      bottom: 0;
      right: 18px;
      z-index: 2147483646;
      width: 8px;
      border-left: 1px solid rgba(15, 23, 42, 0.1);
      border-right: 1px solid rgba(255, 255, 255, 0.54);
      background: linear-gradient(180deg, rgba(15, 23, 42, 0.04), rgba(15, 23, 42, 0.015));
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.44), 0 0 18px rgba(15, 23, 42, 0.1);
      overflow: hidden;
      pointer-events: none;
    }
    .lfd-reading-map-segment {
      position: absolute;
      left: 1px;
      right: 1px;
      border-radius: 999px;
      background: linear-gradient(180deg, #34d399, #059669);
      box-shadow: 0 0 10px rgba(5, 150, 105, 0.38);
    }
    .lfd-reading-map-viewport {
      position: absolute;
      left: -2px;
      right: -2px;
      min-height: 10px;
      border: 1px solid rgba(6, 78, 59, 0.72);
      border-radius: 999px;
      background: rgba(236, 253, 245, 0.72);
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.78), 0 2px 9px rgba(6, 78, 59, 0.24);
    }
  `;
  document.documentElement.append(style);
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

export async function renderProgressUi(
  siteId: string,
  language: AppSettings['language'],
  snapshot?: ProgressUiSnapshot,
) {
  // adapter 决定当前站点的侧栏在哪里，以及总进度和每页 badge 应该插入到哪些节点。
  const adapter = getAdapterForPage(location.href);
  const targets = adapter?.getProgressInsertionTargets();
  if (!targets) return;

  // reading tracker 已经持有最新内存状态时直接使用 snapshot，避免每次重绘都请求 background。
  // 单独调用本函数时则回退到读取已持久化的数据。
  const [pages, progress] = snapshot
    ? [snapshot.pages, snapshot.progress]
    : await Promise.all([
      getPagesFromBackground(siteId),
      getProgressForSiteFromBackground(siteId),
    ]);
  const progressByUrl = new Map(progress.map((entry) => [entry.url, entry]));
  const pageByUrl = new Map(pages.map((page) => [page.url, page]));

  injectStyles();

  // 总进度卡片只在第一次渲染时创建，之后只更新文字和进度条宽度。
  let totalCard = targets.sidebarRoot.querySelector<HTMLElement>('[data-developer-docs-progress-tracker="total"]');
  if (!totalCard) {
    totalCard = document.createElement('div');
    totalCard.className = 'lfd-total-card';
    totalCard.setAttribute(DATA_ATTR, 'total');
    totalCard.innerHTML = `
      <div class="lfd-total-row">
        <span class="lfd-total-title"></span>
        <span class="lfd-total-value">0%</span>
      </div>
      <div class="lfd-total-track"><div class="lfd-total-fill"></div></div>
    `;
    targets.sidebarRoot.insertBefore(totalCard, targets.totalProgressBefore);
  }

  const total = totalProgressPercent(pages, progress);
  totalCard.querySelector<HTMLElement>('.lfd-total-title')!.textContent = t(language, 'content.docProgress');
  totalCard.querySelector<HTMLElement>('.lfd-total-value')!.textContent = formatPercent(total);
  totalCard.querySelector<HTMLElement>('.lfd-total-fill')!.style.width = `${total}%`;

  // SPA 导航或侧栏重新渲染后，旧链接可能已经不在 adapter 返回的目标列表里。
  // 先清理这些遗留 badge，防止错误页面仍显示进度。
  const targetAnchors = new Set(targets.pageLinkTargets.map((target) => target.anchor));
  targets.sidebarRoot.querySelectorAll<HTMLElement>('[data-developer-docs-progress-tracker="page-badge"]').forEach((badge) => {
    const anchor = badge.closest('a');
    if (!anchor || !targetAnchors.has(anchor)) {
      anchor?.classList.remove('lfd-page-link-with-badge');
      badge.remove();
    }
  });

  // 按 URL 把索引页面和阅读记录对应到侧栏链接，为每个目标链接创建或更新 badge。
  for (const target of targets.pageLinkTargets) {
    const page = pageByUrl.get(target.url);
    const existing = target.anchor.querySelector<HTMLElement>('[data-developer-docs-progress-tracker="page-badge"]');
    const badge = existing ?? document.createElement('span');
    target.anchor.classList.add('lfd-page-link-with-badge');
    badge.className = 'lfd-page-badge';
    badge.setAttribute(DATA_ATTR, 'page-badge');
    if (isSubdirectoryPage(page)) {
      // contentHeight 为 0 的目录占位页没有可阅读正文，显示目录标签而不是 0%。
      badge.classList.add('lfd-subdirectory-badge');
      badge.textContent = t(language, 'content.subdirectory');
    } else {
      badge.classList.remove('lfd-subdirectory-badge');
      badge.textContent = formatPercent(pageProgressPercent(page, progressByUrl.get(target.url)));
    }
    if (!existing) target.anchor.append(badge);
  }
}

export function removeReadingMap() {
  // 阅读地图不位于侧栏中，因此单独提供移除入口，便于设置关闭时立即隐藏。
  document.querySelector<HTMLElement>('[data-developer-docs-progress-tracker="reading-map"]')?.remove();
}

export function removeProgressUi() {
  // 清理注入元素时也恢复链接原来的布局 class，避免插件关闭后影响站点侧栏样式。
  document.querySelector<HTMLElement>('[data-developer-docs-progress-tracker="total"]')?.remove();
  document.querySelectorAll<HTMLElement>('[data-developer-docs-progress-tracker="page-badge"]').forEach((badge) => {
    badge.closest('a')?.classList.remove('lfd-page-link-with-badge');
    badge.remove();
  });
  removeReadingMap();
}

export function renderReadingMap(ranges: ViewedRange[], viewportRange: ViewedRange | null, contentHeight: number) {
  // 没有有效正文高度时，无法把已读区间映射到纵向百分比位置，直接移除地图。
  if (!Number.isFinite(contentHeight) || contentHeight <= 0) {
    removeReadingMap();
    return;
  }

  injectStyles();

  // 地图容器固定在页面右侧并可复用；每次渲染只替换其中表示区间的子节点。
  let map = document.querySelector<HTMLElement>('[data-developer-docs-progress-tracker="reading-map"]');
  if (!map) {
    map = document.createElement('div');
    map.className = 'lfd-reading-map';
    map.setAttribute(DATA_ATTR, 'reading-map');
    map.setAttribute('aria-hidden', 'true');
    document.documentElement.append(map);
  }

  const children: HTMLElement[] = [];
  // ranges 是正文中的像素高度区间；readingMapSegments 将其换算成地图上的百分比位置。
  for (const segment of readingMapSegments(ranges, contentHeight)) {
    const element = document.createElement('div');
    element.className = 'lfd-reading-map-segment';
    element.style.top = `${segment.top}%`;
    element.style.height = `${segment.height}%`;
    children.push(element);
  }

  // viewportRange 不是已读记录，而是用户当前正在查看的位置，用另一层高亮显示。
  const viewport = viewportMapSegment(viewportRange, contentHeight);
  if (viewport) {
    const element = document.createElement('div');
    element.className = 'lfd-reading-map-viewport';
    element.style.top = `${viewport.top}%`;
    element.style.height = `${viewport.height}%`;
    children.push(element);
  }

  // 直接重建地图内部节点，保证已经合并或消失的区间不会遗留在界面中。
  map.replaceChildren(...children);
}
