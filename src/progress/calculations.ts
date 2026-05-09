import { percent } from './ranges';
import type { PageIndexRecord, ProgressRecord } from '../storage/db';

export function pageProgressPercent(page: PageIndexRecord | undefined, progress: ProgressRecord | undefined): number {
  return percent(progress?.viewedHeight ?? 0, page?.contentHeight ?? 0);
}

export function totalProgressPercent(pages: PageIndexRecord[], progress: ProgressRecord[]): number {
  const totalHeight = pages.reduce((sum, page) => sum + Math.max(0, page.contentHeight), 0);
  const progressByUrl = new Map(progress.map((entry) => [entry.url, entry.viewedHeight]));
  const totalViewed = pages.reduce((sum, page) => sum + Math.max(0, progressByUrl.get(page.url) ?? 0), 0);
  return percent(totalViewed, totalHeight);
}
