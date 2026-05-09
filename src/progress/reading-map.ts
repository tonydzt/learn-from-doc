import { mergeRanges, type ViewedRange } from './ranges';

export type ReadingMapSegment = {
  top: number;
  height: number;
};

function toSegment(range: ViewedRange, contentHeight: number): ReadingMapSegment | null {
  if (!Number.isFinite(contentHeight) || contentHeight <= 0) return null;

  const start = Math.min(Math.max(0, range.start), contentHeight);
  const end = Math.min(Math.max(0, range.end), contentHeight);
  if (end <= start) return null;

  return {
    top: (start / contentHeight) * 100,
    height: ((end - start) / contentHeight) * 100,
  };
}

export function readingMapSegments(ranges: ViewedRange[], contentHeight: number): ReadingMapSegment[] {
  if (!Number.isFinite(contentHeight) || contentHeight <= 0) return [];
  return mergeRanges(ranges)
    .map((range) => toSegment(range, contentHeight))
    .filter((segment): segment is ReadingMapSegment => segment !== null);
}

export function viewportMapSegment(range: ViewedRange | null, contentHeight: number): ReadingMapSegment | null {
  if (!range) return null;
  return toSegment(range, contentHeight);
}
