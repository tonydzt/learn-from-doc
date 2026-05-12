export type IndexFailureLogDetails = {
  message: string;
  stack?: string;
};

export function indexFailureConsolePayload(details: IndexFailureLogDetails): [string, IndexFailureLogDetails] {
  return ['[learn-from-doc] index failed in source tab', details];
}
