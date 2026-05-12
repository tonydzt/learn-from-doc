import type { ViewedRange } from './ranges';

// 当用户已经滚到正文底部时，把最后一次可见区间延伸到索引记录的正文总高度。
// 这样可以覆盖“最后一点内容高度没有进入 visibleRange 计算”的误差，避免明明到底了却卡在 99%。
export function completeRangeAtPageEnd(range: ViewedRange, atPageEnd: boolean, contentHeight: number): ViewedRange {
  // 只有明确到达页面底部且 contentHeight 有效时才修正；普通滚动过程保持原始可见区间。
  if (!atPageEnd || !Number.isFinite(contentHeight) || contentHeight <= 0) return range;
  return {
    start: range.start,
    // 如果 range.end 已经超过 contentHeight，不回退它；后续 viewedHeight 会按正文高度裁剪。
    end: Math.max(range.end, contentHeight),
  };
}
