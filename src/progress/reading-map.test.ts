import { readingMapSegments, viewportMapSegment } from './reading-map';

describe('readingMapSegments', () => {
  it('maps viewed ranges to content-height percentages', () => {
    expect(readingMapSegments([
      { start: 100, end: 250 },
      { start: 500, end: 750 },
    ], 1000)).toEqual([
      { top: 10, height: 15 },
      { top: 50, height: 25 },
    ]);
  });

  it('returns no segments for empty ranges or invalid content height', () => {
    expect(readingMapSegments([], 1000)).toEqual([]);
    expect(readingMapSegments([{ start: 0, end: 100 }], 0)).toEqual([]);
  });

  it('normalizes ranges and clamps them to content height', () => {
    expect(readingMapSegments([
      { start: 300, end: 100 },
      { start: 900, end: 1200 },
    ], 1000)).toEqual([
      { top: 10, height: 20 },
      { top: 90, height: 10 },
    ]);
  });
});

describe('viewportMapSegment', () => {
  it('maps the current viewport range to content-height percentages', () => {
    expect(viewportMapSegment({ start: 200, end: 450 }, 1000)).toEqual({ top: 20, height: 25 });
  });

  it('returns null for missing range or invalid content height', () => {
    expect(viewportMapSegment(null, 1000)).toBeNull();
    expect(viewportMapSegment({ start: 0, end: 100 }, 0)).toBeNull();
  });
});
