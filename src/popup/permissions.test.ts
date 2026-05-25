import { shouldRequestPersistentOriginPermission } from './permissions';

describe('popup permissions policy', () => {
  it('requests persistent origin permissions for manually detected framework sites', () => {
    expect(shouldRequestPersistentOriginPermission({
      url: 'https://ui.shadcn.com/docs',
      adapterKind: 'framework',
    })).toBe(true);
  });

  it('requests persistent origin permissions for site adapters', () => {
    expect(shouldRequestPersistentOriginPermission({
      url: 'https://react.dev/learn',
      adapterKind: 'site',
    })).toBe(true);
  });

  it('does not request persistent origin permissions without an adapter kind', () => {
    expect(shouldRequestPersistentOriginPermission({
      url: 'https://react.dev/learn',
    })).toBe(false);
  });
});
