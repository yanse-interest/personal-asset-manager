# 技术方案：大件资产成本管理 H5 / PWA

> 本文是现行 V1 技术基线。用户 2026-09-14 提出的状态账本与自定义类别属于待实施 V2；变更范围、迁移、阶段与验收以 [V2_CHANGE_SPEC.md](V2_CHANGE_SPEC.md) 为准，未列变更仍沿用本文。

设计基线：2026-09-13。状态：Phase 1–6 功能已实施；Phase 7 PWA 代码与桌面自动化已完成，小米 15 Pro Android Chrome 网址模式的离线冷启动、离线写入/+1、JSON 文件导出/导入已通过；主屏幕安装暂缓，Phase 8 未开始。

## 1. 事实来源与范围

设计开始时检查原始项目目录，目录完全为空（包括隐藏文件）；没有独立 PRD、README、AGENTS.md、package.json、代码、依赖或数据库。常见父级 AGENTS.md 路径也未发现文件。本方案以用户在本任务中提供的完整需求作为 PRD 基线，不能声称覆盖尚未提供的独立 PRD。

共享 Memory 的项目索引存在另一路径下的同名 Hermes/飞书历史项目；它不是当前仓库，不继承其批次、库存、NAS、飞书依赖或数据模型。本项目从零设计，用户本次需求优先。

MVP：个人使用、手机优先、人民币、约 ¥1000 以上资产、本体购买价、两种投入、可选收益、按天/按次观察、手动累计使用次数、可选到期日、IndexedDB、JSON 备份、离线 PWA。¥1000 是使用建议，不是禁止录入小额资产的校验条件。

不做账号、业务服务器、云同步、多设备合并、NAS、库存/批次、耗材实体、细分类别、折旧、图表平台、自动扣费、推送或使用事件日志。

## 2. 技术选型

| 用途 | 决定 | 理由 |
| --- | --- | --- |
| 构建/UI | Vite + React + TypeScript，strict | 用户推荐栈，静态产物，类型边界清晰 |
| 路由 | React Router 的 createHashRouter + RouterProvider | 支持返回、深链接；静态交付不需要服务器路径重写 |
| 数据 | Dexie + dexie-react-hooks | 三表、事务、响应式 IndexedDB 查询 |
| 状态 | useState / 页面内 hooks | 表单和临时状态留在页面；数据库是唯一持久事实源 |
| 样式 | 普通 CSS + 少量共享 CSS 变量 | 不引入 UI 框架或 CSS 工具链 |
| PWA | vite-plugin-pwa，generateSW，prompt 更新 | 不手写通用 Service Worker 框架 |
| 验证 | 自有小型纯函数，复用表单与导入校验 | 三种固定实体，不引入表单/Schema 框架 |
| 测试 | Vitest + fake-indexeddb；Playwright | 计算/事务单测，浏览器关键链路；移动安装另做真机验收 |

依赖版本以 package.json 和 package-lock.json 为准；Phase 7 使用 vite-plugin-pwa 1.3.0 与 workbox-window 7.4.1。仅安装本表所需直接依赖，不加 Redux、Zustand、Axios、日期库、金额库或 Repository/Service 类层级。

## 3. 模块与数据流

模块清单（本阶段对应文件已经实现）：

```text
src/
  main.tsx
  app/App.tsx, routes.tsx
  domain/types.ts, validation.ts, money.ts, dates.ts, calculations.ts
  data/db.ts, assets.ts, records.ts, backup.ts
  hooks/useToday.ts
  pages/DashboardPage.tsx, AssetFormPage.tsx, AssetDetailPage.tsx
  pages/RecordFormPage.tsx, SettingsPage.tsx
  components/AssetCard.tsx, ConfirmDialog.tsx, ErrorMessage.tsx, AppShell.tsx
  pwa/register.tsx, UpdatePrompt.tsx
  styles.css
```

页面 → `data/*.ts` 普通函数 → Dexie。数据函数调用共享 domain 校验；页面不得自行绕过校验写表。查询用 `useLiveQuery` 订阅数据函数，修改成功由数据库驱动刷新，不另建持久化副本或手工维护 totals。domain 纯函数不依赖 React、Dexie 或当前系统时钟；`today` 显式传入。

首页在一个只读事务中读三表，按 assetId 一次分组聚合，避免每张卡片发起查询。详情在同一只读事务读取本体和两类流水。个人数据量无需分页索引、缓存层或后台计算。首次查询分别呈现加载、空数据、错误；不可把未加载误认为空库。

## 4. 路由和状态

实际地址是 `/#/…`，完整路由见 UI_STRUCTURE.md。使用 createHashRouter + RouterProvider，不配置 loader/action；通过 useBlocker 处理应用内离开和浏览器后退确认，beforeunload 仅处理文档离开。不得改用无法直接支持该阻断 API 的声明式 HashRouter。[React Router 官方 useBlocker 文档](https://reactrouter.com/api/hooks/useBlocker)

资产/流水不存在显示友好的未找到页面及返回入口，不创建空实体。编辑页面只在首次载入时初始化草稿，不用订阅结果不断覆盖用户输入；保存时检测旧快照冲突。

输入、筛选、确认框、保存状态用局部 React state。首页默认购买日期倒序、ID 作稳定次序；不做持久筛选设置。跨页未保存表单离开需确认，浏览器关闭仅使用可用的 beforeunload 提示，不能保证系统强杀可恢复草稿。

## 5. 数据库与并发

数据库固定名称 `large-asset-cost`，Dexie schema version 从 1 起。三表及索引：`assets: 'id'`，`costRecords: 'id, assetId'`，`revenueRecords: 'id, assetId'`。V1 精确字段见 DATA_MODEL.md；V2 增量模型与迁移见 V2_CHANGE_SPEC.md。

- 主键使用 `crypto.randomUUID()`；安全源是运行基线。
- 新建/修改流水在写事务中确认父资产存在，检查日期关系；新增时在覆盖三表的事务中检查总记录数上限。
- 删除资产用覆盖三表的单个读写事务，先删关联记录再删本体；失败整体回滚。删除流水仅删除该条，重新计算。
- 编辑/删除读取事务内最新实体，与打开表单/确认框时的完整实体快照逐字段比较；变化则拒绝并提示重新载入、保留草稿供重填。不能依赖时间戳唯一性。不同字段也允许保守冲突，不做自动合并。
- 编辑资产只提交可编辑字段 patch，绝不以旧表单整个对象覆盖库中 `usageCount`。次数更正在独立小表单中提交，比较原次数后才设置新值。
- `+1` 在 assets 读写事务内重新读取当前次数再写入，校验当前仍为按次资产。两个标签的合法点击分别累计，不能在 React 中先读旧次数再覆盖。提交中禁用当前按钮；成功后才显示新值；失败不显示成功、不自动重试。
- 所有写操作 Promise 在事务提交后才 resolve；异常在事务外 catch，不吞掉导致部分提交。事务里不进行文件读取、下载、确认框或网络请求。Dexie 提供的事务边界用于原子操作。[Dexie 官方事务文档](https://dexie.org/docs/Dexie/Dexie.transaction())
- versionchange 时关闭旧连接并提示刷新；blocked 时提示关闭其他标签，禁止删库“修复”。后续数据库升级使用显式迁移与迁移测试，升级失败保留旧库。

## 6. 日期、金额、错误

金额整数分、日期字符串、公式和所有边界只在 DATA_MODEL.md 定义。输入金额按十进制字符拆分，禁止 `parseFloat(text) * 100`。成本比率保留未舍入的分子/分母，展示时才舍入。

`useToday` 按设备本地日历生成 today；午夜、visibilitychange、focus 时刷新，使长期打开/后台恢复后自动更新按天成本与到期状态。不用 24 小时毫秒差模拟自然日。

表单错误就地显示在字段下方并聚焦首个错误，保留输入。保存/删除/导入失败显示可读原因与重试入口；数据库打不开时提供重试和环境说明，禁止静默退回临时内存库。配额不足提示导出已有数据、释放设备空间后重试。React Error Boundary 处理渲染错误，异步错误由调用方处理；日志不打印备份正文或备注。

## 7. JSON 导入导出

格式与验证清单见 DATA_MODEL.md。只支持全量导出、全量替换导入，不实现合并或 CSV。

导出：单个只读事务取得一致三表快照 → 每表按 ID 排序 → JSON/Blob → 下载 `asset-cost-backup-YYYYMMDD-HHmmss.json` → 释放 URL。文件失败可重试，不能把“已触发下载”当作已持久备份；提示用户确认文件可找到。JSON 明文、不包含应用缓存，妥善保管。

导入：选择本地文件 → 大小检查 → 读取/解析/完整校验（无写库）→ 显示三表条数及“覆盖全部现有数据”→ 提供先导出现有数据入口 → 二次确认替换 → 单个覆盖三表的读写事务 clear + bulkAdd → 成功后清空页面草稿并返回首页。任意异常整体回滚。取消、非法文件、未知版本均不得修改旧数据。

替换语义以事务开始时数据库为准：确认前其他标签新增的数据也会被替换，确认文案明示并建议关闭其他标签；不承诺多标签编辑合并。导入事务与其他写事务串行；导入后旧编辑快照校验失败，旧父 ID 不存在的写入被拒绝。导入过程中本标签阻止重复提交与离开。导出动作不嵌套进导入写事务。

## 8. PWA 与交付的物理限制

缓存应用壳、打包后的 JS/CSS/图标和离线入口；无 CDN、外部字体或业务网络请求。manifest 使用相对当前应用目录的 id/start_url/scope，display standalone，提供 192/512 图标和 maskable 图标；构建 base 与安装目录保持一致。哈希路由不会产生新的服务器路径。

`generateSW` 预缓存构建资源；注册成功且缓存就绪后提示可离线使用。新版本提示用户刷新，编辑中不主动 reload；提醒先保存并关闭其他编辑标签。不在 Service Worker 中读写业务数据库、不随清缓存删 IndexedDB。更新构建使用同一 origin 和安装目录；数据库版本升级必须测试旧数据保留。[Vite PWA 官方策略说明](https://vite-pwa-org.netlify.app/guide/service-worker-strategies-and-behaviors)

**硬约束：首次访问、安装和获得新版本必须能从安全源下载静态资源。** Service Worker 需要 HTTPS；localhost 是本机开发例外。手机访问电脑的普通 `http://局域网IP` 不等于手机 localhost，直接打开 file:// 构建文件也不是可用 PWA 交付方案。[MDN Service Worker 说明](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers)

本方案保证业务无服务器、安装并缓存后离线运行；不擅自将“无服务器/无公网”改成公网托管。桌面开发可用 localhost。用户已允许在首次安装和更新时临时启用仅局域网可达的 HTTPS 静态服务，目标浏览器为 Android Chrome。使用 scripts/generate-lan-cert.sh 生成含局域网 IP SAN 的临时证书，手机信任测试 CA；scripts/serve-lan-https.mjs 只从 dist 提供静态文件。安装后可关闭服务离线运行；更新时重新以相同 HTTPS origin 启动。小米 15 Pro 的网址模式冷启动与数据保留已获真机验证；手机联网时 Chrome 显示“正在安装”却没有生成主屏幕图标或系统应用，用户决定先用网址，安装态仍待验收。

IndexedDB 是同源浏览器存储，不是永不丢失的备份。设置页可在用户点击后调用 `navigator.storage.persist()`，显示 granted/denied/unsupported，不承诺申请成功；浏览器清站点数据、系统存储回收、卸载行为可能导致丢失。更换域名/端口/协议或浏览器会形成不同数据空间，需要 JSON 手动迁移。安装态与浏览器态是否共享数据以目标真机测试为准。[MDN 存储配额与回收说明](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)

## 9. 扩展边界与自检

已有合理扩展点只有：纯计算函数、版本化 JSON、Dexie 显式迁移、按 assetId 关联的独立流水。新增展示指标无需改库；V2 生命周期结束已另见 V2_CHANGE_SPEC.md；未来真正需要使用明细或多币种时提交设计变更与迁移，不预建空字段/插件系统。

本次自检已修正：持久 totals 会造成重复事实源，故不存；耗材不建实体；到期只作观察不停止分母；+1/删除/导入必须事务化；编辑冲突不覆盖次数；数据库版本与备份版本分开；日均与次均不写回；手机首次交付不作虚假无条件承诺。无 Repository/Service 层、全局状态库、后端或业务实现文件。后续按 IMPLEMENTATION_PLAN.md 执行；模型变更需同时更新五份文档和迁移/验收说明，不能随意改字段。

仍需明确的外部项：独立 PRD 如日后提供需做差异审查；Android Chrome 主屏幕安装及安装态存储表现、手机 Android/Chrome 具体版本待记录。本体模型与公式不因这些交付项而重新设计。
