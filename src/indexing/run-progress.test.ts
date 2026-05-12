import { describe, expect, it } from 'vitest';
import { createIndexRunProgressStore } from './run-progress';

function fakeScheduler() {
  let nextId = 1;
  const callbacks = new Map<number, () => void>();
  return {
    schedule(callback: () => void) {
      const id = nextId++;
      callbacks.set(id, callback);
      return id;
    },
    cancel(id: number) {
      callbacks.delete(id);
    },
    run(id: number) {
      callbacks.get(id)?.();
      callbacks.delete(id);
    },
    ids() {
      return [...callbacks.keys()];
    },
  };
}

describe('index run progress store', () => {
  it('returns null before progress is recorded', () => {
    const scheduler = fakeScheduler();
    const store = createIndexRunProgressStore({
      scheduleClear: scheduler.schedule,
      cancelClear: scheduler.cancel,
    });

    expect(store.get()).toBeNull();
  });

  it('returns the latest active progress without waiting for a broadcast listener', () => {
    const scheduler = fakeScheduler();
    const store = createIndexRunProgressStore({
      scheduleClear: scheduler.schedule,
      cancelClear: scheduler.cancel,
    });

    store.set({
      phase: 'measuring',
      current: 2,
      total: 10,
      currentTitle: 'Hooks',
      currentUrl: 'https://react.dev/reference/react',
    });

    expect(store.get()).toEqual({
      phase: 'measuring',
      current: 2,
      total: 10,
      currentTitle: 'Hooks',
      currentUrl: 'https://react.dev/reference/react',
    });
    expect(scheduler.ids()).toEqual([]);
  });

  it('keeps done progress briefly and clears it after the scheduled delay', () => {
    const scheduler = fakeScheduler();
    const store = createIndexRunProgressStore({
      scheduleClear: scheduler.schedule,
      cancelClear: scheduler.cancel,
    });

    store.set({ phase: 'done', current: 10, total: 10 });
    const [clearId] = scheduler.ids();

    expect(store.get()).toEqual({ phase: 'done', current: 10, total: 10 });
    scheduler.run(clearId);
    expect(store.get()).toBeNull();
  });

  it('cancels a pending clear when a new run starts', () => {
    const scheduler = fakeScheduler();
    const store = createIndexRunProgressStore({
      scheduleClear: scheduler.schedule,
      cancelClear: scheduler.cancel,
    });

    store.set({ phase: 'done', current: 1, total: 1 });
    const [oldClearId] = scheduler.ids();
    store.set({ phase: 'collecting', current: 0, total: 0 });

    expect(scheduler.ids()).toEqual([]);
    scheduler.run(oldClearId);
    expect(store.get()).toEqual({ phase: 'collecting', current: 0, total: 0 });
  });
});
