import { shouldRequestPersistentOriginPermission } from './permissions';

describe('popup permissions policy', () => {
  it('requests persistent origin permissions for manually detected framework sites', () => {
    expect(shouldRequestPersistentOriginPermission({
      url: 'https://ui.shadcn.com/docs',
      adapterKind: 'framework',
    })).toBe(true);
  });

  it('does not request persistent origin permissions for site adapters', () => {
    expect(shouldRequestPersistentOriginPermission({
      url: 'https://react.dev/learn',
      adapterKind: 'site',
    })).toBe(false);
  });
});
