import { isIndexingUrl, normalizePageUrl, withIndexingHash } from './url';

describe('indexing url helpers', () => {
  it('normalizes page urls to stable storage keys', () => {
    expect(normalizePageUrl('https://webdriver.io/docs/why-webdriverio/#overview')).toBe('https://webdriver.io/docs/why-webdriverio');
    expect(normalizePageUrl('https://webdriver.io/?b=2&a=1#top')).toBe('https://webdriver.io/?a=1&b=2');
  });

  it('marks indexing urls with the indexing hash only', () => {
    const url = withIndexingHash('https://react.dev/learn');

    expect(url).toBe('https://react.dev/learn#__developer_docs_progress_tracker_indexing=1');
    expect(isIndexingUrl(url)).toBe(true);
  });
});
