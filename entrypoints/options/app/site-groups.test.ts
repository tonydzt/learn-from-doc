import type { IndexOverview } from '../../../src/shared/messages';
import { groupOverviewsByHost } from './site-groups';

function overview(input: {
  host: string;
  siteId: string;
  pageCount: number;
  totalContentHeight: number;
  totalViewedHeight: number;
  updatedAt: number;
}): IndexOverview {
  return {
    site: {
      siteId: input.siteId,
      host: input.host,
      scopeKey: input.siteId,
      scopeTitle: input.siteId,
      createdAt: 1,
      updatedAt: input.updatedAt,
    },
    pageCount: input.pageCount,
    totalContentHeight: input.totalContentHeight,
    totalViewedHeight: input.totalViewedHeight,
    totalPercent: 0,
    updatedAt: input.updatedAt,
  };
}

describe('groupOverviewsByHost', () => {
  it('groups scopes by host and aggregates site metrics', () => {
    const groups = groupOverviewsByHost([
      overview({ host: 'playwright.dev', siteId: 'docs', pageCount: 2, totalContentHeight: 100, totalViewedHeight: 50, updatedAt: 20 }),
      overview({ host: 'playwright.dev', siteId: 'api', pageCount: 3, totalContentHeight: 300, totalViewedHeight: 50, updatedAt: 10 }),
      overview({ host: 'react.dev', siteId: 'learn', pageCount: 4, totalContentHeight: 200, totalViewedHeight: 100, updatedAt: 5 }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({
      host: 'playwright.dev',
      pageCount: 5,
      totalPercent: 25,
      updatedAt: 20,
    });
    expect(groups[0]?.overviews.map((item) => item.site.siteId)).toEqual(['docs', 'api']);
    expect(groups[1]?.host).toBe('react.dev');
  });
});
