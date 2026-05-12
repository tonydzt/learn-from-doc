import { isSubdirectoryPage, pageProgressPercent, totalProgressPercent } from './calculations';
import type { PageIndexRecord, ProgressRecord } from '../storage/db';

const page = (url: string, contentHeight: number): PageIndexRecord => ({
  siteId: 'react.dev::learn',
  url,
  title: url,
  order: 0,
  contentHeight,
});

const progress = (url: string, viewedHeight: number): ProgressRecord => ({
  siteId: 'react.dev::learn',
  url,
  viewedRanges: [{ start: 0, end: viewedHeight }],
  viewedHeight,
  updatedAt: 1,
});

describe('progress calculations', () => {
  it('calculates current page progress', () => {
    expect(pageProgressPercent(page('https://react.dev/learn', 200), progress('https://react.dev/learn', 50))).toBe(25);
  });

  it('calculates total progress across pages', () => {
    expect(totalProgressPercent([
      page('https://react.dev/a', 100),
      page('https://react.dev/b', 300),
    ], [
      progress('https://react.dev/a', 100),
      progress('https://react.dev/b', 100),
    ])).toBe(50);
  });

  it('handles empty indexes', () => {
    expect(totalProgressPercent([], [])).toBe(0);
  });

  it('does not let zero-height placeholders inflate total progress', () => {
    expect(totalProgressPercent([
      page('https://developers.openai.com/codex', 100),
      page('https://developers.openai.com/codex/use-cases', 0),
    ], [
      progress('https://developers.openai.com/codex', 25),
      progress('https://developers.openai.com/codex/use-cases', 1000),
    ])).toBe(25);
  });

  it('treats zero-height index records as subdirectory placeholders', () => {
    expect(isSubdirectoryPage(page('https://developers.openai.com/codex/use-cases', 0))).toBe(true);
    expect(isSubdirectoryPage(page('https://developers.openai.com/codex', 1200))).toBe(false);
    expect(isSubdirectoryPage(undefined)).toBe(false);
  });
});
