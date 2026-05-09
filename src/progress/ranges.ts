export type ViewedRange = {
  start: number;
  end: number;
};

export function mergeRanges(ranges: ViewedRange[]): ViewedRange[] {
  const valid = ranges
    .filter((range) => Number.isFinite(range.start) && Number.isFinite(range.end))
    .map((range) => ({
      start: Math.max(0, Math.min(range.start, range.end)),
      end: Math.max(0, Math.max(range.start, range.end)),
    }))
    .filter((range) => range.end > range.start)
    .sort((a, b) => a.start - b.start);

  const merged: ViewedRange[] = [];
  for (const range of valid) {
    const last = merged.at(-1);
    if (!last || range.start > last.end) {
      merged.push({ ...range });
      continue;
    }
    last.end = Math.max(last.end, range.end);
  }
  return merged;
}

export function addViewedRange(ranges: ViewedRange[], next: ViewedRange): ViewedRange[] {
  return mergeRanges([...ranges, next]);
}

export function viewedHeight(ranges: ViewedRange[], contentHeight = Number.POSITIVE_INFINITY): number {
  const max = Math.max(0, contentHeight);
  return mergeRanges(ranges).reduce((sum, range) => {
    const start = Math.min(range.start, max);
    const end = Math.min(range.end, max);
    return sum + Math.max(0, end - start);
  }, 0);
}

export function percent(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return 0;
  }
  return Math.min(100, Math.max(0, (numerator / denominator) * 100));
}
