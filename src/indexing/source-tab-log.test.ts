import { indexFailureConsolePayload } from './source-tab-log';

describe('source tab index failure logging', () => {
  it('formats index failure details for the source tab console', () => {
    expect(indexFailureConsolePayload({
      message: 'Timed out while measuring page.',
      stack: 'Error: Timed out while measuring page.',
    })).toEqual([
      '[learn-from-doc] index failed in source tab',
      {
        message: 'Timed out while measuring page.',
        stack: 'Error: Timed out while measuring page.',
      },
    ]);
  });
});
