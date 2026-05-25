import type { ViewedRange } from '../progress/ranges';

// 取得正文用于计算阅读进度的总高度。
// scrollHeight 包含可滚动内容，DOMRect.height 反映实际渲染高度；取较大值避免漏算正文。
export function articleHeight(article: HTMLElement): number {
  // 至少返回 1，避免后续用正文高度计算百分比时出现除零。
  return Math.max(article.scrollHeight, article.getBoundingClientRect().height, 1);
}

// 计算当前视口正在展示正文的哪一段，返回值使用正文自身坐标：
// start=距离正文顶部多少像素，end=可见区域结束于正文顶部以下多少像素。
export function visibleRange(article: HTMLElement): ViewedRange | null {
  const rect = article.getBoundingClientRect();
  const viewportTop = 0;
  const viewportBottom = window.innerHeight || document.documentElement.clientHeight;

  // 正文和视口的交集边界；rect 的坐标是相对于浏览器视口的。
  const visibleTop = Math.max(rect.top, viewportTop);
  const visibleBottom = Math.min(rect.bottom, viewportBottom);

  // 没有交集时，当前滚动位置不能计入这篇文章的阅读进度。
  if (visibleBottom <= visibleTop) return null;

  return {
    // 减去 rect.top，把“视口坐标”转换成“正文内部坐标”。
    start: visibleTop - rect.top,
    end: visibleBottom - rect.top,
  };
}

// 判断正文底端是否已经进入视口，用于把阅读区间补齐到文章末尾。
export function isArticleScrolledToEnd(article: HTMLElement): boolean {
  const rect = article.getBoundingClientRect();
  const viewportBottom = window.innerHeight || document.documentElement.clientHeight;

  // 允许 2px 布局/取整误差，否则用户看到底部时最后几个像素可能仍被判定为未读。
  return rect.bottom <= viewportBottom + 2;
}
