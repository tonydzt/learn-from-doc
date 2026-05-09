# Learn From Doc 系统上下文

这份文档用于在重启新会话后，快速理解当前 Chrome 扩展的目标、架构、约定和实现现状。

## 原始需求

目标是做一个 Chrome/Chromium MV3 扩展，用来记录文档站点的阅读进度。

支持的页面结构：

- 左侧全局导航栏 + 中间正文内容区 + 右侧页内目录
- 左侧全局导航栏 + 中间正文内容区

阅读进度定义：

- 当前页面进度 = 当前页面已浏览正文高度 / 当前页面正文总高度。
- 总进度 = 当前文档站范围内所有已浏览正文高度之和 / 当前文档站范围内所有正文总高度之和。
- “已浏览”指正文内容进入视口、用户能看到；上下滑动经过的区域都算已浏览。
- 统计对象是正文区域的渲染高度，包括文本、代码块、图片等正文内容占据的高度。

页面内展示要求：

- 总进度插入左侧全局导航栏顶部。
- 当前页面进度插入左侧全局导航栏每条目录链接文本后。
- 未创建索引时不要污染页面，只在 popup 中提示创建索引。

索引要求：

- 进入文档页后，先在本地数据库查询当前站点范围是否已有索引。
- 没有索引时，通过 popup 提供创建索引按钮。
- 创建索引时扫描左侧全局导航栏对应的递归目录，保存目录、URL、标题、正文高度、导航顺序等信息。
- 创建索引时打开页面只是机器测量，不算阅读进度。
- 索引模式通过 hash 标记传递，例如 `#__learn_from_doc_indexing=1`。
- 目录可能懒加载或折叠，索引前需要展开。

架构和技术栈要求：

- TypeScript + React + WXT。
- WXT 生成 manifest，不手写 `manifest.json`。
- 所有数据存储在浏览器本地 IndexedDB。
- 页面元素定位不能做通用启发式猜测，要通过站点 adapter 精确适配。
- 当前首版只支持 `react.dev`。

## 当前技术栈

- WXT：扩展脚手架、entrypoints、manifest 生成。
- TypeScript：核心逻辑和类型。
- React：popup 和 options 管理页。
- IndexedDB：站点索引、页面索引、阅读进度存储。
- Vitest：单元测试。

常用命令：

```bash
npm install
npm run dev
npm run build
npm test
npx tsc --noEmit
```

构建输出目录：

```text
output/chrome-mv3
```

Chrome 扩展开发模式加载这个目录。

## 目录结构

```text
entrypoints/
  background.ts          # 后台 service worker，索引调度、IndexedDB 访问、runtime message 中转
  content.ts             # content script，站点检测、索引测量、阅读采样、页面内 UI 注入
  popup/                 # React popup，显示当前页/总进度、索引状态、创建/重建索引入口
  options/               # React 管理页，查看和删除索引

src/
  adapters/              # 站点适配器接口和 react.dev 适配器
  indexing/              # 索引调试模式选项
  progress/              # 阅读区间合并、进度计算
  shared/                # 消息类型、URL 规范化、日志、常量
  storage/               # IndexedDB 封装
```

## 核心架构

### background

文件：`entrypoints/background.ts`

职责：

- 处理 runtime message。
- 作为唯一稳定的数据访问层，读写 IndexedDB。
- 调度索引任务。
- 创建后台 tab 打开待测页面。
- 等待 content script 回传正文高度。
- 保存站点索引和页面索引。
- 向 popup 广播索引进度。

重要行为：

- 索引任务串行执行，避免同时打开太多页面。
- 普通模式测量完会关闭 tab。
- debug 模式只测一个页面，并保持测量 tab 打开，方便复制日志。
- `INDEX_TIMEOUT_MS` 当前为 30000ms。

### content script

文件：`entrypoints/content.ts`

职责：

- 检测当前 URL 是否有可用 adapter。
- 索引模式下只测量正文高度并回传，不记录阅读进度。
- 普通模式下启动阅读 tracker。
- 监听滚动、resize、visibility、pagehide。
- 按正文区域和 viewport 的交集生成可见高度区间。
- 合并已浏览区间。
- 定期保存进度到 background。
- 在左侧导航栏注入总进度和页面 badge。
- 监听 WXT 的 `wxt:locationchange`，支持 React Docs SPA 左侧导航跳转。

SPA 路由处理：

- React Docs 左侧导航跳转不会重新加载 content script。
- 当前实现会在 `wxt:locationchange` 时停止旧 tracker。
- 停止旧 tracker 前会 flush 旧页面进度。
- 然后为新 URL 重新读取索引、定位正文、绑定滚动采样和 UI 刷新。

性能相关：

- 页面内 UI 刷新使用 tracker 启动时读取到的内存快照。
- 保存当前页面进度后，只更新内存快照里的当前页记录。
- MutationObserver 只用于在 React 重渲染导航后恢复/刷新注入节点，并带 300ms 防抖。
- 高频采样日志默认关闭，不影响采样精度。

### popup

文件：`entrypoints/popup/main.tsx`

职责：

- 查询当前 tab 的页面上下文。
- 展示是否支持当前站点、是否已索引。
- 展示总进度、当前页进度、页面数量等概览。
- 提供创建索引、重建索引、debug 索引入口。
- 接收 background 广播的索引进度。
- 索引完成后仍显示索引概览，而不是让进度条消失。

### options 管理页

文件：`entrypoints/options/main.tsx`

职责：

- 展示已有索引概览。
- 查看索引详情。
- 删除站点索引。

## 数据模型

IndexedDB 数据库名：

```text
learn-from-doc
```

版本：

```text
1
```

对象仓库：

```text
sites
pages
progress
```

`sites`：

```ts
type SiteRecord = {
  siteId: string;
  host: string;
  scopeKey: string;
  scopeTitle: string;
  createdAt: number;
  updatedAt: number;
};
```

`pages`：

```ts
type PageIndexRecord = {
  siteId: string;
  url: string;
  title: string;
  order: number;
  contentHeight: number;
};
```

`progress`：

```ts
type ProgressRecord = {
  siteId: string;
  url: string;
  viewedRanges: ViewedRange[];
  viewedHeight: number;
  updatedAt: number;
};
```

主键：

- `sites`: `siteId`
- `pages`: `[siteId, url]`
- `progress`: `[siteId, url]`

索引：

- `pages.bySite`
- `progress.bySite`

当前 `siteId` 生成规则：

```text
${host}::${scopeKey}
```

例如：

```text
react.dev::learn
react.dev::reference-react
```

## 进度算法

核心文件：

- `src/progress/ranges.ts`
- `src/progress/calculations.ts`

阅读采样：

- 取正文根节点 `article.getBoundingClientRect()`。
- 取 viewport 上下边界。
- 计算正文区域与 viewport 的交集。
- 转换成正文内部的高度区间 `{ start, end }`。
- 用 `addViewedRange` 合并到已有区间。

区间规则：

- 重叠区间合并。
- 相邻区间合并。
- 重复进入视口不会重复计数。
- 反向滚动同样只是合并已浏览区间。

保存：

- 内存里实时合并。
- 每 5 秒 flush 一次。
- 页面隐藏和卸载前 flush。
- SPA 路由切换前 flush 旧页面。

进度计算：

- 当前页进度：`pageProgressPercent(page, progress)`。
- 总进度：`totalProgressPercent(pages, progress)`。
- 页面高度为 0 或缺失时做防护，避免除零。

## react.dev 适配器

文件：`src/adapters/react-dev.ts`

当前支持范围：

- `https://react.dev/learn`
- `https://react.dev/learn/*`
- `https://react.dev/reference/react`
- `https://react.dev/reference/react/*`

scope：

- Learn 树：`scopeKey = learn`, `scopeTitle = Learn React`
- React Reference 树：`scopeKey = reference-react`, `scopeTitle = React Reference`

适配器职责：

- `matches(url)`：判断是否支持当前 URL。
- `getDocScope()`：识别当前文档范围。
- `expandLazyNavigation()`：展开左侧折叠/懒加载导航。
- `getSidebarLinks()`：读取当前 scope 下的左侧导航链接并去重。
- `getArticleRoot()`：定位正文根节点。
- `getProgressInsertionTargets()`：提供总进度和页面 badge 的插入目标。

注意：

- 项目原则是不做跨站点通用启发式定位。
- 新增站点时应新增 adapter，不要把 react.dev 的 DOM 选择器泛化成通用逻辑。
- 当前 react.dev adapter 内部用了明确选择器，但仍属于 react.dev 专用适配。

## 索引流程

入口：

- popup 点击创建索引或重建索引。

流程：

1. popup 向 background 发送 `START_INDEX`。
2. background 向当前 tab content script 发送 `COLLECT_INDEX_LINKS`。
3. content script 调用 adapter 展开左侧导航并收集当前 scope 下全部链接。
4. background 串行打开每个链接，并追加索引 hash。
5. 索引页面的 content script 检测到 hash 后进入测量模式。
6. 测量模式只读取正文高度、标题、规范化 URL，并发送 `INDEX_PAGE_MEASURED`。
7. background 收到测量结果后关闭 tab。
8. 全部测量完成后，background 写入 `sites` 和 `pages`。
9. background 向 popup 广播 `INDEX_RUN_PROGRESS`。
10. 完成后向原 tab 发送 `INDEX_PROGRESS_UPDATED`，让页面启动/刷新阅读 tracker。

索引 hash：

```text
#__learn_from_doc_indexing=1
```

debug hash：

```text
#__learn_from_doc_indexing=1&lfd_debug=1
```

debug 模式：

- 只测量一个页面。
- 打开的测量 tab 不关闭。
- 页面内会显示 debug 状态面板。
- 用于复制 content script 和 background 日志排查问题。

## 阅读流程

普通页面加载或 SPA 路由切换后：

1. content script 等待 hydration 后启动。
2. 根据 URL 找 adapter。
3. 读取 doc scope。
4. 通过 background 查询当前页是否已在索引中。
5. 如果未索引，跳过页面注入和阅读记录。
6. 如果已索引，读取站点 pages/progress 快照。
7. 定位正文根节点。
8. 初次采样当前 viewport。
9. 绑定 scroll/resize/visibility/pagehide。
10. 每 5 秒保存一次 dirty progress。
11. 注入或刷新左侧导航总进度和页面 badge。

索引模式下不会走阅读 tracker，因此不会把机器打开的页面算作阅读。

## 页面注入策略

目标：

- 尽量不影响 React hydration。
- 不替换 React 管理的原节点。
- 注入节点可被 MutationObserver 恢复。

当前策略：

- 等待 `requestIdleCallback` 或 fallback timeout。
- 使用扩展自有 class：`lfd-total-card`, `lfd-page-badge` 等。
- 使用统一 data 标记：`data-learn-from-doc`。
- 总进度插入 sidebar root 的第一个子元素之前。
- 页面进度 badge 作为独立 `span` append 到对应 anchor 内。
- MutationObserver 监听 body 子树变化，防抖后重新渲染注入 UI。

## UI 风格

总体风格：

- 简约、互联网产品感。
- 信息密度适中。
- 避免营销式 landing page。
- 以工具效率为主，清晰展示索引状态和进度。

Popup：

- 显示站点名称、索引状态、总进度、当前页进度。
- 有创建索引、重建索引、debug 索引入口。
- 索引完成后显示索引概览。
- 点击概览可进入管理页查看详情。

Options 管理页：

- 用于查看站点索引列表、页面详情和删除索引。

页面内：

- 左侧导航顶部展示总进度条和百分比。
- 每条已索引目录链接后展示小号百分比 badge。
- 视觉应轻量，不能干扰原文档阅读。

## 日志与调试

日志统一前缀：

```text
[learn-from-doc]
```

默认日志：

- 保留关键生命周期、索引、保存进度等日志。
- 高频滚动采样日志默认关闭。
- background 的 runtime message 入口日志默认关闭。

Verbose 日志：

```js
localStorage.setItem('learn-from-doc:verbose', '1')
```

关闭：

```js
localStorage.removeItem('learn-from-doc:verbose')
```

索引 debug 模式也会通过 `lfd_debug=1` 开启 verbose。

常见排查点：

- 页面是否支持：adapter 是否匹配当前 URL。
- 当前 scope 是否正确：`learn` 或 `reference-react`。
- 当前 URL 是否规范化后存在于 `pages`。
- content script 是否处于索引模式 hash。
- SPA 路由切换后是否出现 `reading tracker route start requested`。
- 是否成功保存：`reading progress saved`。

## 已修复的重要问题

### content script 直接读 IndexedDB 读不到 background 写入的数据

现象：

- background 已保存索引。
- 页面普通模式仍显示 indexed page count 为 0。

根因：

- content script 直接访问 IndexedDB 时和 extension background 的数据上下文不一致。

修复：

- IndexedDB 访问集中到 background。
- content script 通过 runtime message 读写站点、页面和进度数据。

### React Docs 左侧导航 SPA 跳转后不继续记录新页面

现象：

- 当前页滚动能记录。
- 从左侧目录跳到新页面后不再正常记录或刷新。

根因：

- React Docs 是 SPA 导航，content script 不会重新加载。
- 旧 tracker 仍绑定旧 article 和旧 URL。

修复：

- 监听 `wxt:locationchange`。
- 路由变化时停止旧 tracker 并 flush。
- 为新 URL 重启 tracker。

### 页面内 UI 刷新导致 background 高频 GET_SITE_PAGES/GET_SITE_PROGRESS

现象：

- service worker 控制台频繁出现 `GET_SITE_PAGES` 和 `GET_SITE_PROGRESS`。

根因：

- MutationObserver 触发 `renderProgressUi()`。
- 每次 UI 渲染都向 background 拉 pages/progress。

修复：

- tracker 启动时读取一次站点快照。
- 后续 UI 渲染使用内存快照。
- 保存进度后只更新快照中的当前页记录。
- MutationObserver 加 300ms 防抖。

### 滚动采样日志刷屏

现象：

- 滚动时频繁输出 `reading sample recorded`。

根因：

- 每次新增可见区间都打印 debug 日志。

修复：

- 高频采样日志改为 `lfdTrace`，默认关闭。
- 不改变采样频率、区间合并或保存逻辑，因此不降低可靠性和精度。

## 测试策略

已有测试覆盖：

- `src/progress/ranges.test.ts`
  - 区间合并
  - 重叠
  - 相邻
  - 重复进入
  - 反向滚动

- `src/progress/calculations.test.ts`
  - 空索引
  - 单页/多页进度
  - 高度为 0 的防护

- `src/adapters/react-dev.test.ts`
  - react.dev URL 匹配
  - scope/link 去重等 adapter 行为

- `src/indexing/debug-options.test.ts`
  - debug 索引只选一个页面等行为

- `src/shared/logger.test.ts`
  - 日志格式
  - trace 默认关闭

常规验证：

```bash
npm test
npx tsc --noEmit
npm run build
```

手动验收建议：

1. 加载 `output/chrome-mv3`。
2. 打开 `https://react.dev/learn`。
3. 创建索引。
4. 确认 popup 能看到索引概览和页面数量。
5. 滚动当前页，等待保存后确认当前页进度增长。
6. 从左侧导航跳到另一篇文章，确认新页面也能记录。
7. 刷新页面，确认进度保留。
8. 打开 service worker 控制台，确认没有高频 message 日志刷屏。

## 约束与开发原则

- 后续交流和展示使用中文。
- 改动要尽量小而明确，不做无关重构。
- 不手写最终 `manifest.json`，由 WXT 生成。
- 构建产物使用非隐藏目录 `output/chrome-mv3`。
- 新增站点支持时新增 adapter，不修改核心进度算法来适配特定 DOM。
- 不要把创建索引时打开的页面计入阅读进度。
- 不要为了减少日志或消息而降低阅读采样精度。
- 页面注入要考虑 React hydration 和 React 后续重渲染。
- 高频日志必须默认关闭，需要时通过 verbose/debug 打开。

## 未来扩展方向

- 新增更多文档站点 adapter。
- 管理页增加页面级进度重置。
- 重建索引时更精细地保留已有 URL 的阅读区间。
- 对索引失败页面提供重试和错误列表。
- 增加端到端集成测试，覆盖真实扩展消息流和索引流程。
