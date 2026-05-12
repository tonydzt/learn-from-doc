import { scrollableAncestors } from './scroll-targets';

function setBoxMetrics(element: HTMLElement, metrics: { clientHeight: number; scrollHeight: number }) {
  Object.defineProperty(element, 'clientHeight', { configurable: true, value: metrics.clientHeight });
  Object.defineProperty(element, 'scrollHeight', { configurable: true, value: metrics.scrollHeight });
}

describe('scroll targets', () => {
  it('finds scrollable ancestors for pages that do not scroll on window', () => {
    document.body.innerHTML = `
      <div id="outer" style="overflow-y: auto">
        <main id="inner" style="overflow-y: visible">
          <article id="article">Body</article>
        </main>
      </div>
    `;
    const outer = document.getElementById('outer') as HTMLElement;
    const inner = document.getElementById('inner') as HTMLElement;
    const article = document.getElementById('article') as HTMLElement;

    setBoxMetrics(outer, { clientHeight: 100, scrollHeight: 300 });
    setBoxMetrics(inner, { clientHeight: 100, scrollHeight: 300 });

    expect(scrollableAncestors(article)).toEqual([outer]);
  });
});
