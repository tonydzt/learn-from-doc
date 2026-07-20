import { createBackgroundContext } from '../../context';
import type { RuntimeMessageSender } from '../../types';
import { runIndex } from '../popup/indexing';
import { handleDevelopmentIndexMessage } from './indexing';

vi.mock('../popup/indexing', () => ({
  runIndex: vi.fn(async () => ({ ok: true })),
}));

describe('development indexing background controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('DEV', true);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('starts indexing the sender tab in development builds', async () => {
    const context = createBackgroundContext();

    await handleDevelopmentIndexMessage(
      { type: 'DEV_START_INDEX_FROM_PAGE' },
      { tab: { id: 31 } } as RuntimeMessageSender,
      context,
    );

    expect(runIndex).toHaveBeenCalledWith(context, 31);
  });

  it('rejects the page shortcut in production builds', async () => {
    vi.stubEnv('DEV', false);
    const context = createBackgroundContext();

    expect(handleDevelopmentIndexMessage(
      { type: 'DEV_START_INDEX_FROM_PAGE' },
      { tab: { id: 31 } } as RuntimeMessageSender,
      context,
    )).toEqual({
      ok: false,
      error: 'Development indexing is unavailable in production builds.',
    });
    expect(runIndex).not.toHaveBeenCalled();
  });

  it('rejects messages without a source tab', () => {
    expect(handleDevelopmentIndexMessage(
      { type: 'DEV_START_INDEX_FROM_PAGE' },
      {} as RuntimeMessageSender,
      createBackgroundContext(),
    )).toEqual({
      ok: false,
      error: 'No source tab found for development indexing.',
    });
    expect(runIndex).not.toHaveBeenCalled();
  });
});
