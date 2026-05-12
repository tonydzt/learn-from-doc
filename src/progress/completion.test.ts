import { completeRangeAtPageEnd } from './completion';

describe('progress completion', () => {
  it('extends the visible range to indexed content height at the page end', () => {
    expect(completeRangeAtPageEnd({ start: 900, end: 980 }, true, 1000)).toEqual({
      start: 900,
      end: 1000,
    });
  });

  it('leaves the visible range unchanged before the page end', () => {
    expect(completeRangeAtPageEnd({ start: 900, end: 980 }, false, 1000)).toEqual({
      start: 900,
      end: 980,
    });
  });
});
