# 0.3.0 隐私与商店审核披露要点

本文档用于准备 Chrome Web Store、Firefox Add-ons 和官网隐私政策，不替代最终法律文本。

## 默认本地处理

- 站点索引、页面记录、阅读进度、站点设置和索引断点保存在扩展 IndexedDB。
- 全局设置、框架检测缓存、账号会话和服务端索引可用性缓存保存在扩展本地 storage。
- 扩展读取页面 URL、标题、正文高度、可见阅读区间和滚动位置，用于建立索引、计算进度和恢复阅读位置。
- 扩展不把页面正文内容作为索引数据上传。

## 可选账号功能

- 用户在账号页主动登录时，邮箱和密码会通过 HTTPS 发送到 `https://learn-from-doc-web.vercel.app/api/auth/login`。
- 登录成功后，访问令牌、可选刷新令牌、用户标识、邮箱、显示名称、权限和过期时间保存在扩展本地 storage。
- 令牌接近过期时，扩展可使用刷新令牌请求新令牌。
- 用户可主动刷新账号权限或退出；退出会删除本地账号会话。

## 可选服务端索引功能

- 具有相应账号权限时，扩展可查询某个 site ID 是否存在服务端索引。
- 用户主动拉取服务端索引时，服务端索引会写入本地；本地已有索引时界面会要求确认覆盖。
- 用户主动上传索引时，会发送站点元数据、页面 URL 与标题、页面高度、站点设置和该站点阅读进度。
- 上传数据不包含网页正文、账号密码或其他站点的索引。

## Manifest 权限说明

| 权限 | 用途 |
| --- | --- |
| `activeTab` | 对用户当前页面执行检测或注入流程 |
| `tabs` | 查询当前标签页，并在索引时打开和关闭后台测量页 |
| `storage` | 保存设置、缓存和可选账号会话 |
| `scripting` | 在检测和索引流程中注入 content script |
| 内置站点 host permissions | 在六个专用适配站点运行核心功能 |
| `https://learn-from-doc-web.vercel.app/*` | 可选账号与服务端索引 API |
| 可选 `https://*/*`、`http://*/*` | 用户在其他检测成功的文档站点授权后启用功能 |

生产包不包含 `http://localhost:3000/*`，该权限仅用于开发构建。

## Firefox 内置数据同意

- Firefox 包最低版本为 `140.0`，使用该版本开始提供的内置数据同意界面。
- manifest 的 required 数据类别为 `authenticationInfo`、`personallyIdentifyingInfo`、`browsingActivity`、`websiteActivity` 和 `websiteContent`。
- 这些类别覆盖账号凭据与邮箱，以及用户主动上传索引时包含的 URL、页面标题和阅读活动数据。
- 0.3.0 未实现 Firefox 运行时 optional data permission 请求，因此不能把这些类别仅列为 optional 后直接传输。
