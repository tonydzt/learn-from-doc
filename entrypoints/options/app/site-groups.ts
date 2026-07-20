import type { IndexOverview } from '../../../src/shared/messages';

export type SiteOverviewGroup = {
  host: string;
  overviews: IndexOverview[];
  pageCount: number;
  totalPercent: number;
  updatedAt: number;
};

export function groupOverviewsByHost(overviews: IndexOverview[]): SiteOverviewGroup[] {
  const groups = new Map<string, SiteOverviewGroup>();

  for (const overview of overviews) {
    const existing = groups.get(overview.site.host);
    if (existing) {
      existing.overviews.push(overview);
      existing.pageCount += overview.pageCount;
      existing.updatedAt = Math.max(existing.updatedAt, overview.updatedAt);
      continue;
    }
    groups.set(overview.site.host, {
      host: overview.site.host,
      overviews: [overview],
      pageCount: overview.pageCount,
      totalPercent: 0,
      updatedAt: overview.updatedAt,
    });
  }

  return [...groups.values()].map((group) => {
    const totalContentHeight = group.overviews.reduce((sum, overview) => sum + overview.totalContentHeight, 0);
    const totalViewedHeight = group.overviews.reduce((sum, overview) => sum + overview.totalViewedHeight, 0);
    return {
      ...group,
      totalPercent: totalContentHeight > 0 ? Math.min(100, Math.max(0, totalViewedHeight / totalContentHeight * 100)) : 0,
    };
  });
}
