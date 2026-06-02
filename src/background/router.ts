import { handleContentMessages } from './controllers/content/reading';
import { handleMeasurementMessage } from './controllers/internal/measurement';
import { handleOptionsMessages } from './controllers/options/index-management';
import { handlePopupMessages } from './controllers/popup/indexing';
import { handleSharedQueryMessages } from './controllers/shared/queries';
import { lfdTrace } from '../shared/logger';
import type { RuntimeMessage } from '../shared/messages';
import type { BackgroundHandler, MessageRouter } from './types';

// message.type -> handler 的静态映射。
type HandlersByMessageType = Partial<Record<RuntimeMessage['type'], BackgroundHandler>>;

export function createMessageRouter(handlersByType: HandlersByMessageType): MessageRouter {
  return (message, sender, context) => {
    lfdTrace('runtime message received in background', {
      type: message.type,
      senderTabId: sender.tab?.id,
    });

    // 未注册的消息类型直接忽略，保持与 browser.runtime.onMessage 的宽松契约一致。
    const handler = handlersByType[message.type];
    if (!handler) return undefined;
    return handler(message, sender, context);
  };
}

// 按消息类型把请求分发到对应 controller。
// 同一 controller 可能负责多个消息类型（例如 options/content/shared 查询）。
export const handleRuntimeMessage = createMessageRouter({
  // internal measurement
  INDEX_PAGE_MEASURED: handleMeasurementMessage,
  // options page
  GET_INDEX_OVERVIEWS: handleOptionsMessages,
  SAVE_SITE_SETTINGS: handleOptionsMessages,
  SAVE_APP_SETTINGS: handleOptionsMessages,
  EXPORT_PORTABLE_DATA: handleOptionsMessages,
  PREVIEW_PORTABLE_IMPORT: handleOptionsMessages,
  IMPORT_PORTABLE_DATA: handleOptionsMessages,
  CLEAR_SITE_PROGRESS: handleOptionsMessages,
  CLEAR_ALL_PROGRESS: handleOptionsMessages,
  DELETE_SITE_INDEX: handleOptionsMessages,
  // popup
  GET_INDEX_RUN_PROGRESS: handlePopupMessages,
  GET_INDEX_CHECKPOINT: handlePopupMessages,
  START_INDEX: handlePopupMessages,
  REGISTER_PENDING_INDEX_AFTER_PERMISSION: handlePopupMessages,
  CLEAR_PENDING_INDEX_AFTER_PERMISSION: handlePopupMessages,
  // content script write/read
  HAS_ORIGIN_PERMISSION: handleContentMessages,
  GET_SITE_PAGES: handleContentMessages,
  GET_PAGE_RECORD: handleContentMessages,
  GET_SITE_PROGRESS: handleContentMessages,
  SAVE_PROGRESS_RECORD: handleContentMessages,
  DELETE_PAGE_PROGRESS: handleContentMessages,
  // shared read queries
  GET_INDEXED_SCOPE_FOR_URL: handleSharedQueryMessages,
  GET_SITE_SNAPSHOT: handleSharedQueryMessages,
  GET_SITE_SETTINGS: handleSharedQueryMessages,
  GET_APP_SETTINGS: handleSharedQueryMessages,
});
