export type IndexFailureLogDetails = {
  message: string;
  stack?: string;
};

export type MeasurementTimeoutInput = {
  tabId: number;
  url: string;
  startedAt: number;
  now: number;
  timeoutMs: number;
};

export type MeasurementTimeoutLogDetails = {
  tabId: number;
  url: string;
  elapsedMs: number;
  timeoutMs: number;
};

export function indexFailureConsolePayload(details: IndexFailureLogDetails): [string, IndexFailureLogDetails] {
  return ['[developer-docs-progress-tracker] index failed in source tab', details];
}

export function measurementTimeoutLogDetails(input: MeasurementTimeoutInput): MeasurementTimeoutLogDetails {
  return {
    tabId: input.tabId,
    url: input.url,
    elapsedMs: input.now - input.startedAt,
    timeoutMs: input.timeoutMs,
  };
}
