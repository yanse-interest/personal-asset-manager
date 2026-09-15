# 久用

个人使用的手机优先 H5 / PWA。界面提供五种配色与浅色、深色、跟随系统模式；新增和编辑好物可从 100 个本地立体图标、120 个 Emoji、100 个线性图标中选择。线性图标包含手机、平板、扫地机器人、净饮水机、跑步机等常见家电与数码产品。浏览器主题栏随配色变化，安装为独立应用后无浏览器地址栏。V3 数据库升级为旧好物补齐自动图标，备份升级为 v3 且仍可导入 v1/v2。2026-09-15 统一验收 `npm run verify` 已通过：生产构建、57 个单测、usage/backup/pwa/reliability 四组 Chrome E2E；涵盖跨标签更新、离线恢复及异常写入保护。本轮仍未单独在手机验收。此前小米 15 Pro Android Chrome 的同源升级、旧数据保留、类别/状态操作、网址模式离线冷启动与写入、v1/v2 文件在隔离地址恢复均已于 2026-09-14 通过。主屏幕应用图标随后成功出现；用户确认从图标以无地址栏独立窗口启动，原资产、次数和流水与浏览器态一致，断网彻底关闭后仍能从图标冷启动读取同一数据。旧标签阻塞升级及安装态离线写入仍未单独验收。

可靠性与架构审查见 [REVIEW_2026-09-15.md](REVIEW_2026-09-15.md)，包含已修复问题、测试范围及剩余验收边界。 依赖漏洞修复后，Vitest 4.1.11 / Node 24 的完整验收再次通过；2026-09-15 官方 npm 全量审计为 0 项已知漏洞。

## 开发

需要 Node.js 22.12+（22.x）或 24+，建议 Node 24 LTS；`.nvmrc` 已指定 24。Vitest 已升级为修复安全问题的 4.1.11，不再支持原来的 Node 23。此次依赖安装使用临时 npm 12.0.2，未改动全局 Node/npm。

```sh
npm ci
npm run dev
npm run typecheck
npm test
npm run test:e2e:usage
npm run test:e2e:backup
npm run test:e2e:pwa
npm run test:e2e:reliability
npm run build
# 发布前统一验收（需要 Google Chrome，可用 CHROME_PATH 指定）
npm run verify
```

`npm run dev` 只供本机开发，不用于离线/安装验收。`npm run build` 生成 `dist/` 静态文件、manifest 和 Service Worker。生产构建不调用业务服务器，所有资产和流水只保存在当前浏览器的 IndexedDB。

## 给朋友使用

项目通过 `.github/workflows/deploy-pages.yml` 自动发布到 GitHub Pages。首次发布时，在 GitHub 仓库的 **Settings → Pages → Build and deployment → Source** 中选择 **GitHub Actions**，然后把 `main` 分支推送到 GitHub；以后每次推送 `main` 都会自动构建和更新。

默认访问地址为 `https://yanse-interest.github.io/personal-asset-manager/`。朋友第一次使用时，用手机浏览器打开该地址，等待“应用资源已缓存，可离线打开”，再安装到主屏幕：

- Android Chrome：浏览器菜单 → “安装应用”或“添加到主屏幕”。
- iPhone Safari：分享按钮 → “添加到主屏幕”。

每台设备的数据只保存在该设备、该浏览器和该网址对应的 IndexedDB 中，用户之间不会共享数据。换手机、换浏览器、清除网站数据或卸载前，应先在“设置与数据”导出 JSON 备份。若要把现有资产交给另一位用户，可由原设备导出 JSON，再由对方设备导入。后续版本应始终发布到同一网址，以便原地更新并保留现有数据。

应用标志采用暖陶橙色的连续丝带造型，表达物品被长久使用与珍惜。网页页签和页头使用 `public/icon.svg`；主屏幕图标使用 `public/jiuyong-192.png`、`public/jiuyong-512.png`、`public/jiuyong-maskable-512.png` 与 `public/jiuyong-apple-touch-icon.png`。以后更换标志时同时替换这些文件，必要时更换文件名并同步 `vite.config.ts`、`index.html`，以减少已安装图标继续使用旧缓存的情况。

## Android Chrome 临时局域网安装

用户已允许仅在首次安装和更新时开启局域网 HTTPS 静态服务。电脑与手机连同一个局域网，保持电脑的局域网 IPv4、端口、协议不变；这些共同构成数据所属的 origin。先在电脑执行：

```sh
npm run build
sh scripts/generate-lan-cert.sh <电脑局域网IPv4>
node scripts/serve-lan-https.mjs <电脑局域网IPv4> 8443 <输出目录>/server.crt <输出目录>/server.key
```

第二条命令会输出证书目录。只把该目录中的 `ca.crt` 传到手机，并按手机系统的“安装 CA 证书”步骤信任；私钥和 `server.key` 仅留在电脑。2026-09-14 本次临时服务还提供公开证书文件 `https://192.168.31.210:8443/asset-pwa-test-ca.crt`；它是一次性的构建目录文件，重建后会消失，不应作为固定安装地址。安装后完全关闭并重开 Chrome，必须确认 HTTPS 页面不再出现隐私警告。证书为 30 天临时测试用途。用 Android Chrome 打开 `https://<电脑局域网IPv4>:8443/`，确认地址栏没有证书警告，在“设置与数据”看到“应用资源已缓存，可离线打开”，再用页面的安装按钮或 Chrome 菜单“安装应用/添加到主屏幕”。如果只是忽略证书警告进入页面，不能算可信安全源，Service Worker 可能无法工作。停止静态服务后，已缓存的应用可以离线打开；获取更新时仍需在同一地址重新启动服务。IP/端口/协议变动会产生新的数据空间，先从旧地址导出 JSON，再到新地址导入。

如果 Android Chrome 提示网页无法正常运作，先记下错误页底部的 `ERR_...` 或 `HTTP ERROR ...` 代码。若是证书/隐私警告，确认手机安装的是本次生成的 `ca.crt`，证书类型为 CA，且 Chrome 重新启动后地址没有警告；仅点击“继续访问”不等同于安装并信任 CA；小米 15 Pro 的首次真机测试就出现页面可打开、但离线缓存注册失败。若显示 `ERR_EMPTY_RESPONSE`，先检查是否把 `http://` 发到了 HTTPS 的 8443 端口；必须在地址栏输入完整的 `https://<电脑局域网IPv4>:8443/`。电脑 Chrome 对 `http://192.168.31.210:8443/` 已复现同一错误。若是连接超时，确认电脑与手机在可互访的同一局域网、电脑 IP 仍是该地址，且临时服务还在运行。电脑本机可用 `http://127.0.0.1:4173/` 查看网页，但这个地址只用于电脑预览，不是手机安装入口。不要清除手机 Chrome 网站数据来排查，以免丢失 IndexedDB 资产。

网址模式已在小米 15 Pro Android Chrome 真机验证：证书受信任、可离线打开、关闭 Wi‑Fi/移动数据并重启 Chrome 后仍可打开同一网址、离线创建资产与 +1 后数据保留、系统文件中可找到 JSON 并从该文件恢复。首次主屏幕安装曾长期显示“正在安装”且未出现图标；2026-09-14 用户随后确认图标成功出现，并从图标以无地址栏独立窗口启动，原资产/次数/流水与浏览器态一致，断网彻底关闭后仍可从图标冷启动读取同一数据。安装态离线写入及手机端后续版本更新未单独验证。设备为 HyperOS `3.0.308.0.WOBCNXM.C11`、Chrome `152.0.7977.82`，独立 Android 版本号未记录。测试完可关闭临时服务并移除测试 CA；如果以后仍用同一 HTTPS origin 更新，需保留或重新信任相应证书。

## 数据与设计依据

当前仓库没有独立 PRD；需求基线为本任务中的用户说明。V2 增量以 [V2_CHANGE_SPEC.md](V2_CHANGE_SPEC.md) 为准，未变的 V1 规则见 [TECH_SPEC.md](TECH_SPEC.md)、[DATA_MODEL.md](DATA_MODEL.md)、[UI_STRUCTURE.md](UI_STRUCTURE.md)、[IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)、[ACCEPTANCE_CRITERIA.md](ACCEPTANCE_CRITERIA.md)。业务数据保存在当前浏览器 origin 的 IndexedDB `large-asset-cost`。V2 升级会原子补齐旧资产的默认状态字段；V3 再补齐 `iconId: null`，保留原资产与流水。设置页导出 schemaVersion 3 JSON（四表）；“导入 JSON”可导入 v1、v2 或 v3 备份，先完整校验、预览，再单事务覆盖四表；空库备份会清空现有数据。“增量导入 JSON”只接受 `large-asset-cost-increment` v1 文件，按同名类别归类，在单事务中追加好物与流水；发现已有同 ID 或同名称、购买日期、购买价的好物时整批拒绝。**手机更新前，请先从旧版导出 JSON，并确认文件可在系统文件中找到**；更换浏览器或地址前也要先备份。

2026-09-14 真机验收使用原地址 `https://192.168.31.210:8443/`，已先确认旧版备份、再同源更新；隔离的 `:8444` 地址仅用于测试 v1/v2 文件恢复，测试服务已关闭，主站数据未被其覆盖。两件临时测试资产已从主站删除，用户确认原资产、次数和流水仍在；清理后备份文件为 `asset-cost-backup-20260914-194311.json`。备份文件在手机端，仓库不保存个人业务数据。主站 8443 临时服务目前保持运行；以后改变地址、端口或浏览器前仍须先备份。
