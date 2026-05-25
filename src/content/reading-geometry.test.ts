import { articleHeight, isArticleScrolledToEnd, visibleRange } from './reading-geometry';

function stubRect(element: HTMLElement, rect: Partial<DOMRect>): void {
  element.getBoundingClientRect = () => ({
    x: 0,
    y: rect.top ?? 0,
    width: rect.width ?? 100,
    height: rect.height ?? 0,
    top: rect.top ?? 0,
    right: rect.right ?? 100,
    bottom: rect.bottom ?? 0,
    left: rect.left ?? 0,
    toJSON: () => ({}),
  } as DOMRect);
}

describe('reading geometry', () => {
  it('uses the larger rendered or scroll height for article height', () => {
    const article = document.createElement('article');
    Object.defineProperty(article, 'scrollHeight', { configurable: true, value: 320 });
    stubRect(article, { height: 280, bottom: 280 });

    expect(articleHeight(article)).toBe(320);
  });

  it('calculates the visible article range inside the viewport', () => {
    const article = document.createElement('article');
    stubRect(article, { top: -120, bottom: 680, height: 800 });

    expect(visibleRange(article)).toEqual({ start: 120, end: 800 });
  });

  it('returns null when the article is outside the viewport', () => {
    const article = document.createElement('article');
    stubRect(article, { top: 900, bottom: 1200, height: 300 });

    expect(visibleRange(article)).toBeNull();
  });

  it('detects when the article bottom reaches the viewport', () => {
    const article = document.createElement('article');
    stubRect(article, { top: 0, bottom: window.innerHeight + 2, height: window.innerHeight + 2 });

    expect(isArticleScrolledToEnd(article)).toBe(true);
  });
});
