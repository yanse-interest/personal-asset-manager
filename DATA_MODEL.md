# 数据模型与计算契约

> 本文冻结已运行的 V1 数据/备份格式，供迁移和旧备份验证。目标 V2 新字段、Category、计算与兼容规则见 [V2_CHANGE_SPEC.md](V2_CHANGE_SPEC.md)；实施前不能把 V2 当成当前库。

版本：持久化模型 v1，JSON schemaVersion 1；2026-09-13。本文为 V1 已运行字段和计算的历史权威，现已有真实用户数据；V2 增量另见 V2_CHANGE_SPEC.md。来源与范围见 TECH_SPEC.md。

## 1. 公共规则

所有下列字段均必须存在；只有标注 nullable 的字段允许 null，不使用 undefined、省略字段或空串替代 null。金额只支持 CNY，`*Cents` 是整数分。ID 为小写标准 UUID v4 字符串，主键不可编辑，同表不得重复；外键只能指向 assets.id，不凭名称关联。同名资产允许。

业务日期 `LocalDate` 为真实公历 `YYYY-MM-DD`，年份 1900–9999（包括严格闰年检查，不接受日期自动进位）。当前日期按设备本地日历；不会随时区变化重写已存日期。审计时间 `Instant` 为 UTC ISO 字符串 `YYYY-MM-DDTHH:mm:ss.sssZ`，由当前时间产生；不用于持有天数或唯一性判断。系统时钟可能回拨，因此只检查审计时间格式和有效性，不强制 updatedAt >= createdAt。

文本按首尾 trim 后存储：name 1–100 字符，note null 或 1–2000 字符；空备注正规化为 null。UI 原样文本显示，不作为 HTML 渲染。字符长度按 Unicode code points 计数，表单与导入共用校验。

## 2. Asset

| 字段 | 类型 | nullable | 规则 |
| --- | --- | --- | --- |
| id | string UUID v4 | 否 | 主键；创建生成；编辑不变 |
| name | string | 否 | 名称，1–100 字符 |
| purchaseCostCents | number（整数） | 否 | 首次购买金额，0–99,999,999,999 分 |
| purchaseDate | LocalDate | 否 | <= today；默认 today |
| costMode | 'day' \| 'use' | 否 | 主要成本观察方式；默认 day |
| usageCount | number（整数） | 否 | 0–2,147,483,647；默认 0；day 模式保留但不作为主要指标 |
| expiryDate | LocalDate | 是 | 未设置为 null；如有必须 >= purchaseDate，可过去、今天、未来 |
| note | string | 是 | 备注 |
| createdAt | Instant | 否 | 创建时设置，编辑不改 |
| updatedAt | Instant | 否 | 每次修改本体或次数时更新 |

purchaseCostCents 只保存在 Asset，不额外生成购买 CostRecord。成本模式可切换，day → use 复用现有次数，use → day 保留次数；不用强制清零。新增按次资产可以录入已有累计次数，按天新增默认 0；后续次数更正通过详情独立入口，避免普通资产表单覆盖并发 +1。

## 3. CostRecord

| 字段 | 类型 | nullable | 规则 |
| --- | --- | --- | --- |
| id | string UUID v4 | 否 | 主键 |
| assetId | string UUID v4 | 否 | 外键 assets.id；创建确定，编辑不可转移资产 |
| kind | 'additional' \| 'consumable' | 否 | 后续本体投入 / 耗材投入；允许编辑切换 |
| amountCents | number（整数） | 否 | 1–99,999,999,999 分 |
| date | LocalDate | 否 | purchaseDate <= date <= today；默认 today |
| note | string | 是 | 备注 |
| createdAt | Instant | 否 | 创建时间 |
| updatedAt | Instant | 否 | 编辑时间 |

无维修/升级子分类、耗材库存、数量、单价或批次字段。

## 4. RevenueRecord

| 字段 | 类型 | nullable | 规则 |
| --- | --- | --- | --- |
| id | string UUID v4 | 否 | 主键 |
| assetId | string UUID v4 | 否 | 外键 assets.id；编辑不可转移 |
| amountCents | number（整数） | 否 | 1–99,999,999,999 分；不写负数抵扣 |
| date | LocalDate | 否 | purchaseDate <= date <= today；默认 today |
| note | string | 是 | 备注 |
| createdAt | Instant | 否 | 创建时间 |
| updatedAt | Instant | 否 | 编辑时间 |

收益可为零条，无启用收益的布尔开关。统一流水表单可选三种入口，但收入仍存 RevenueRecord；编辑不能跨成本/收益表转换（删错条后重建）。不持久化一个重复的通用 Transaction 模型。

## 5. 关系、写入和删除

Asset 1:N CostRecord，Asset 1:N RevenueRecord。IndexedDB 不自动提供外键或级联，data 模块在事务中维护。删除资产硬删除其全部关联流水，不设回收站或软删除；确认框显示名称、两表条数和不可撤销提示。流水硬删除只影响自身。

编辑 purchaseDate 时在三表事务内检查：不得晚于任何已有流水日期、不得晚于 expiryDate、不得晚于 today；冲突拒绝，指明最早流水日期或到期日，不静默改流水日期。有效修改立即按新日期重新计算 daysOwned；没有存储需要回填的累计字段。

编辑/删除的快照冲突与 +1 原子规则见 TECH_SPEC.md。流水变动不必修改 Asset.updatedAt，展示流水按各自 date 降序、createdAt 降序、ID 排序。

## 6. 金额与所有公式

每次写入和导入验证所有数值为有限、安全整数（不允许 NaN、Infinity、字符串数字、小数分）。单条金额上限与三表合计 5,000 条的限制，使全库投入与收益分别最多为 499,999,999,995,000 分，小于 Number.MAX_SAFE_INTEGER。新增只需在三表写事务中 count 检查总条数，修改和 +1 不扫描全库；导入校验全部实体和条数。纯求和函数仍校验安全整数以防非法调用，不以浮点元值累计。

```text
purchaseCost = purchaseCostCents
additionalCost = sum(CostRecord.amountCents where kind = additional)
consumableCost = sum(CostRecord.amountCents where kind = consumable)
revenue = sum(RevenueRecord.amountCents)
totalCost = purchaseCost + additionalCost + consumableCost
netCost = totalCost - revenue

daysOwned = max(1, calendarOrdinal(today) - calendarOrdinal(purchaseDate) + 1)
costPerDay = netCost / daysOwned
costPerUse = usageCount > 0 ? netCost / usageCount : null
```

上述计算金额单位均为分；显示时再换算为元。`calendarOrdinal` 将合法年月日映射为 UTC 日序号，只用于自然日差，不把本地午夜的毫秒相减；避免夏令时 23/25 小时影响。当天购买 daysOwned=1，昨天=2。正常录入/导入拒绝未来购买日期；系统时钟回拨导致已存购买日期晚于 today 时显示时钟提示，daysOwned 暂取 1，不修改数据。

比率保留 `(netCostCents, denominator)`，展示可用 BigInt 整数除法实现“绝对值四舍五入到分，恢复符号”，再格式化人民币两位小数；不存 BigInt 到 JSON。普通金额同样显示两位小数；-0 统一显示 0。不把已舍入比率相加或写库；首页只合计投入/收益/净投入，不提供把不同分母日均/次均相加的误导总均值。

金额输入接受去首尾空格后的 `0` 或无前导零的正整数，可带 1–2 位小数；例 `1000`、`1000.5`、`0.01`。拒绝负数、科学计数法、逗号、货币符号、超过两位小数、空值及 `01`。分割整数/小数字符串、右补两位后转换并校验，不用浮点乘 100。购买价允许 0，流水不允许 0。低于 ¥1000 仅提示建议范围，不阻止保存。

## 7. 边界与到期语义

| 条件 | 明确行为 |
| --- | --- |
| 无投入/收益记录 | 对应 sum=0 |
| usageCount=0 | 次均显示“— / 暂无使用记录”，不显示 Infinity 或 0 元/次 |
| 收益大于投入 | netCost 和比率允许负值，显示负号并标注“收益已超过投入”，不截为 0 |
| 净投入为 0 | 可计算比率显示 ¥0.00；次数为 0 时仍显示“—” |
| 按天资产 | 卡片主指标日均；详情显示日均、持有天数；无 +1 主操作 |
| 按次资产 | 卡片主指标次均；详情显示次均和次数，并辅助显示日均与持有天数 |
| 模式切换 | 只改变主指标和操作展示，原始投入、日期、次数不变 |
| 到期日为空 | 显示“未设置到期日” |
| today < expiryDate | 显示“距到期 N 天”，N 为日序号差 |
| today = expiryDate | 显示“今日到期” |
| today > expiryDate | 显示“已到期 N 天” |
| 已到期 | 仍可记投入/收益和 +1，持有天数持续增长；到期不表示出售/报废、不停止成本计算 |

到期日是用户自行设定的预计到期观察点，非保修类型、账单、强制生命周期终点；不做提前几天阈值或系统通知。这是针对用户未细化语义所作的明确 MVP 决定。未来若要停止计费必须另引入真实结束语义，不能重解释 expiryDate。

固定样例：purchase=100000 分，additional=20000，consumable=30000，revenue=10000，则 total=150000 分、net=140000 分。2026-09-13 购买，当天日均 ¥1400.00；2026-09-14 日均 ¥700.00；使用 4 次次均 ¥350.00。净投入 100 分/3 次显示 ¥0.33；1 分/2 次显示 ¥0.01；-1 分/2 次显示 -¥0.01。

## 8. JSON 备份格式与兼容性

以下仅是空库格式示例，不是实现代码：

```json
{
  "format": "large-asset-cost-backup",
  "schemaVersion": 1,
  "exportedAt": "2026-09-13T05:00:00.000Z",
  "currency": "CNY",
  "assets": [],
  "costRecords": [],
  "revenueRecords": []
}
```

数组实体完全采用本文模型，包括 null 和时间戳。JSON schemaVersion 描述文件契约，独立于 Dexie 数据库版本；加索引可升级 DB 而不改文件格式。v1 只接受 schemaVersion 数字 1；未来升级提供显式旧格式迁移，禁止猜测未知版本。

在内存完成全部校验后才可确认导入：

1. 文件 <= 80 MiB；三表总记录数 <= 5,000（UI 创建同样在事务中遵守总数上限，编辑和删除仍可执行）。结合文本长度限制，规范化无缩进备份可容纳全部有效记录；测试最大长度/需要转义字符的往返容量。此为个人 MVP 的明确容量决定，后续扩容只需调整验证边界，无需改表。
2. JSON 根必须为普通对象，format/currency/schemaVersion 精确匹配；数组、字段、类型全部符合本文，缺少字段或未知字段拒绝，错误列出字段路径和原因；不直接将解析对象展开进数据库。
3. 校验 ID 格式、每表重复 ID、所有 assetId 的父记录存在、枚举、金额上下限、usageCount、真实日期、文本和审计时间；导入备注空串允许先正规化 null，其他数据不静默修复。
4. purchaseDate/流水不得未来；流水不得早于所属购买日；expiryDate 不早于购买日；聚合安全整数校验。未来日期拒绝时提示检查设备时钟。
5. 本体和流水保留文件里的 ID 与审计时间，导入不生成新 ID、不伪造创建时间、不保留旧库中未出现的实体。空库备份是有效的清空替换，必须走同一覆盖确认。
6. 全部校验通过显示预览，替换以三表单事务提交；重复、孤儿、文件读取失败、校验失败、取消、配额不足、bulkAdd 中途失败都不能改变旧库。


容量推导：每条最多 2,100 个文本 code points（资产名称加备注），每个按最多 6 字节 JSON 转义预算，另预留 1 KiB 固定字段；5,000 条加 envelope 小于 80 MiB（按每条最多 13,624 字节估算约 65 MiB）。必须拒绝未配对 UTF-16 surrogate，并对合法控制字符/补充平面字符做边界测试；未来增加字段或提高长度/条数时重新验证容量界限。+1 或编辑不得全库序列化验证大小。

导出使用一致的 JSON.stringify 无缩进序列化；不持久化容量或 totals，不引入第四张计数表。
