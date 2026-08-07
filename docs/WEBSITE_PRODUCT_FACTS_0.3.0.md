# Developer Docs Progress Tracker 官网产品事实资料（0.3.0）

## 产品身份

| 项目 | 当前事实 |
| --- | --- |
| 产品名称 | `Developer Docs Progress Tracker` |
| 产品类型 | Chrome MV3、Firefox MV3 浏览器扩展 |
| 当前版本 | `0.3.0` |
| 核心用途 | 建立开发者文档索引，按实际进入视口的正文区域记录并恢复阅读进度 |
| 默认数据模式 | 本地存储与处理 |
| 可选联网能力 | 账号登录及按账号权限开放的服务端索引拉取、评审拉取和上传 |
| 生产 API | `https://learn-from-doc-web.vercel.app` |

## 0.3.0 用户可见能力

- 创建、重建和断点恢复文档索引；索引测量不会计入阅读进度。
- 记录可见正文区间，计算页面与文档范围进度，并恢复上次阅读位置。
- 在支持站点侧栏显示总进度、页面进度徽章和可选阅读地图。
- 提供页面级、站点级和“新页面默认记录”开关。
- 管理、删除、导入和导出本地索引，可选择是否包含阅读进度。
- 管理页按 host 聚合索引，并在同一 host 下切换多个文档 scope。
- 提供 12 种可选界面语言；英文覆盖最完整，不能宣称其他语言完全等量翻译。
- 可选账号页支持登录、退出、会话过期状态和权限刷新。
- 具有权限的账号可查询、拉取或上传服务端索引；评审索引拉取仅对额外权限开放。

## 专用支持站点

| 站点 | 0.3.0 支持范围 |
| --- | --- |
| React Docs | Learn、Reference、Community、Blog |
| Playwright Docs | Node.js、Python、Java、.NET 的指南/API，以及 Playwright MCP |
| OpenAI Codex Docs | Codex 文档范围 |
| MDN Web Docs | `/en-US/docs/Web` 下按一级 Web 分类划分 scope |
| Docker Docs | Get started、Manuals、Guides、Reference |
| GitHub Docs | 英文站点下已识别的产品级文档 scope |

另可检测 Docusaurus、Fumadocs、Material for MkDocs、Nextra、Retype、Starlight 和 VitePress。框架检测是结构适配，不应表述为对所有使用该框架的网站永久兼容。

## 数据与联网事实

- 本地索引和阅读进度保存在 IndexedDB；设置、缓存和可选账号会话保存在 extension local storage。
- 不登录时，核心索引与阅读进度功能仍可本地使用。
- 登录会把用户输入的邮箱和密码发送到生产 API；密码不写入 extension storage。
- 本地账号会话包含访问令牌、可选刷新令牌、用户信息、权限和过期时间。
- 用户主动上传索引时，上传内容包含站点元数据、页面记录、站点设置和阅读进度，不包含网页正文。
- 用户拉取服务端索引会写入本地；已有同 site ID 索引时，界面要求确认覆盖。
- Firefox 最低版本为 140；manifest required 数据类别为 `authenticationInfo`、`personallyIdentifyingInfo`、`browsingActivity`、`websiteActivity` 和 `websiteContent`，用于覆盖可选账号和用户主动上传索引时可能传输的数据。

## 发布材料边界

- 当前仓库未包含可直接交付的商店截图、logo 源文件、支持邮箱、隐私政策 URL、Chrome Web Store URL 或 Firefox Add-ons URL。
- 账号权限由服务端响应决定，不应对所有用户承诺多设备同步、服务器拉取或评审索引能力。
- 全文检索、笔记/标注、专注模式、AI 问答、阅读报告和自动适配 100 个站点仍未实现。

## 代码证据索引

| 事实 | 来源 |
| --- | --- |
| 版本、浏览器目标、权限与生产 host | `package.json`、`wxt.config.ts` |
| 生产/开发 API 切换 | `src/background/services/api.ts` |
| 专用站点和范围 | `src/adapters/sites/*` |
| 账号会话和存储 | `src/settings/account-session.ts`、`src/storage/browser-storage/account.ts` |
| 登录、刷新与权限 | `src/background/services/account.ts`、`account-auth.ts` |
| 服务端索引传输内容 | `src/background/services/server-indexes.ts`、`src/storage/portable-data.ts` |
| 管理页 host/scope 组织 | `entrypoints/options/app/site-groups.ts`、`SiteDetailPage.tsx` |
