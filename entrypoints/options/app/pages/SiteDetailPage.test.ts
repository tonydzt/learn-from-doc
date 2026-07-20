import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { IndexOverview, SiteSnapshot } from '../../../../src/shared/messages';
import { SiteDetailPage } from './SiteDetailPage';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function overview(host: string, siteId: string, scopeTitle: string): IndexOverview {
  return {
    site: { siteId, host, scopeKey: siteId, scopeTitle, createdAt: 1, updatedAt: 2 },
    pageCount: 1,
    totalContentHeight: 100,
    totalViewedHeight: 0,
    totalPercent: 0,
    updatedAt: 2,
  };
}

describe('SiteDetailPage', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('shows scopes from the selected host and switches between them', () => {
    const container = document.createElement('div');
    document.body.append(container);
    const selectScope = vi.fn();
    const selected: SiteSnapshot = {
      site: overview('playwright.dev', 'docs', 'Docs').site,
      pages: [],
      progress: [],
    };
    let root: Root;

    act(() => {
      root = createRoot(container);
      root.render(React.createElement(SiteDetailPage, {
        clearAllProgress: vi.fn(),
        clearSelectedProgress: vi.fn(),
        deletePageProgress: vi.fn(),
        deleteSelected: vi.fn(),
        detailTab: 'overview',
        language: 'en',
        overviews: [
          overview('playwright.dev', 'docs', 'Docs'),
          overview('playwright.dev', 'api', 'API'),
          overview('react.dev', 'learn', 'Learn'),
        ],
        saveSiteSettings: vi.fn(),
        selectDetailTab: vi.fn(),
        selectPage: vi.fn(),
        selectScope,
        selected,
      }));
    });

    const scopeTabs = [...container.querySelectorAll<HTMLButtonElement>('.scope-tab')];
    expect(scopeTabs.map((button) => button.textContent)).toEqual(['Docs', 'API']);
    expect(scopeTabs[0]?.classList.contains('active')).toBe(true);

    act(() => scopeTabs[1]?.click());
    expect(selectScope).toHaveBeenCalledWith('api');

    act(() => root.unmount());
  });
});
