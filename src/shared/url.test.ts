import { isIndexingUrl, withIndexingHash } from './url';

describe('indexing url helpers', () => {
  it('marks indexing urls with the indexing hash only', () => {
    const url = withIndexingHash('https://react.dev/learn');

    expect(url).toBe('https://react.dev/learn#__learn_from_doc_indexing=1');
    expect(isIndexingUrl(url)).toBe(true);
  });
});
