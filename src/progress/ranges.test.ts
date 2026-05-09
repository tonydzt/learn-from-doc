import { addViewedRange, mergeRanges, percent, viewedHeight } from './ranges';

describe('range progress', () => {
  it('merges overlapping and adjacent ranges', () => {
    expect(mergeRanges([
      { start: 20, end: 30 },
      { start: 0, end: 10 },
      { start: 10, end: 20 },
      { start: 25, end: 40 },
    ])).toEqual([{ start: 0, end: 40 }]);
  });

  it('normalizes reverse scroll ranges', () => {
    expect(addViewedRange([], { start: 80, end: 40 })).toEqual([{ start: 40, end: 80 }]);
  });

  it('ignores repeated visible areas', () => {
    const ranges = mergeRanges([
      { start: 0, end: 100 },
      { start: 20, end: 40 },
      { start: 50, end: 70 },
    ]);
    expect(viewedHeight(ranges, 200)).toBe(100);
  });

  it('clamps viewed height to content height', () => {
    expect(viewedHeight([{ start: 0, end: 300 }], 120)).toBe(120);
  });

  it('returns zero percent for empty denominator', () => {
    expect(percent(10, 0)).toBe(0);
  });
});
