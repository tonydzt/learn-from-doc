# 后端开发者阅读指南

这份文档用于从后端视角快速理解当前 Chrome 扩展代码。建议先读这份，再读 `docs/SYSTEM_CONTEXT.md`。

## 先建立类比

| 前端/扩展概念 | 可以类比成 | 本仓库里的位置 |
| --- | --- | --- |
| WXT entrypoint | 应用启动入口 | `entrypoints/background.ts`, `entrypoints/content.ts`, `entrypoints/popup/main.tsx`, `entrypoints/options/main.tsx` |
| background service worker | 后端服务/API 层 | `entrypoints/background.ts` |
| runtime message | 进程内 RPC/HTTP 请求 | `src/shared/messages.ts` |
| content script | 注入到目标网页旁边运行的客户端脚本 | `entrypoints/content.ts` |
| popup | 浏览器工具栏弹窗页面 | `entrypoints/popup/main.tsx` |
| options | 扩展管理后台页面 | `entrypoints/options/main.tsx` |
| IndexedDB | 浏览器本地数据库 | `src/storage/db.ts` |
| adapter | 站点专用解析器 | `src/adapters/*` |
| React state | 页面内存状态 | `useState`, `setState` |
| React effect | 页面生命周期 hook | `useEffect` |
| Vitest | 单元测试框架 | `*.test.ts` |

## 推荐阅读顺序

1. `docs/SYSTEM_CONTEXT.md`
   先看目标、数据模型和完整流程，不需要记住所有细节。

2. `src/shared/messages.ts`
   这是扩展内部 API 契约。先理解有哪些 message type，再读调用方会轻松很多。

3. `entrypoints/background.ts`
   把它当成后端 controller/service：接收消息、读写数据、调度索引。

4. `src/storage/db.ts`
   看 IndexedDB 的表结构、主键、事务封装。这里是本地持久化层。

5. `entrypoints/content.ts`
   看它如何在 react.dev 页面里定位正文、记录可见区间、注入进度 UI。

6. `src/adapters/react-dev.ts`
   看站点 DOM 解析逻辑。新增站点支持时主要从这里复制模式。

7. `entrypoints/popup/main.tsx` 和 `entrypoints/options/main.tsx`
   最后看 React UI。重点看数据从哪里来、点击按钮发什么 message，不必先深究 JSX 样式。

## 一条主流程

创建索引：

```text
popup 点击按钮
  -> runtime message: START_INDEX
  -> background 请求当前 tab 收集导航链接
  -> content script 调用 adapter 展开导航并返回链接
  -> background 逐个打开测量 tab
  -> 测量 tab 的 content script 回传正文高度
  -> background 写入 IndexedDB 的 sites/pages
```

记录阅读：

```text
content script 启动
  -> 通过 adapter 找正文 article
  -> 从 background 查询当前页是否已索引
  -> scroll/resize 时计算正文可见高度区间
  -> 合并 viewedRanges
  -> 定期发送 SAVE_PROGRESS_RECORD
  -> background 写入 IndexedDB 的 progress
```

查看数据：

```text
popup/options
  -> 发送 GET_* message
  -> background 查询 IndexedDB
  -> React 根据返回结果重新渲染
```

## 读 React 代码时抓三件事

1. `useState`
   当前页面的内存状态。类似 handler 执行期间持有的响应数据，但它会驱动 UI 自动重渲染。

2. `useEffect`
   页面生命周期副作用。常见用途是“首次加载数据”或“注册/清理事件监听”。

3. JSX
   可以把它看成模板语法。`{state.status === 'ready' ? ... : ...}` 就是条件渲染。

## 读 IndexedDB 代码时抓三件事

1. `objectStore`
   类似表。当前有 `sites`、`pages`、`progress`。

2. `keyPath`
   类似主键。`pages` 和 `progress` 用 `[siteId, url]` 作为复合主键。

3. `transaction`
   IndexedDB 强制所有读写都在事务里完成。本仓库用 `tx()` 把事件式 API 包成 Promise。

## 建议的理解方式

- 先画一张消息流图：以 `RuntimeMessage` 的每个 type 为边，连接 popup/options/content/background。
- 跑 `npm test` 看哪些纯逻辑有测试；先理解 `src/progress/*`，它们不依赖浏览器环境。
- 用浏览器扩展开发模式加载 `output/chrome-mv3` 后，配合 `localStorage.setItem('developer-docs-progress-tracker:verbose', '1')` 看关键日志。
- 新增功能前先写“入口是谁、消息是什么、数据落哪张表”三句话，通常能避免在 React 和扩展上下文之间迷路。
