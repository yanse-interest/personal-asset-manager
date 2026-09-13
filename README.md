# 大件资产成本管理

个人使用的手机优先 H5 / PWA。Phase 1–6 功能已实现；Phase 7 已加入 PWA 安装、离线缓存和手动更新，并通过桌面生产构建自动化。小米 15 Pro 的 Android Chrome 已通过网址模式离线重开、离线资产写入/+1、JSON 文件导出和重新导入；手机联网时 Chrome 显示“正在安装”，但未在主屏幕或应用列表出现；用户决定先用网址，因此安装验收暂缓。Phase 8 综合验收未开始。

## 开发

需要 Node.js `>=22.12`，建议使用受支持的 Node 22 LTS 或更新的 LTS 版本。当前锁文件由 Node 23.7.0 生成，依赖组合通过本项目验证。

```sh
npm ci
npm run dev
npm run typecheck
npm test
npm run test:e2e:usage
npm run test:e2e:backup
npm run test:e2e:pwa
npm run build
```

`npm run dev` 只供本机开发，不用于离线/安装验收。`npm run build` 生成 `dist/` 静态文件、manifest 和 Service Worker。生产构建不调用业务服务器，所有资产和流水只保存在当前浏览器的 IndexedDB。

## Android Chrome 临时局域网安装

用户已允许仅在首次安装和更新时开启局域网 HTTPS 静态服务。电脑与手机连同一个局域网，保持电脑的局域网 IPv4、端口、协议不变；这些共同构成数据所属的 origin。先在电脑执行：

```sh
npm run build
sh scripts/generate-lan-cert.sh <电脑局域网IPv4>
node scripts/serve-lan-https.mjs <电脑局域网IPv4> 8443 <输出目录>/server.crt <输出目录>/server.key
```

第二条命令会输出证书目录。只把该目录中的 `ca.crt` 传到手机，并按手机系统的“安装 CA 证书”步骤信任；私钥和 `server.key` 仅留在电脑。2026-09-14 本次临时服务还提供公开证书文件 `https://192.168.31.210:8443/asset-pwa-test-ca.crt`；它是一次性的构建目录文件，重建后会消失，不应作为固定安装地址。安装后完全关闭并重开 Chrome，必须确认 HTTPS 页面不再出现隐私警告。证书为 30 天临时测试用途。用 Android Chrome 打开 `https://<电脑局域网IPv4>:8443/`，确认地址栏没有证书警告，在“设置与数据”看到“应用资源已缓存，可离线打开”，再用页面的安装按钮或 Chrome 菜单“安装应用/添加到主屏幕”。如果只是忽略证书警告进入页面，不能算可信安全源，Service Worker 可能无法工作。停止静态服务后，已缓存的应用可以离线打开；获取更新时仍需在同一地址重新启动服务。IP/端口/协议变动会产生新的数据空间，先从旧地址导出 JSON，再到新地址导入。

如果 Android Chrome 提示网页无法正常运作，先记下错误页底部的 `ERR_...` 或 `HTTP ERROR ...` 代码。若是证书/隐私警告，确认手机安装的是本次生成的 `ca.crt`，证书类型为 CA，且 Chrome 重新启动后地址没有警告；仅点击“继续访问”不等同于安装并信任 CA；小米 15 Pro 的首次真机测试就出现页面可打开、但离线缓存注册失败。若显示 `ERR_EMPTY_RESPONSE`，先检查是否把 `http://` 发到了 HTTPS 的 8443 端口；必须在地址栏输入完整的 `https://<电脑局域网IPv4>:8443/`。电脑 Chrome 对 `http://192.168.31.210:8443/` 已复现同一错误。若是连接超时，确认电脑与手机在可互访的同一局域网、电脑 IP 仍是该地址，且临时服务还在运行。电脑本机可用 `http://127.0.0.1:4173/` 查看网页，但这个地址只用于电脑预览，不是手机安装入口。不要清除手机 Chrome 网站数据来排查，以免丢失 IndexedDB 资产。

网址模式已在小米 15 Pro Android Chrome 真机验证：证书受信任、可离线打开、关闭 Wi‑Fi/移动数据并重启 Chrome 后仍可打开同一网址、离线创建资产与 +1 后数据保留、系统文件中可找到 JSON 并从该文件恢复。主屏幕安装在小米 15 Pro 上一直显示“正在安装”且没有生成图标；当前请直接使用相同完整 HTTPS 网址，无需反复点击安装。若以后继续排查，再检查 Chrome/系统安装状态及安装态冷启动和存储表现；这部分尚未通过。手机 Android/Chrome 具体版本待记录。测试完可关闭临时服务并移除测试 CA；如果以后仍用同一 HTTPS origin 更新，需保留或重新信任相应证书。

## 数据与设计依据

当前仓库没有独立 PRD；需求基线为本任务中的用户说明。V1 设计以 [TECH_SPEC.md](TECH_SPEC.md)、[DATA_MODEL.md](DATA_MODEL.md)、[UI_STRUCTURE.md](UI_STRUCTURE.md)、[IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)、[ACCEPTANCE_CRITERIA.md](ACCEPTANCE_CRITERIA.md) 为准。业务数据保存在当前浏览器 origin 的 IndexedDB `large-asset-cost`。在“设置与数据”中可导出全部数据为 JSON；恢复时先选择文件、预览条数，再确认覆盖当前三表。导入不合并，空库备份会清空现有数据。请定期确认导出文件实际保存；更换浏览器或地址前先备份。
