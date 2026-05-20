import { describe, expect, it } from 'vitest';
import { createIndexRunProgressStore } from '../indexing/run-progress';
import type { RuntimeMessage } from '../shared/messages';
import { createMessageRouter } from './router';
import type { BackgroundContext, BackgroundHandler, RuntimeMessageSender } from './types';

function testContext(): BackgroundContext {
  return {
    pendingMeasurements: new Map(),
    indexRunProgress: createIndexRunProgressStore(),
  };
}

const sender = {} as RuntimeMessageSender;

describe('background message router', () => {
  it('routes by message type', () => {
    const handler: BackgroundHandler = () => {
      return { ok: true };
    };
    const fallback: BackgroundHandler = () => {
      return { ok: true };
    };

    const router = createMessageRouter({
      GET_APP_SETTINGS: handler,
      GET_SITE_SETTINGS: fallback,
    });
    expect(router({ type: 'GET_APP_SETTINGS' }, sender, testContext())).toEqual({ ok: true });
  });

  it('returns undefined when no handler accepts the message', () => {
    const router = createMessageRouter({});

    expect(router({ type: 'UNKNOWN_MESSAGE' } as RuntimeMessage, sender, testContext())).toBeUndefined();
  });

  it('does not call handlers for other message types', () => {
    const calls: string[] = [];
    const handler: BackgroundHandler = () => {
      calls.push('handler');
      return { ok: true };
    };

    const router = createMessageRouter({
      GET_SITE_SETTINGS: handler,
    });

    expect(router({ type: 'GET_APP_SETTINGS' }, sender, testContext())).toBeUndefined();
    expect(calls).toEqual([]);
  });
});
