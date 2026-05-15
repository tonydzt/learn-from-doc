import { formatDebugLog, isVerboseLogEnabled, lfdTrace } from './logger';

describe('formatDebugLog', () => {
  it('formats copyable single-line JSON logs', () => {
    expect(formatDebugLog('indexing measurement payload', {
      url: 'https://react.dev/learn',
      contentHeight: 1234,
    })).toBe('[developer-docs-progress-tracker] indexing measurement payload {"url":"https://react.dev/learn","contentHeight":1234}');
  });
});

describe('isVerboseLogEnabled', () => {
  it('is disabled by default', () => {
    expect(isVerboseLogEnabled()).toBe(false);
  });
});

describe('lfdTrace', () => {
  it('does not write console output by default', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    lfdTrace('reading sample recorded', { start: 0 });

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
