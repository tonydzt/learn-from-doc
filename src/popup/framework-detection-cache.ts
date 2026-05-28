import { browser } from 'wxt/browser';
import type { PageAdapterContext } from '../shared/messages';
import { siteIdFor } from '../shared/url';

// 保存“手动检测过但还没成功创建索引”的框架识别结果。
// 这样用户下次打开 popup 时，可以直接恢复到已识别状态，而不用重新点“检测文档框架”。
const DETECTED_FRAMEWORK_CONTEXTS_KEY = 'detectedFrameworkContexts';

// key 使用和站点索引一致的 host::scopeKey，例如 ui.shadcn.com::docs。
// value 保存检测得到的 PageAdapterContext，真正展示前仍会重新注入 content script 校验页面。
type DetectedFrameworkContexts = Record<string, PageAdapterContext>;

function firstPathSegment(pathname: string): string | undefined {
  return pathname.split('/').filter(Boolean)[0];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

// 只有完整的 framework context 才能缓存。
// site adapter 不走这里；已创建索引后会优先使用 SiteRecord，不依赖这个检测缓存。
function isCacheableFrameworkContext(context: PageAdapterContext): context is PageAdapterContext & {
  host: string;
  scopeKey: string;
  scopeTitle: string;
} {
  return context.supported
    && context.adapterKind === 'framework'
    && typeof context.host === 'string'
    && typeof context.scopeKey === 'string'
    && typeof context.scopeTitle === 'string';
}

async function getDetectedFrameworkContexts(): Promise<DetectedFrameworkContexts> {
  const stored = await browser.storage.local.get(DETECTED_FRAMEWORK_CONTEXTS_KEY);
  const contexts = stored[DETECTED_FRAMEWORK_CONTEXTS_KEY];
  // storage.local 可能被旧版本或用户手动写入异常数据；这里做最小对象校验，坏数据当空缓存处理。
  return isRecord(contexts) ? contexts as DetectedFrameworkContexts : {};
}

export async function saveDetectedFrameworkContext(context: PageAdapterContext): Promise<void> {
  if (!isCacheableFrameworkContext(context)) return;
  const contexts = await getDetectedFrameworkContexts();
  // 同一个 host::scopeKey 后检测到的结果覆盖旧结果，避免框架识别规则升级后保留旧标题/框架名。
  await browser.storage.local.set({
    [DETECTED_FRAMEWORK_CONTEXTS_KEY]: {
      ...contexts,
      [siteIdFor(context.host, context.scopeKey)]: context,
    },
  });
}

export async function cachedDetectedFrameworkContextForUrl(url: string | undefined): Promise<PageAdapterContext | null> {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const contexts = await getDetectedFrameworkContexts();
  return Object.values(contexts).find((context) => {
    if (!isCacheableFrameworkContext(context)) return false;
    if (context.host !== parsed.hostname) return false;
    // root scope 表示整个 host 都属于同一套文档，例如 Retype 站点常见这种结构。
    if (context.scopeKey === 'root') return true;
    // 普通 framework scope 按首个路径段匹配：/docs/a 和 /docs/b 属于 docs，/blocks 不属于。
    return firstPathSegment(parsed.pathname) === context.scopeKey;
  }) ?? null;
}
