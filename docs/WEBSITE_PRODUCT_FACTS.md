# Developer Docs Progress Tracker 官网产品事实资料

## 文档用途

本文档用于将当前浏览器扩展项目的已实现产品信息移交给官网仓库。官网开发者可以基于这些事实组织页面内容、截图和兼容性说明，但不应将本文档扩展为未经确认的营销承诺、发布信息或隐私声明。

资料基于当前代码实现整理。`docs/SYSTEM_CONTEXT.md` 中关于“当前首版只支持 `react.dev`”的描述反映早期状态，已落后于当前代码；官网应以本文档以及文末证据索引列出的当前实现为准。

## 产品身份

| 项目 | 当前事实 |
| --- | --- |
| 产品名称 | `Developer Docs Progress Tracker` |
| 产品类型 | 浏览器扩展 |
| 技术实现 | TypeScript、React、WXT |
| 浏览器目标 | Chrome MV3、Firefox MV3 |
| 当前版本字段 | `0.1.0` |
| Manifest 描述 | `Save and restore reading progress on developer documentation and long technical pages.` |
| 核心用途 | 为受支持的开发者文档站点创建本地索引，并依据用户实际看见的正文区域记录阅读进度 |

## 用户可见能力

### 1. 创建本地文档索引

- 用户在受支持的文档页面打开扩展 popup 后，可以创建索引或重建已有索引。
- 创建索引时，扩展从当前文档侧边栏收集页面链接，并在后台逐页打开页面以测量正文高度。
- popup 在索引过程中显示收集链接、测量页面和保存索引的进度状态。
- 后台测量页面使用索引模式运行，不计入用户的阅读进度。

### 2. 记录阅读进度

- 阅读进度以正文进入视口的可见高度区间为依据，而不是以页面是否访问过为依据。
- 扩展合并用户已看过的正文区间，并计算当前页面进度及文档范围总进度。
- 用户滚动、页面尺寸变化、页面隐藏或离开页面时，扩展会采样或保存当前进度。
- 对 SPA 文档站点，扩展会在站内路由变化后继续为新页面启动跟踪。

### 3. 在文档页面展示进度

- 已索引且启用阅读进度的文档页面会在侧边栏顶部显示总进度卡片和进度条。
- 侧边栏中的已索引页面链接会显示单页进度徽章。
- 页面右侧可以显示细长的阅读地图，标识已读区间和当前视口所在位置。
- 阅读地图可在设置中关闭。

### 4. Popup 概览与操作

- popup 展示当前文档范围名称、索引状态、总进度和已索引页面数量。
- popup 提供创建索引和重建索引按钮。
- 对内置站点之外的 HTTPS 页面，popup 提供文档框架检测操作；检测到支持的框架后，可继续建立该站点索引。
- popup 可打开扩展管理页。

### 5. 管理页与设置

- 管理页展示已经创建索引的站点列表、各站点页面数量和总进度。
- 单站点详情包含概览、页面列表和进度记录视图。
- 管理页可清空单站点阅读进度、清空全部阅读进度或删除某个站点索引。
- 每个已索引站点有独立的 `Enable reading progress` 开关。
- 全局设置包含 `Show right-side reading map`、`Index timing debug logs` 和界面语言选择。

### 6. 导入与导出

- 管理页可导出全部站点或单个站点的便携数据文件。
- 用户可以选择导出内容是否包含阅读进度；默认界面状态不勾选 `Include reading progress`。
- 管理页支持导入兼容的便携数据文件，并在站点冲突时询问是否覆盖本地索引。
- 导出格式实现支持 `.lfd.json`，在运行环境支持压缩流时使用 `.lfd.json.gz`。

## 支持范围

### 内置支持站点

以下站点具有专用 adapter，并在 manifest 中具有默认 `host_permissions`：

| 站点 | 支持范围或展示名称 | 默认访问范围 |
| --- | --- | --- |
| React Docs | `Learn React`、`React Reference` 两个文档范围 | `https://react.dev/*` |
| Playwright Docs | `Playwright Docs`，`/docs` 路径范围 | `https://playwright.dev/docs*` |
| OpenAI Codex Docs | `OpenAI Codex Docs` | `https://developers.openai.com/*` |

### 可检测文档框架

对其他 HTTPS 文档站点，popup 可以检测以下文档框架。检测成功后，扩展会基于该站点的侧边栏和正文结构创建索引。

| 框架 | 代码中给出的典型测试站点 |
| --- | --- |
| Docusaurus | React Native Docs (`https://reactnative.dev/docs/getting-started`) |
| VitePress | Vite Docs (`https://vite.dev/guide/`) |
| Nextra | Nextra Docs (`https://nextra.site/docs`) |
| Fumadocs | shadcn/ui Docs (`https://ui.shadcn.com/docs`) |
| Starlight | Netlify Docs (`https://docs.netlify.com/`) |
| Material for MkDocs | Pydantic Docs (`https://docs.pydantic.dev/latest/`) |
| Retype | SillyTavern Docs (`https://docs.sillytavern.app/`) |

这些典型站点来自 adapter 源码注释，用于说明框架适配目标；它们不等同于完整、永久保证的网站兼容名单。

## 界面语言

扩展设置声明了 12 种可选界面语言，应用于扩展页面和注入文档页的阅读 UI：

| Code | Language |
| --- | --- |
| `en` | English |
| `zh-CN` | 简体中文 |
| `zh-TW` | 繁體中文 |
| `es` | Español |
| `fr` | Français |
| `de` | Deutsch |
| `ja` | 日本語 |
| `ko` | 한국어 |
| `pt` | Português |
| `ru` | Русский |
| `ar` | العربية |
| `hi` | हिन्दी |

说明：语言列表来自设置类型定义。官网可以表述为“提供 12 种可选界面语言”，但不应仅凭语言列表断言每种语言的全部文案翻译覆盖度相同。

## 数据存储与权限事实

### 本地数据

- 文档站点索引、页面记录、阅读进度和站点设置保存在扩展的本地 IndexedDB 数据库中。
- 全局应用设置通过浏览器扩展的本地 storage 读取和保存。
- 便携数据导出和导入由用户从管理页主动触发。
- Firefox manifest 配置中声明 `data_collection_permissions.required: ['none']`。

以上是实现和 manifest 可核实的事实。本文档不代替正式隐私政策，也不推断商店审核结论或未来版本行为。

### Manifest 权限

| 权限 | 配置事实 | 从当前流程可确认的使用场景 |
| --- | --- | --- |
| `activeTab` | 必需权限 | popup 针对用户当前激活页面执行检测或内容脚本注入流程 |
| `tabs` | 必需权限 | 查询当前 tab，并在建立索引时打开和关闭后台测量 tab |
| `storage` | 必需权限 | 保存和读取全局设置 |
| `scripting` | 必需权限 | 在检测或索引流程中向页面注入 content script |
| `https://react.dev/*` | 默认 host permission | 内置 React Docs 支持 |
| `https://playwright.dev/docs*` | 默认 host permission | 内置 Playwright Docs 支持 |
| `https://developers.openai.com/*` | 默认 host permission | 内置 OpenAI Codex Docs 支持 |
| `https://*/*`、`http://*/*` | 可选 host permission | 用户在其他检测成功的文档站点建立索引并启用功能时按 origin 请求授权 |

注：框架检测入口只针对 HTTPS 页面触发；manifest 同时声明了 HTTP 可选范围这一配置事实。

## 官网可用的界面素材输入

仓库当前未包含可以直接交付官网使用的 logo、品牌插画或产品截图文件。官网若需要真实产品素材，应从运行中的扩展界面拍摄或另外提供品牌资源。

### 建议拍摄的真实界面场景

| 场景 | 可展示的实现事实 |
| --- | --- |
| 已索引站点的 popup | 文档范围标题、`Indexed` 状态、环形总进度、页面数量、`Rebuild index` 操作 |
| 正在建立索引的 popup | 索引阶段文案、当前测量页数量进度、当前页面标题和进度条 |
| 支持框架的检测流程 | `Detect docs framework` 操作与检测后的框架名称 |
| 文档站侧边栏注入 UI | 顶部总进度卡片、每个页面链接后的百分比徽章 |
| 文档页面右侧阅读地图 | 已读区间和当前视口指示 |
| 管理页站点列表 | 已索引站点、页面数、总进度、导出站点操作 |
| 管理页站点详情 | 总进度、页面列表、阅读记录、站点级启用开关 |
| 管理页设置 | 阅读地图开关、索引调试日志开关、语言选择 |
| 管理页备份与导入 | 导出全部、导出站点、包含进度选项、导入文件入口 |

### 现有 UI 视觉事实

- popup 采用浅色背景、teal 色进度强调、深色主按钮和 amber 点缀。
- 页面内总进度卡片和页面徽章采用 teal 进度强调样式。
- 右侧阅读地图使用绿色区间标记和视口轮廓。

这些颜色和组件描述来自现有 CSS/注入样式，不构成官网品牌设计规范。

## 不得作为现有功能宣称的内容

以下项目在当前 `TODO.md` 中仍为未完成状态，不应写成官网的现有功能：

- 全文检索。
- 段落标签或笔记。
- 专注模式。
- 按阅读速度逐字显示内容的阅读模式。
- 选中文字后进行 AI 问答或解释。
- 文本划线或标注。
- 阅读记录日报、周报、年报等 Pro 功能。
- Chrome Web Store 精选徽章或已满足精选要求。

## 官网仓库仍需补充的信息

以下信息未在当前仓库代码或现有素材中确定，需要官网项目另行提供或确认：

- 最终面向用户的品牌名是否继续使用 `Developer Docs Progress Tracker`。
- 产品 logo、图标源文件、品牌字体和品牌视觉规范。
- 官网域名、Chrome Web Store 地址、Firefox Add-ons 地址或其他安装下载入口。
- 发布状态、版本发布说明和支持的发布渠道。
- 隐私政策正文、服务条款、支持邮箱或反馈渠道。
- 定价、免费/付费策略、许可证或开源声明。
- 官网页面结构、营销表述、CTA 文案和 SEO 内容。

## 关键事实证据索引

| 事实类别 | 主要来源 |
| --- | --- |
| 产品名称、描述、版本、Chrome/Firefox 目标、权限、默认/可选访问范围、Firefox 数据收集声明 | `wxt.config.ts` |
| 专用支持站点清单 | `src/adapters/sites/index.ts` 及同目录 adapters |
| 可检测框架清单和适配目标 | `src/adapters/frameworks/index.ts`、`src/popup/framework-probe.ts` 及框架 adapters |
| 创建索引、后台逐页测量和索引过程进度 | `src/background/services/indexing.ts`、`entrypoints/popup/main.tsx` |
| 页面进度卡片、页面徽章和右侧阅读地图 | `src/content/progress-ui.ts`、`src/content/reading-tracker.ts` |
| 全局设置与 12 种语言代码 | `src/settings/app-settings.ts`、`src/i18n/messages.ts` |
| 站点级阅读进度开关 | `src/settings/site-settings.ts`、`entrypoints/options/app/site-detail/SiteOverviewTab.tsx` |
| 管理页、清理操作、导入导出入口 | `entrypoints/options/app/OptionsApp.tsx`、`entrypoints/options/app/pages/SitesPage.tsx` |
| 便携数据结构与导出文件格式 | `src/storage/portable-data.ts`、`src/background/services/portable-data.ts` |
| 已实现和未实现功能状态 | `TODO.md` |
| 当前 UI 样式线索 | `entrypoints/popup/style.css`、`entrypoints/options/style.css`、`src/content/progress-ui.ts` |
