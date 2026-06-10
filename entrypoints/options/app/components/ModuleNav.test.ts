import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ModuleNav } from './ModuleNav';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('ModuleNav', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders a dedicated account module', () => {
    const selectPage = vi.fn();
    const container = document.createElement('div');
    document.body.append(container);
    let root: Root;

    act(() => {
      root = createRoot(container);
      root.render(React.createElement(ModuleNav, {
        language: 'en',
        page: 'settings',
        selectPage,
      }));
    });

    const accountButton = [...container.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('Account'));
    expect(accountButton).toBeDefined();

    act(() => {
      accountButton?.click();
    });

    expect(selectPage).toHaveBeenCalledWith('account');

    act(() => root.unmount());
  });
});
