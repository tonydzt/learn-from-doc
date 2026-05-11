export type ViewedRange = {
  start: number;
  end: number;
};

// 规范化并合并一组正文高度区间。
// 输入可以乱序、重叠、相邻，甚至 start/end 反过来；输出会变成按 start 排序且互不重叠的区间。
export function mergeRanges(ranges: ViewedRange[]): ViewedRange[] {
  const valid = ranges
    // 忽略 NaN、Infinity 等无效数字，避免污染后续进度计算。
    .filter((range) => Number.isFinite(range.start) && Number.isFinite(range.end))
    .map((range) => ({
      // start/end 反过来的区间也视为有效；这里统一整理成 start <= end。
      start: Math.max(0, Math.min(range.start, range.end)),
      end: Math.max(0, Math.max(range.start, range.end)),
    }))
    // 零长度区间没有可计入的阅读高度。
    .filter((range) => range.end > range.start)
    .sort((a, b) => a.start - b.start);

  const merged: ViewedRange[] = [];
  for (const range of valid) {
    const last = merged.at(-1);
    if (!last || range.start > last.end) {
      merged.push({ ...range });
      continue;
    }
    // range.start <= last.end 表示重叠或刚好相邻；合并后避免重复计数。
    last.end = Math.max(last.end, range.end);
  }
  return merged;
}

// 在已有已读区间中加入一个新的可见区间，并返回合并后的结果。
export function addViewedRange(ranges: ViewedRange[], next: ViewedRange): ViewedRange[] {
  return mergeRanges([...ranges, next]);
}

// 计算已读区间覆盖的总高度；contentHeight 用来防止旧数据超过当前正文高度。
export function viewedHeight(ranges: ViewedRange[], contentHeight = Number.POSITIVE_INFINITY): number {
  const max = Math.max(0, contentHeight);
  return mergeRanges(ranges).reduce((sum, range) => {
    // 统计前裁剪到正文总高度内，避免页面变短后进度超过 100%。
    const start = Math.min(range.start, max);
    const end = Math.min(range.end, max);
    return sum + Math.max(0, end - start);
  }, 0);
}

// 安全地计算百分比，并把结果限制在 0 到 100 之间。
export function percent(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return 0;
  }
  return Math.min(100, Math.max(0, (numerator / denominator) * 100));
}
