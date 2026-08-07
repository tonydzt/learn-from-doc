# 0.3.0 发布检查清单

## 已由仓库验证

- [x] 单元测试通过（68 个测试文件、304 个测试）
- [x] Chrome 与 Firefox 生产构建通过
- [x] Chrome、Firefox 和 Firefox source archive 已生成
- [x] 两个生产 manifest 的版本均为 `0.3.0`
- [x] 生产包 API 指向 `https://learn-from-doc-web.vercel.app`
- [x] 生产 manifest 不包含 localhost 权限和开发快捷键

## 上线前人工确认

- [ ] 线上 API 的登录、刷新令牌、权限、索引查询、拉取和上传接口已部署
- [ ] Chrome 中用正式账号完成登录、拉取、覆盖确认、上传和退出冒烟测试
- [ ] Firefox 中完成同一组冒烟测试
- [ ] Chrome Web Store 隐私披露与 `PRIVACY_DISCLOSURE_0.3.0.md` 一致
- [ ] Firefox Add-ons 数据收集声明与实际服务端功能一致
- [ ] 接受 Firefox 0.3.0 最低版本提升到 140，以及安装时 required 数据披露的产品取舍
- [ ] 官网隐私政策已覆盖账号数据、令牌和用户主动上传的阅读进度
- [ ] 商店截图和支持链接已更新
- [ ] 创建并推送 `v0.3.0` tag（仅在最终产物确认后）

## 发布文件

```text
output/developer-docs-progress-tracker-0.3.0-chrome.zip
output/developer-docs-progress-tracker-0.3.0-firefox.zip
output/developer-docs-progress-tracker-0.3.0-sources.zip
```
