# Implementation Plan

2026-09-13，设计交付。Phase 1–6 功能已实施，Phase 6 手机 JSON 文件保存与重新导入已在小米 15 Pro 验证；Phase 7 代码、桌面自动化和 Android Chrome 网址模式的离线关键链路已完成，主屏幕安装暂缓；Phase 8 未开始。以下阶段描述保留为执行契约。实施唯一模型依据 DATA_MODEL.md；方案依据 TECH_SPEC.md；页面依据 UI_STRUCTURE.md；验收编号依据 ACCEPTANCE_CRITERIA.md。

执行顺序固定 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8。各阶段完成条件达成才进入下一阶段；阶段涉及的文件是规划路径，不代表现存。若出现与契约冲突的需求，先更新设计与迁移说明，不能临时新建重复模型。

## Phase 1：项目骨架、数据库、类型与纯函数

**目标**：建立可运行但无完整业务 UI 的基础，先固定数据正确性。

**文件/模块**：`package.json`、`package-lock.json`、Vite/TS 配置、`index.html`、`src/main.tsx`、`src/app/{App,routes}.tsx`、`src/domain/{types,validation,money,dates,calculations}.ts`、`src/data/db.ts`、对应 `*.test.ts`、`README.md`。

**任务**：

1. 核对稳定依赖/Node 兼容性，创建 Vite React TS 项目；配置 strict、typecheck/test/build 脚本与锁文件。
2. 创建 createHashRouter + RouterProvider 路由壳、五类页面占位；不引入 API 请求或全局状态库。
3. 按 DATA_MODEL.md 一次定义三实体和 JSON envelope 类型；校验接收 unknown，持久化类型不包含 totals。
4. 实现金额字符串解析/格式化、日期真实性/日序号、到期状态、成本与安全求和；today 必须参数注入。
5. 定义固定名称 Dexie v1 三表/索引和打开/blocked/versionchange 错误行为；建立 fake-indexeddb 测试隔离，不做生产示例数据灌入。
6. README 写本地启动、测试、构建命令与数据来源/暂未交付的 PWA 约束。

**完成条件**：本地空壳运行、typecheck/build 通过、DB 可写读测试记录并在测试后清理，所有模型/金额/日期纯函数测试通过；没有任何服务器/账号模块。

**测试**：金额 0.01、1.005、非法字符串、安全整数边界；闰日/DST/当天=1/昨天=2；所有公式样例、负净投入、零次数、到期边界（AC-M、AC-D、AC-E）。

**依赖**：无；先完成设计文档。

## Phase 2：资产 CRUD

**目标**：完整创建、编辑、读取和删除资产。

**文件/模块**：`src/data/assets.ts`、`src/pages/AssetFormPage.tsx`、详情临时列表/入口、`src/components/{ConfirmDialog,ErrorMessage}.tsx`、`src/styles.css`、资产数据测试。

**任务**：

1. 实现 list/get/create/update/delete 普通数据函数，ID/时间戳生成、共享校验、新增时在三表事务内检查总条数上限（编辑不扫描全库）。
2. 创建/编辑表单与初始次数；普通编辑只 patch 可编辑资产字段并校验完整旧快照，不覆盖次数。
3. 为删除建立覆盖三表事务，即使此时流水 UI 未做；确认关联快照变化时拒绝并刷新确认内容。
4. 保存状态、离开确认、加载/不存在/写失败反馈；保留草稿。
5. 实现购买日期与到期/既有流水关系校验，可用测试 fixture 验证。

**完成条件**：刷新后资产存在；同名可创建；低于 ¥1000 可保存；编辑不变 ID；删除关联 fixture 全部原子删除，失败不丢数据。

**测试**：AC-A、AC-X、AC-DEL；模拟无效资产、过期编辑快照、事务中途失败、父不存在、购买日期冲突。用 fake-indexeddb 验证事务，用浏览器手工完成一轮创建/刷新/编辑/删除。

**依赖**：Phase 1。

## Phase 3：投入 / 耗材 / 收益 CRUD

**目标**：把所有原始金额事实写入固定模型。

**文件/模块**：`src/data/records.ts`、`src/pages/RecordFormPage.tsx`、详情临时流水入口、记录测试。

**任务**：

1. 实现成本与收益的 get/create/update/delete；写事务同时读父资产并检查日期，新增时在覆盖三表的事务内检查总条数上限。
2. 复用一个 UI 表单，创建可选三种类型；编辑成本可切两类，收益不可跨表转换。
3. 关联列表、编辑和删除确认；父子不匹配不显示编辑能力。
4. 用快照检测过期编辑/删除；事务提交后才反馈成功。

**完成条件**：三种记录均可 CRUD，刷新恢复，金额汇总符合公式；禁止孤儿和日期冲突；无耗材实体/子类别字段。

**测试**：AC-R、AC-M、AC-X、AC-DEL；收益超投入、切换成本类型、记录早于购买日/晚于今天、并发删除父资产、部分失败回滚。

**依赖**：Phase 1–2。

## Phase 4：首页与完整详情

**目标**：用一套计算函数展示可用成本看板。

**文件/模块**：`src/pages/{DashboardPage,AssetDetailPage}.tsx`、`src/components/{AssetCard,AppShell}.tsx`、`src/hooks/useToday.ts`、查询模块与页面样式。

**任务**：

1. 用 useLiveQuery 订阅三表事务快照；首页一次读表、分组计算，详情按父查询。
2. 展示首页合计、按购买日排序卡片、详情成本构成和按日期排序流水。
3. 实现 day/use 主指标差异、负净投入/零次数展示、到期状态。
4. 实现午夜/恢复前台日期刷新；today 注入计算，不在记录中存 daysOwned。
5. 完成加载、真正空状态、未找到、查询错误和所有路由跳转。

**完成条件**：任一 CRUD 后首页和详情自动反映最新数据；无需刷新；详情与卡片主指标一致，首页无错误“总均值”。

**测试**：AC-M、AC-D、AC-E、AC-UI；两资产不同模式聚合、跨日/后台恢复、空库/无流水/加载失败区分；固定时间做浏览器断言。

**依赖**：Phase 1–3。

## Phase 5：按次 +1 与次数更正

**目标**：完成轻量高频操作，并发下不丢次数。

**文件/模块**：`src/data/assets.ts`、AssetCard/AssetDetailPage 次数控件、数据并发测试与 `tests/e2e/usage.spec.ts`。

**任务**：

1. 实现原子 incrementUsage：事务内读取最新资产、确认 use 模式、校验次数上限再 +1；更新 updatedAt。
2. 首页/详情 +1 阻止卡片冒泡、提交中禁用、失败不乐观增值、成功反馈。
3. 实现独立更正次数表单，期望旧次数匹配才提交；不记录每次使用事件。
4. mode 切换保留次数，验证旧普通资产编辑不会覆盖 +1。

**完成条件**：按次零次 → 一次立即显示次均；两个标签各 +1 后增加 2；失败不变；更正可处理误触。

**测试**：AC-U 全部，特别是两个同源浏览器 page 的真实 IndexedDB 并发、+1 与编辑/删除/模式切换竞争，不能只用模拟库证明浏览器并发。

**依赖**：Phase 1–4；纯公式在 Phase 1 完成，此阶段不重新定义。

## Phase 6：JSON 导入导出

**目标**：得到可验证的本地备份恢复链路。

**文件/模块**：`src/data/backup.ts`、`src/pages/SettingsPage.tsx`、验证模块、`tests/fixtures/backups/`、`tests/e2e/backup.spec.ts`。

**任务**：

1. 单事务导出三表一致快照，生成固定 envelope、按 ID 排序的无缩进 JSON、下载和 URL 清理。
2. 实现 unknown 到 v1 的完整校验；限制文件/记录数；检查未知字段/版本、重复/孤儿、日期/金额/枚举和总额。
3. 完成预览 → 可先导出 → 覆盖确认 → 三表 clear/bulkAdd 原子替换；禁止合并。
4. 成功返回首页清草稿；失败/取消保留原库，显示字段路径或存储原因。
5. 设置页显示条数、备份说明、persist 申请结果；测试真实手机文件保存与重新选择。

**完成条件**：导出 → 修改库 → 导入恢复，三表字段/ID/时间戳精确一致；非法与事务失败时旧库逐字段不变。

**测试**：AC-B、AC-P；空备份、未知 schema、缺字段、乱码/损坏 JSON、重复 ID、孤儿、超量、长备注/转义字符极限往返、非法安全整数、导入时并发写；浏览器下载文件再上传而非只测内存对象。

**依赖**：Phase 1–5。

## Phase 7：PWA

**目标**：应用壳可安装和离线启动，更新不损坏数据。

**文件/模块**：`vite.config.ts`、`public/` 图标、`src/pwa/{register,UpdatePrompt}.tsx`（register 可用 `.ts`）、SettingsPage、README、`scripts/test-pwa-e2e.mjs`、`scripts/serve-lan-https.mjs`、`scripts/generate-lan-cert.sh`。

**任务**：

1. 先解决 TECH_SPEC.md 的手机安全源交付选择，确认是否允许临时局域网 HTTPS、稳定 origin 和证书信任；记录目标手机/浏览器。无授权不部署公网、不引入后端。
2. 配置 generateSW、prompt 更新、manifest/base/start_url/scope 和本地图标，打包所有资源，无 CDN。
3. 展示离线就绪/更新可用；用户同意后刷新，编辑中不自动重载；不清业务库。
4. 用 production build 在可信安全源首次载入并等待缓存，再断网重开首页和详情，完成 CRUD/+1/导入导出。
5. 准备 v1 → 下一构建的更新实验：旧数据、缓存切换、其他标签/未保存表单、DB blocked/versionchange；不为实验乱改生产模型。

**完成条件**：真实目标手机安装并离线冷启动通过，核心动作离线可用，更新后数据保留；只测 localhost 或只看到 manifest 不能宣布手机验收通过。

**测试**：AC-W 全部，桌面浏览器自动化和手机手工测试并记录版本/步骤；证书失败、非安全源、未缓存首次离线的真实提示。

**依赖**：Phase 1–6，以及手机首次交付方式明确（已获用户许可：临时局域网 HTTPS，Android Chrome）。桌面自动化及小米 15 Pro 网址模式离线/JSON 文件链路已通过；手机联网安装流程停在“正在安装”且未出现应用；用户决定先使用网址，故 Phase 7 的安装验收仍未完成。

## Phase 8：综合测试、手机适配与验收

**目标**：逐条核销验收，交付可维护的个人 MVP。

**文件/模块**：`tests/e2e/`、必要的现有模块修复、`src/styles.css`、README、`ACCEPTANCE_CRITERIA.md` 的执行记录。

**任务**：

1. 运行 typecheck、unit、build、完整关键 E2E；固定日期测试与真实设备跨日/恢复前台验证相结合。
2. 320/375/390/430 px 布局、长文本、键盘、安全区、可访问 label/焦点/触控区域验收；真机检查安装态和浏览器态的数据行为。
3. 断网/强制重开、禁止存储/配额不足、异常输入、级联删除、导入失败恢复和旧版本连接逐条验收。
4. README 写备份恢复、存储风险、安装更新步骤和范围限制；记录设备/浏览器/时间、通过/失败/受阻，不写未经运行的测试结论。
5. 对照五份设计文档查偏差；任何模型变化必须有理由、显式迁移和修订，禁止悄悄偏离。

**完成条件**：所有 MVP 验收通过；外部受阻项清晰标记则只可称部分交付，不能称完成。无账号/云/业务 API；无测试失败和已知数据损坏缺陷。

**测试**：ACCEPTANCE_CRITERIA.md 全部条目，尤其 CRUD → +1 → 备份 → 清空替换 → 恢复 → 离线重开的完整旅程。

**依赖**：Phase 1–7；独立 UI 复核可在等待 Phase 7 外部条件时先做。
