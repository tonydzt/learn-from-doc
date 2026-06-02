import { browser } from 'wxt/browser';
import {
  CONTENT_SCRIPT_PENDING_ATTR,
  CONTENT_SCRIPT_READY_ATTR,
  INJECTION_SOURCE_ATTR,
} from './constants';
import { lfdDebug } from './logger';

type InjectionCheck = {
  ready: boolean;
  pending: boolean;
};

async function readInjectionState(tabId: number): Promise<InjectionCheck> {
  const [result] = await browser.scripting.executeScript({
    target: { tabId },
    func: (readyAttr, pendingAttr) => ({
      ready: document.documentElement.hasAttribute(readyAttr),
      pending: document.documentElement.hasAttribute(pendingAttr),
    }),
    args: [CONTENT_SCRIPT_READY_ATTR, CONTENT_SCRIPT_PENDING_ATTR],
  });
  return result?.result ?? { ready: false, pending: false };
}

async function markManualInjectionPending(tabId: number, source: string): Promise<void> {
  await browser.scripting.executeScript({
    target: { tabId },
    func: (pendingAttr, sourceAttr, injectionSource) => {
      document.documentElement.setAttribute(pendingAttr, 'true');
      document.documentElement.setAttribute(sourceAttr, injectionSource);
    },
    args: [CONTENT_SCRIPT_PENDING_ATTR, INJECTION_SOURCE_ATTR, source],
  });
}

async function clearManualInjectionPending(tabId: number): Promise<void> {
  await browser.scripting.executeScript({
    target: { tabId },
    func: (pendingAttr) => {
      document.documentElement.removeAttribute(pendingAttr);
    },
    args: [CONTENT_SCRIPT_PENDING_ATTR],
  }).catch(() => undefined);
}

/** 手动向标签页注入 manifest 中声明的首个 content script。 */
export async function injectContentScript(tabId: number, source = 'background:manual'): Promise<void> {
  const file = browser.runtime.getManifest().content_scripts?.[0]?.js?.[0];
  if (!file) throw new Error('Content script file not found.');
  const scriptFile = file as NonNullable<Parameters<typeof browser.scripting.executeScript>[0]['files']>[number];

  const state = await readInjectionState(tabId);
  if (state.ready || state.pending) {
    lfdDebug('content script injection skipped', { tabId, source, state });
    return;
  }

  lfdDebug('content script injection requested', { tabId, source });
  await markManualInjectionPending(tabId, source);
  try {
    await browser.scripting.executeScript({
      target: { tabId },
      files: [scriptFile],
    });
  } catch (error) {
    await clearManualInjectionPending(tabId);
    throw error;
  }
}
