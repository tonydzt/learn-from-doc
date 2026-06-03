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

/** progress-ui 对外接收的交互回调，主要是删除某个页面进度记录。 */
export type ProgressUiHandlers = {
  onDeletePageProgress?: (url: string) => void;
};

export type PageProgressToggleState = {
  enabled: boolean;
  language: AppSettings['language'];
};

// 保存每个 badge 当前生效的删除回调。click 事件只在首次创建时绑定一次，
// 后续重渲染只更新这个映射，从而避免重复添加事件以及闭包中持有过期的 url。
const badgeDeleteHandlerByElement = new WeakMap<HTMLElement, ((url: string) => void) | undefined>();

const TOGGLE_OFFSET = 28;
const TOGGLE_DRAG_THRESHOLD_PX = 4;
// 页面记录开关的位置只在当前 content script 会话内记忆：
// 用户可以在本页签里挪开遮挡位置，但刷新页面或新页签会回到默认右下角。
let pageProgressTogglePosition: { left: number; top: number } | undefined;

// 把拖拽后的坐标限制在视口内，避免用户把开关拖到屏幕外导致无法再操作。
function clampTogglePosition(left: number, top: number, element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const width = rect.width > 0 ? rect.width : 112;
  const height = rect.height > 0 ? rect.height : 36;
  const maxLeft = Math.max(TOGGLE_OFFSET, (window.innerWidth || document.documentElement.clientWidth || 0) - width - TOGGLE_OFFSET);
  const maxTop = Math.max(TOGGLE_OFFSET, (window.innerHeight || document.documentElement.clientHeight || 0) - height - TOGGLE_OFFSET);
  return {
    left: Math.min(Math.max(TOGGLE_OFFSET, left), maxLeft),
    top: Math.min(Math.max(TOGGLE_OFFSET, top), maxTop),
  };
}

// 根据会话内是否已有拖拽位置，应用默认右下角或用户本次拖过的位置。
// 拖动后必须清掉 right/bottom，否则 fixed 元素会被 left+right/top+bottom 拉伸。
function applyTogglePosition(element: HTMLElement) {
  if (!pageProgressTogglePosition) {
    element.style.left = 'auto';
    element.style.top = 'auto';
    element.style.right = `${TOGGLE_OFFSET + 2}px`;
    element.style.bottom = `${TOGGLE_OFFSET}px`;
    return;
  }
  const position = clampTogglePosition(pageProgressTogglePosition.left, pageProgressTogglePosition.top, element);
  pageProgressTogglePosition = position;
  element.style.right = 'auto';
  element.style.bottom = 'auto';
  element.style.left = `${position.left}px`;
  element.style.top = `${position.top}px`;
}

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
      position: relative;
      display: inline-flex;
      flex: 0 0 auto;
      align-items: center;
      justify-content: center;
      margin-left: 7px;
      padding: 1px 6px;
      border-radius: 999px;
      background: rgba(20, 184, 166, 0.1);
      color: #0f766e;
      font: 700 10px/1.5 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      vertical-align: middle;
      white-space: nowrap;
      cursor: pointer;
      user-select: none;
      -webkit-user-select: none;
      transition: background 120ms ease, color 120ms ease;
    }
    .lfd-page-badge .lfd-badge-text {
      display: inline;
      transition: opacity 120ms ease;
    }
    .lfd-page-badge .lfd-badge-delete {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      line-height: 1;
      opacity: 0;
      pointer-events: none;
      transition: opacity 120ms ease;
    }
    .lfd-page-badge.lfd-page-badge-deletable:hover {
      background: rgba(220, 38, 38, 0.15);
      color: #dc2626;
    }
    .lfd-page-badge.lfd-page-badge-deletable:hover .lfd-badge-text {
      opacity: 0;
    }
    .lfd-page-badge.lfd-page-badge-deletable:hover .lfd-badge-delete {
      opacity: 1;
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
    .lfd-page-progress-toggle {
      position: fixed;
      right: 30px;
      bottom: 28px;
      z-index: 2147483647;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-height: 34px;
      padding: 8px 11px;
      border: 1px solid rgba(15, 23, 42, 0.14);
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.94);
      box-shadow: 0 12px 30px rgba(15, 23, 42, 0.16);
      color: #334155;
      font: 750 12px/1 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      cursor: grab;
      touch-action: none;
      user-select: none;
      -webkit-user-select: none;
      white-space: nowrap;
      width: max-content;
      max-width: calc(100vw - 56px);
    }
    .lfd-page-progress-toggle:hover {
      border-color: rgba(15, 118, 110, 0.32);
      color: #0f766e;
    }
    .lfd-page-progress-toggle-dragging {
      cursor: grabbing;
    }
    .lfd-page-progress-toggle-dot {
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: #94a3b8;
      box-shadow: 0 0 0 3px rgba(148, 163, 184, 0.18);
    }
    .lfd-page-progress-toggle-enabled .lfd-page-progress-toggle-dot {
      background: #0f766e;
      box-shadow: 0 0 0 3px rgba(20, 184, 166, 0.18);
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
  handlers?: ProgressUiHandlers,
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
    const subdirectory = isSubdirectoryPage(page);
    const hasProgress = progressByUrl.has(target.url);
    // 子目录占位页没有进度可删；未产生进度的页面也不必启用删除交互，避免用户误点。
    const deletable = Boolean(handlers?.onDeletePageProgress) && !subdirectory && hasProgress;
    badge.classList.toggle('lfd-page-badge-deletable', deletable);
    if (subdirectory) {
      // contentHeight 为 0 的目录占位页没有可阅读正文，显示目录标签而不是 0%。
      badge.classList.add('lfd-subdirectory-badge');
      badge.replaceChildren(document.createTextNode(t(language, 'content.subdirectory')));
      badge.removeAttribute('role');
      badge.removeAttribute('tabindex');
      badge.removeAttribute('title');
      badge.removeAttribute('aria-label');
    } else {
      badge.classList.remove('lfd-subdirectory-badge');
      // badge 内部拆为「百分比」与「删除图标」两个子节点，hover 时通过 CSS 切换可见性。
      // 关键：宿主站点的 DOM 变动会触发我们的 MutationObserver 进而重新调用 renderProgressUi，
      // 如果每次都 replaceChildren 重建子节点，正在 click 的鼠标会发生
      // mousedown target ≠ mouseup target，浏览器就不会触发 click（也是「点 2-3 次才生效」的根因）。
      // 因此这里复用已有的子节点，只更新文本，避免 click 在多次 render 之间被吞掉。
      let text = badge.querySelector<HTMLElement>(':scope > .lfd-badge-text');
      let del = badge.querySelector<HTMLElement>(':scope > .lfd-badge-delete');
      if (!text || !del) {
        text = document.createElement('span');
        text.className = 'lfd-badge-text';
        del = document.createElement('span');
        del.className = 'lfd-badge-delete';
        del.setAttribute('aria-hidden', 'true');
        del.textContent = '×';
        badge.replaceChildren(text, del);
      }
      const nextText = formatPercent(pageProgressPercent(page, progressByUrl.get(target.url)));
      if (text.textContent !== nextText) text.textContent = nextText;
      if (deletable) {
        const label = t(language, 'content.deletePageProgress');
        badge.setAttribute('role', 'button');
        badge.setAttribute('tabindex', '0');
        badge.setAttribute('title', label);
        badge.setAttribute('aria-label', label);
      } else {
        badge.removeAttribute('role');
        badge.removeAttribute('tabindex');
        badge.removeAttribute('title');
        badge.removeAttribute('aria-label');
      }
    }
    // 最新的 url 及删除回调保存到 badge 上，避免重复绑定事件实例。
    badge.dataset.lfdUrl = target.url;
    badgeDeleteHandlerByElement.set(badge, deletable ? handlers!.onDeletePageProgress! : undefined);
    if (!badge.dataset.lfdBound) {
      // 在 mousedown 阶段就拦截：避免 anchor/SPA 的 prefetch、焦点切换、文本选择拖拽等
      // 副作用干扰后续 click 事件。主动调用 stopImmediatePropagation 避免同一
      // 节点上别的 listener 也响应这次 mousedown。
      const blockUpstream = (event: Event) => {
        if (!badgeDeleteHandlerByElement.get(badge)) return;
        event.preventDefault();
        event.stopPropagation();
        if (typeof (event as Event & { stopImmediatePropagation?: () => void }).stopImmediatePropagation === 'function') {
          (event as Event & { stopImmediatePropagation: () => void }).stopImmediatePropagation();
        }
      };
      const trigger = (event: Event) => {
        const url = badge.dataset.lfdUrl;
        const handler = badgeDeleteHandlerByElement.get(badge);
        if (!url || !handler) return;
        event.preventDefault();
        event.stopPropagation();
        handler(url);
      };
      // 使用 capture 阶段绑定 mousedown，确保比宿主站点插在 anchor/document 上的
      // capture/bubble 监听器都能被携带 stopImmediatePropagation 的事件提前拦截。
      badge.addEventListener('mousedown', blockUpstream, { capture: true });
      badge.addEventListener('pointerdown', blockUpstream, { capture: true });
      badge.addEventListener('click', trigger);
      badge.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        trigger(event);
      });
      badge.dataset.lfdBound = '1';
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

// 渲染单页“是否记录当前页进度”的悬浮开关。
// 这个开关只影响当前页阅读进度是否写入，不影响总进度、侧栏 badge 或 reading map 的展示。
export function renderPageProgressToggle(state: PageProgressToggleState, onToggle: (enabled: boolean) => void) {
  injectStyles();
  let button = document.querySelector<HTMLButtonElement>('[data-developer-docs-progress-tracker="page-progress-toggle"]');
  if (!button) {
    button = document.createElement('button');
    button.type = 'button';
    button.className = 'lfd-page-progress-toggle';
    button.setAttribute(DATA_ATTR, 'page-progress-toggle');
    button.innerHTML = '<span class="lfd-page-progress-toggle-dot" aria-hidden="true"></span><span class="lfd-page-progress-toggle-label"></span>';
    document.documentElement.append(button);
  }

  const nextEnabled = state.enabled;
  const label = t(state.language, nextEnabled ? 'content.disablePageProgress' : 'content.enablePageProgress');
  const status = t(state.language, nextEnabled ? 'content.pageProgressOn' : 'content.pageProgressOff');
  button.classList.toggle('lfd-page-progress-toggle-enabled', nextEnabled);
  button.title = label;
  button.setAttribute('aria-label', label);
  button.setAttribute('aria-pressed', String(nextEnabled));
  button.querySelector<HTMLElement>('.lfd-page-progress-toggle-label')!.textContent = status;
  button.onclick = () => onToggle(!nextEnabled);
  applyTogglePosition(button);

  if (!button.dataset.lfdDragBound) {
    let dragStart: {
      pointerId: number;
      pointerX: number;
      pointerY: number;
      left: number;
      top: number;
      moved: boolean;
    } | undefined;

    button.addEventListener('pointerdown', (event) => {
      // pointerdown 只记录起点；是否真拖动由 pointermove 的阈值判断，避免普通点击被误判为拖拽。
      const rect = button.getBoundingClientRect();
      dragStart = {
        pointerId: event.pointerId,
        pointerX: event.clientX,
        pointerY: event.clientY,
        left: rect.left,
        top: rect.top,
        moved: false,
      };
      button.setPointerCapture?.(event.pointerId);
    });

    button.addEventListener('pointermove', (event) => {
      if (!dragStart || dragStart.pointerId !== event.pointerId) return;
      const deltaX = event.clientX - dragStart.pointerX;
      const deltaY = event.clientY - dragStart.pointerY;
      if (!dragStart.moved && Math.hypot(deltaX, deltaY) < TOGGLE_DRAG_THRESHOLD_PX) return;
      dragStart.moved = true;
      button.classList.add('lfd-page-progress-toggle-dragging');
      // 拖动位置写入模块变量，后续 renderPageProgressToggle 重渲染时仍沿用本页签会话的位置。
      pageProgressTogglePosition = clampTogglePosition(dragStart.left + deltaX, dragStart.top + deltaY, button);
      applyTogglePosition(button);
    });

    button.addEventListener('pointerup', (event) => {
      if (!dragStart || dragStart.pointerId !== event.pointerId) return;
      const wasDragged = dragStart.moved;
      dragStart = undefined;
      button.classList.remove('lfd-page-progress-toggle-dragging');
      button.releasePointerCapture?.(event.pointerId);
      if (wasDragged) {
        // 拖拽结束后浏览器通常会补发 click；这里标记下一次 click 需要吞掉，避免误切换开关。
        button.dataset.lfdSuppressNextClick = '1';
      }
    });

    button.addEventListener('pointercancel', (event) => {
      if (!dragStart || dragStart.pointerId !== event.pointerId) return;
      dragStart = undefined;
      button.classList.remove('lfd-page-progress-toggle-dragging');
      button.releasePointerCapture?.(event.pointerId);
    });

    button.addEventListener('click', (event) => {
      if (button.dataset.lfdSuppressNextClick !== '1') return;
      event.preventDefault();
      event.stopPropagation();
      if (typeof (event as Event & { stopImmediatePropagation?: () => void }).stopImmediatePropagation === 'function') {
        (event as Event & { stopImmediatePropagation: () => void }).stopImmediatePropagation();
      }
      delete button.dataset.lfdSuppressNextClick;
    }, { capture: true });

    button.dataset.lfdDragBound = '1';
  }
}

export function removePageProgressToggle() {
  document.querySelector<HTMLElement>('[data-developer-docs-progress-tracker="page-progress-toggle"]')?.remove();
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
