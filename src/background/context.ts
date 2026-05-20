import { createIndexRunProgressStore } from '../indexing/run-progress';
import type { BackgroundContext } from './types';

export function createBackgroundContext(): BackgroundContext {
  return {
    pendingMeasurements: new Map(),
    indexRunProgress: createIndexRunProgressStore(),
  };
}

export const backgroundContext = createBackgroundContext();
