import type { IndexRunProgressMessage } from '../shared/messages';

// 索引完成后不立刻清空快照：popup 可能刚好在完成瞬间被重新打开，
// 保留几秒能让它读到 done 状态并刷新索引概览。
export const INDEX_RUN_PROGRESS_CLEAR_DELAY_MS = 3000;

export type IndexRunProgress = IndexRunProgressMessage['payload'];

type ClearHandle = unknown;

// 把计时器注入进来，生产环境用 setTimeout，单元测试可以用假 scheduler 精确触发清理。
type ProgressStoreScheduler = {
  scheduleClear(callback: () => void): ClearHandle;
  cancelClear(handle: ClearHandle): void;
};

const defaultScheduler: ProgressStoreScheduler = {
  scheduleClear(callback) {
    return globalThis.setTimeout(callback, INDEX_RUN_PROGRESS_CLEAR_DELAY_MS);
  },
  cancelClear(handle) {
    globalThis.clearTimeout(handle as ReturnType<typeof globalThis.setTimeout>);
  },
};

// 保存“当前正在创建索引”的最后一条进度快照。
// 这个 store 只放在 background 的内存里：关闭/重开 popup 不会丢，
// 但浏览器或 service worker 重启后会自然丢失，避免把临时运行状态写入持久存储。
export function createIndexRunProgressStore(scheduler: ProgressStoreScheduler = defaultScheduler) {
  let current: IndexRunProgress | null = null;
  let clearHandle: ClearHandle | undefined;

  const cancelPendingClear = () => {
    if (clearHandle == null) return;
    scheduler.cancelClear(clearHandle);
    clearHandle = undefined;
  };

  const scheduleClear = (clear: () => void) => {
    cancelPendingClear();
    clearHandle = scheduler.scheduleClear(() => {
      clearHandle = undefined;
      clear();
    });
  };

  return {
    get() {
      return current;
    },
    set(progress: IndexRunProgress) {
      // 新进度到达时，任何旧的“延迟清理”都已经过期，必须取消；
      // 否则旧 timer 可能清掉新一轮索引的进度。
      cancelPendingClear();
      current = progress;
      if (progress.phase === 'done') {
        scheduleClear(() => {
          if (current?.phase === 'done') current = null;
        });
      }
    },
    clearSoon() {
      // 失败路径没有专门的 progress phase。这里延迟清空，避免 popup
      // 在错误返回前后的极短时间里读到半更新状态后又被立即抹掉。
      scheduleClear(() => {
        current = null;
      });
    },
  };
}
