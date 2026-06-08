import { requestToPromise, tx } from './connection';
import type { IndexCheckpointRecord } from './types';

export function getIndexCheckpoint(siteId: string): Promise<IndexCheckpointRecord | undefined> {
  return tx(['indexCheckpoints'], 'readonly', ({ indexCheckpoints }) => {
    return requestToPromise<IndexCheckpointRecord | undefined>(indexCheckpoints.get(siteId));
  });
}

export function saveIndexCheckpoint(record: IndexCheckpointRecord): Promise<void> {
  return tx(['indexCheckpoints'], 'readwrite', async ({ indexCheckpoints }) => {
    indexCheckpoints.put(record);
  });
}

export function deleteIndexCheckpoint(siteId: string): Promise<void> {
  return tx(['indexCheckpoints'], 'readwrite', async ({ indexCheckpoints }) => {
    indexCheckpoints.delete(siteId);
  });
}
