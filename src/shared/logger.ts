export function formatDebugLog(label: string, details?: unknown): string {
  if (details === undefined) return `[learn-from-doc] ${label}`;
  return `[learn-from-doc] ${label} ${JSON.stringify(details)}`;
}

export function isVerboseLogEnabled(): boolean {
  try {
    if (globalThis.location?.hash.includes('lfd_debug=1')) return true;
  } catch {
    // Ignore environments without a readable location.
  }

  try {
    return globalThis.localStorage?.getItem('learn-from-doc:verbose') === '1';
  } catch {
    return false;
  }
}

export function lfdDebug(label: string, details?: unknown): void {
  console.info(formatDebugLog(label, details));
}

export function lfdTrace(label: string, details?: unknown): void {
  if (!isVerboseLogEnabled()) return;
  console.info(formatDebugLog(label, details));
}
