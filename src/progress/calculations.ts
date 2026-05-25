import { percent } from './ranges';
import type { PageIndexRecord, ProgressRecord } from '../storage/db';

// 计算单个页面的阅读进度百分比。
// page 提供正文总高度，progress 提供已读高度；缺任意一边都视为 0%。
export function pageProgressPercent(page: PageIndexRecord | undefined, progress: ProgressRecord | undefined): number {
  return percent(progress?.viewedHeight ?? 0, page?.contentHeight ?? 0);
}

// 判断页面是否为子目录页面
export function isSubdirectoryPage(page: PageIndexRecord | undefined): boolean {
  return Boolean(page && page.contentHeight <= 0);
}

// 计算整个文档范围的总阅读进度百分比。
// 分母是所有已索引页面的正文高度之和，分子是这些页面对应的已读高度之和。
export function totalProgressPercent(pages: PageIndexRecord[], progress: ProgressRecord[]): number {
  // 负数高度没有业务意义，按 0 处理，避免异常数据影响总进度。
  const totalHeight = pages.reduce((sum, page) => sum + Math.max(0, page.contentHeight), 0);

  // progress 是按 URL 和 page 对齐的；Map 让每个 page 能快速找到自己的进度记录。
  const progressByUrl = new Map(progress.map((entry) => [entry.url, entry.viewedHeight]));
  const totalViewed = pages.reduce((sum, page) => {
    const contentHeight = Math.max(0, page.contentHeight);
    const viewed = Math.max(0, progressByUrl.get(page.url) ?? 0);
    return sum + Math.min(viewed, contentHeight);
  }, 0);

  // percent 会处理空索引、除零、NaN，并把结果限制在 0 到 100。
  return percent(totalViewed, totalHeight);
}
