import { indexFailureConsolePayload, measurementTimeoutLogDetails } from './source-tab-log';

describe('source tab index failure logging', () => {
  it('formats index failure details for the source tab console', () => {
    expect(indexFailureConsolePayload({
      message: 'Timed out while measuring page.',
      stack: 'Error: Timed out while measuring page.',
    })).toEqual([
      '[developer-docs-progress-tracker] index failed in source tab',
      {
        message: 'Timed out while measuring page.',
        stack: 'Error: Timed out while measuring page.',
      },
    ]);
  });

  it('includes page url and elapsed time in measurement timeout details', () => {
    expect(measurementTimeoutLogDetails({
      tabId: 42,
      url: 'https://playwright.dev/docs/release-notes',
      startedAt: 1000,
      now: 31500,
      timeoutMs: 30000,
    })).toEqual({
      tabId: 42,
      url: 'https://playwright.dev/docs/release-notes',
      elapsedMs: 30500,
      timeoutMs: 30000,
    });
  });
});
