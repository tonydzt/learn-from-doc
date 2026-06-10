import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DEFAULT_APP_SETTINGS } from '../../../../src/settings/app-settings';
import { SettingsPage } from './SettingsPage';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('SettingsPage', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('does not render account login controls', () => {
    const container = document.createElement('div');
    document.body.append(container);
    let root: Root;

    act(() => {
      root = createRoot(container);
      root.render(React.createElement(SettingsPage, {
        settings: DEFAULT_APP_SETTINGS,
        saveSettings: vi.fn(),
      }));
    });

    expect(container.querySelector('input[type="email"]')).toBeNull();
    expect(container.querySelector('input[type="password"]')).toBeNull();
    expect(container.textContent).not.toContain('Server account');

    act(() => root.unmount());
  });
});
