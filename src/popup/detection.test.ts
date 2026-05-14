import { detectionResultState, initialDetectionState } from './detection';

describe('popup detection state', () => {
  it('uses URL-only site adapters without requiring manual detection', () => {
    expect(initialDetectionState('https://react.dev/learn')).toEqual({
      status: 'supported',
      context: {
        supported: true,
        host: 'react.dev',
        scopeKey: 'learn',
        scopeTitle: 'Learn React',
        adapterKind: 'site',
        indexable: true,
      },
    });
  });

  it('requires manual detection for unknown https sites before injecting a content script', () => {
    expect(initialDetectionState('https://ui.shadcn.com/docs')).toEqual({
      status: 'needs-manual-detect',
    });
  });

  it('marks a manually detected framework adapter as supported', () => {
    expect(detectionResultState({
      supported: true,
      host: 'ui.shadcn.com',
      scopeKey: 'docs',
      scopeTitle: 'Fumadocs Docs',
      adapterKind: 'framework',
      frameworkName: 'Fumadocs',
      indexable: true,
    })).toEqual({
      status: 'supported',
      context: {
        supported: true,
        host: 'ui.shadcn.com',
        scopeKey: 'docs',
        scopeTitle: 'Fumadocs Docs',
        adapterKind: 'framework',
        frameworkName: 'Fumadocs',
        indexable: true,
      },
    });
  });
});
