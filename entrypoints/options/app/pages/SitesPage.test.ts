import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { IndexOverview } from '../../../../src/shared/messages';
import { SitesPage } from './SitesPage';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function overview(host: string, siteId: string, updatedAt: number): IndexOverview {
  return {
    site: { siteId, host, scopeKey: siteId, scopeTitle: siteId, createdAt: 1, updatedAt },
    pageCount: 2,
    totalContentHeight: 100,
    totalViewedHeight: 50,
    totalPercent: 50,
    updatedAt,
  };
}

describe('SitesPage', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders one row per host and opens its most recently updated scope', () => {
    const container = document.createElement('div');
    document.body.append(container);
    const selectSite = vi.fn();
    let root: Root;

    act(() => {
      root = createRoot(container);
      root.render(React.createElement(SitesPage, {
        fileInputRef: { current: null },
        includePortableProgress: false,
        language: 'en',
        overviews: [
          overview('playwright.dev', 'docs', 20),
          overview('playwright.dev', 'api', 10),
          overview('react.dev', 'learn', 5),
        ],
        downloadPortableData: vi.fn(),
        importPortableFile: vi.fn(),
        selectSite,
        setIncludePortableProgress: vi.fn(),
      }));
    });

    expect(container.querySelectorAll('.site-list-row')).toHaveLength(2);
    expect(container.textContent?.match(/playwright\.dev/g)).toHaveLength(1);
    expect(container.textContent).toContain('Scope: 2');

    act(() => {
      (container.querySelector('.site-list-main') as HTMLButtonElement).click();
    });
    expect(selectSite).toHaveBeenCalledWith('docs');

    act(() => root.unmount());
  });
});
