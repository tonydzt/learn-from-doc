import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { SiteOverviewTab } from './SiteOverviewTab';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('SiteOverviewTab', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('shows current-scope pages and pages with reading progress', () => {
    const container = document.createElement('div');
    document.body.append(container);
    let root: Root;

    act(() => {
      root = createRoot(container);
      root.render(React.createElement(SiteOverviewTab, {
        clearAllProgress: vi.fn(),
        clearSelectedProgress: vi.fn(),
        deleteSelected: vi.fn(),
        fmtHeight: (value) => `${value} px`,
        fmtPercent: (value) => `${value}%`,
        language: 'en',
        saveSiteSettings: vi.fn(),
        selected: {
          site: {
            siteId: 'playwright.dev::docs',
            host: 'playwright.dev',
            scopeKey: 'docs',
            scopeTitle: 'Playwright Docs',
            createdAt: 1,
            updatedAt: 2,
          },
          pages: [
            { siteId: 'playwright.dev::docs', url: 'https://playwright.dev/docs/intro', title: 'Intro', order: 0, contentHeight: 100 },
            { siteId: 'playwright.dev::docs', url: 'https://playwright.dev/docs/test', title: 'Test', order: 1, contentHeight: 100 },
          ],
          progress: [
            {
              siteId: 'playwright.dev::docs',
              url: 'https://playwright.dev/docs/intro',
              viewedRanges: [{ start: 0, end: 20 }],
              viewedHeight: 20,
              updatedAt: 3,
            },
          ],
        },
        totalPercent: 10,
      }));
    });

    const cards = [...container.querySelectorAll('.stat-card')].map((card) => card.textContent);
    expect(cards).toContain('Pages2');
    expect(cards).toContain('Pages with progress1 / 2');

    act(() => root.unmount());
  });
});
