import { indexLinksForMode, shouldKeepMeasuredTabOpen, shouldOpenMeasuredTabActive } from './debug-options';
import { withIndexingHash } from '../shared/url';

describe('index debug mode', () => {
  const links = [
    { url: 'https://react.dev/learn', title: 'Learn React' },
    { url: 'https://react.dev/learn/describing-the-ui', title: 'Describing the UI' },
  ];

  it('indexes every sidebar link in normal mode', () => {
    expect(indexLinksForMode(links, false)).toEqual(links);
    expect(shouldOpenMeasuredTabActive(false)).toBe(false);
    expect(shouldKeepMeasuredTabOpen(false)).toBe(false);
  });

  it('indexes only the first sidebar link and keeps it visible in debug mode', () => {
    expect(indexLinksForMode(links, true)).toEqual([links[0]]);
    expect(shouldOpenMeasuredTabActive(true)).toBe(true);
    expect(shouldKeepMeasuredTabOpen(true)).toBe(true);
  });

  it('marks indexing urls with debug state when requested', () => {
    expect(withIndexingHash('https://react.dev/learn', true)).toBe('https://react.dev/learn#__learn_from_doc_indexing=1&lfd_debug=1');
  });
});
