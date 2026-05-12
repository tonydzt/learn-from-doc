import type { IndexPageMeasuredMessage } from './messages';

describe('runtime message types', () => {
  it('allows index measurement diagnostics and skip reasons', () => {
    const message = {
      type: 'INDEX_PAGE_MEASURED',
      payload: {
        url: 'https://playwright.dev/docs/release-notes',
        title: 'Release notes',
        contentHeight: 0,
        skippedReason: 'article not found',
        timing: {
          afterHydrationMs: 12,
          articleMeasureMs: 3,
          navigationLoadMs: 5590,
          resourceCount: 102,
          topImageDurations: [5277, 5164],
        },
      },
    } satisfies IndexPageMeasuredMessage;

    expect(message.payload.skippedReason).toBe('article not found');
    expect(message.payload.timing?.topImageDurations).toEqual([5277, 5164]);
  });
});
