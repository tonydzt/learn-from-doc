import { mergeRanges, type ViewedRange } from './ranges';

export type ReadingMapSegment = {
  top: number;
  height: number;
};

// 把正文里的像素区间转换成阅读地图上的百分比区间。
// 例如 contentHeight=2000, range={start: 500, end: 1000}
// 会变成 top=25, height=25，用于 CSS 的 top/height 百分比。
function toSegment(range: ViewedRange, contentHeight: number): ReadingMapSegment | null {
  if (!Number.isFinite(contentHeight) || contentHeight <= 0) return null;

  // 防御性裁剪：区间可能因为页面高度变化或旧数据而超出当前正文高度。
  const start = Math.min(Math.max(0, range.start), contentHeight);
  const end = Math.min(Math.max(0, range.end), contentHeight);
  if (end <= start) return null;

  return {
    top: (start / contentHeight) * 100,
    height: ((end - start) / contentHeight) * 100,
  };
}

// 生成“已读区域”的阅读地图片段。
// 输入是正文里的已浏览像素区间，输出是可直接用于右侧竖条 UI 的百分比片段。
export function readingMapSegments(ranges: ViewedRange[], contentHeight: number): ReadingMapSegment[] {
  if (!Number.isFinite(contentHeight) || contentHeight <= 0) return [];
  return mergeRanges(ranges)
    .map((range) => toSegment(range, contentHeight))
    // toSegment 会过滤掉无效区间；这个类型守卫让 TypeScript 知道剩下的不是 null。
    .filter((segment): segment is ReadingMapSegment => segment !== null);
}

// 生成“当前视口位置”的阅读地图片段。
// 它和已读区域使用同一套换算逻辑，只是输入通常来自当前可见区间。
export function viewportMapSegment(range: ViewedRange | null, contentHeight: number): ReadingMapSegment | null {
  if (!range) return null;
  return toSegment(range, contentHeight);
}
