# Developer Docs Progress Tracker 0.3.0

## 主要更新

- 新增 MDN Web Docs、Docker Docs 和 GitHub Docs 专用适配。
- 扩大 React 文档支持范围，新增 React Community 和 React Blog。
- 扩大 Playwright 文档支持范围，覆盖 Node.js、Python、Java、.NET 的指南与 API，以及 Playwright MCP 文档。
- 管理页按 host 聚合多个文档范围，并可在同一站点下切换 scope。
- 新增可选的服务器账号登录、权限展示和登录状态管理。
- 对具有相应账号权限的用户，新增服务端索引可用性检查、拉取、评审索引拉取和本地索引上传。
- 上传服务端索引时包含该索引的页面、设置和阅读进度；该操作仅由用户主动触发。

## 兼容性

- Chrome：Manifest V3
- Firefox：Manifest V3
- Firefox 最低版本：140（使用浏览器内置数据同意声明）
- 本地导入导出格式的 schema 版本未变；0.2.0 的兼容备份可继续导入。

## 升级说明

- 现有本地索引和阅读进度会保留。
- React Reference 沿用已有 scope key；重建索引会覆盖旧版本的不完整索引。
- 账号和服务端索引功能是可选能力，不登录不影响本地索引与阅读进度功能。
