import { browser } from 'wxt/browser';
import type { IndexPageMeasuredMessage, RuntimeMessage } from '../shared/messages';
import type { createIndexRunProgressStore } from '../indexing/run-progress';

export type PendingMeasurement = {
  url: string;
  startedAt: number;
  resolve: (payload: IndexPageMeasuredMessage['payload']) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof globalThis.setTimeout>;
};

export type BackgroundContext = {
  pendingMeasurements: Map<number, PendingMeasurement>;
  indexRunProgress: ReturnType<typeof createIndexRunProgressStore>;
};

export type RuntimeMessageSender = Parameters<
  Parameters<typeof browser.runtime.onMessage.addListener>[0]
>[1];

export type BackgroundHandler<TMessage extends RuntimeMessage = RuntimeMessage> = (
  message: TMessage,
  sender: RuntimeMessageSender,
  context: BackgroundContext,
) => unknown;

export type MessageRouter = BackgroundHandler;
