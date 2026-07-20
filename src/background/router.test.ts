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

  it('can route account message types', () => {
    const calls: string[] = [];
    const handler: BackgroundHandler = (message) => {
      calls.push(message.type);
      return { ok: true };
    };

    const router = createMessageRouter({
      GET_ACCOUNT_SESSION: handler,
      LOGIN_ACCOUNT: handler,
      LOGOUT_ACCOUNT: handler,
      REFRESH_ACCOUNT_PERMISSIONS: handler,
    });

    expect(router({ type: 'GET_ACCOUNT_SESSION' }, sender, testContext())).toEqual({ ok: true });
    expect(router({ type: 'LOGIN_ACCOUNT', email: 'reader@example.com', password: 'secret' }, sender, testContext())).toEqual({ ok: true });
    expect(router({ type: 'LOGOUT_ACCOUNT' }, sender, testContext())).toEqual({ ok: true });
    expect(router({ type: 'REFRESH_ACCOUNT_PERMISSIONS' }, sender, testContext())).toEqual({ ok: true });
    expect(calls).toEqual([
      'GET_ACCOUNT_SESSION',
      'LOGIN_ACCOUNT',
      'LOGOUT_ACCOUNT',
      'REFRESH_ACCOUNT_PERMISSIONS',
    ]);
  });

  it('can route server index sync message types', () => {
    const calls: string[] = [];
    const handler: BackgroundHandler = (message) => {
      calls.push(message.type);
      return { ok: true };
    };

    const router = createMessageRouter({
      GET_SERVER_INDEX_AVAILABILITY: handler,
      PULL_SERVER_INDEX: handler,
      PULL_REVIEW_SERVER_INDEX: handler,
      UPLOAD_SERVER_INDEX: handler,
    });

    expect(router({ type: 'GET_SERVER_INDEX_AVAILABILITY', siteId: 'react.dev::learn' }, sender, testContext())).toEqual({ ok: true });
    expect(router({ type: 'PULL_SERVER_INDEX', siteId: 'react.dev::learn', overwrite: true }, sender, testContext())).toEqual({ ok: true });
    expect(router({ type: 'PULL_REVIEW_SERVER_INDEX', siteId: 'react.dev::learn', overwrite: true }, sender, testContext())).toEqual({ ok: true });
    expect(router({ type: 'UPLOAD_SERVER_INDEX', siteId: 'react.dev::learn' }, sender, testContext())).toEqual({ ok: true });
    expect(calls).toEqual([
      'GET_SERVER_INDEX_AVAILABILITY',
      'PULL_SERVER_INDEX',
      'PULL_REVIEW_SERVER_INDEX',
      'UPLOAD_SERVER_INDEX',
    ]);
  });
});
