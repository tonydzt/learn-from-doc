import type { ViewedRange } from '../../progress/ranges';

const tx = vi.fn();

vi.mock('./connection', () => ({
  indexAll: vi.fn(),
  tx: (...args: unknown[]) => tx(...args),
}));

describe('indexed db progress storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes page urls before saving progress', async () => {
    const progress = { put: vi.fn() };
    tx.mockImplementation(async (_stores, _mode, run) => run({ progress }));
    const { saveProgress } = await import('./progress');
    const ranges: ViewedRange[] = [{ start: 0, end: 100 }];

    const record = await saveProgress('docs.example.com::docs', 'https://docs.example.com/intro/', ranges, 500);

    expect(record.url).toBe('https://docs.example.com/intro');
    expect(progress.put).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://docs.example.com/intro',
    }));
  });
});
