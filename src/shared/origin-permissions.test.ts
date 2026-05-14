import { indexedAutoInjectTargetForUrl, originPermissionPatternForUrl, shouldRequestPersistentOriginPermission } from './origin-permissions';
import type { SiteRecord } from '../storage/db';

function site(scopeKey: string): SiteRecord {
  return {
    siteId: `ui.shadcn.com::${scopeKey}`,
    host: 'ui.shadcn.com',
    scopeKey,
    scopeTitle: 'shadcn/ui',
    createdAt: 1,
    updatedAt: 1,
  };
}

describe('origin permission helpers', () => {
  it('builds an origin permission pattern for web urls', () => {
    expect(originPermissionPatternForUrl('https://ui.shadcn.com/docs/components/button')).toBe('https://ui.shadcn.com/*');
  });

  it('ignores non-web urls', () => {
    expect(originPermissionPatternForUrl('chrome://extensions')).toBeNull();
  });

  it('requests persistent origin permission for framework adapters only', () => {
    expect(shouldRequestPersistentOriginPermission({
      url: 'https://ui.shadcn.com/docs',
      adapterKind: 'framework',
    })).toBe(true);
    expect(shouldRequestPersistentOriginPermission({
      url: 'https://react.dev/learn',
      adapterKind: 'site',
    })).toBe(false);
  });

  it('finds an indexed target that background can auto-inject after permission is granted', () => {
    const target = indexedAutoInjectTargetForUrl('https://ui.shadcn.com/docs/components/button', [site('docs')]);
    expect(target?.originPattern).toBe('https://ui.shadcn.com/*');
    expect(target?.site.scopeKey).toBe('docs');
  });

  it('does not auto-inject unindexed urls', () => {
    expect(indexedAutoInjectTargetForUrl('https://ui.shadcn.com/blocks', [site('docs')])).toBeNull();
  });
});
