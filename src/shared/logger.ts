export function formatDebugLog(label: string, details?: unknown): string {
  if (details === undefined) return `[developer-docs-progress-tracker] ${label}`;
  return `[developer-docs-progress-tracker] ${label} ${JSON.stringify(details)}`;
}

export function isVerboseLogEnabled(): boolean {
  try {
    return globalThis.localStorage?.getItem('developer-docs-progress-tracker:verbose') === '1';
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
