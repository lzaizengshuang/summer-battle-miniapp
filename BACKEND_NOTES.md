# 特种兵暑假作战 - 云函数实现说明

## 项目结构

`cloudfunctions/` 下包含 16 个目录：

- `utils/`：共享工具模块（数据库初始化、日期、阈值生成、进度重算、勋章检测等）
- `init-db/`：初始化数据库集合与索引
- 15 个业务云函数：
  - `getOrCreateDefaultChildProfile`
  - `createChildProfile`
  - `listChildProfiles`
  - `switchDefaultChildProfile`
  - `createPlan`
  - `getCurrentPlan`
  - `updatePlan`
  - `getDaySchedule`
  - `toggleTask`
  - `reportDay`
  - `getProgress`
  - `getRankInfo`
  - `getRecords`
  - `backupData`
  - `restoreData`

每个云函数均包含 `index.js`、`config.json`、`package.json`。

## 通用约定

- 统一返回格式：`{ success: boolean, data?: any, error?: { code: string, message: string } }`
- `openid` 必须从 `cloud.getWXContext().OPENID` 获取，不信任客户端传入
- 所有数据操作均带有 `_openid` 校验，防止越权
- 数据库集合：`childProfiles`、`plans`、`records`、`progress`

## 各云函数用途

### 1. getOrCreateDefaultChildProfile

- **用途**：首页入口调用，获取当前微信用户的默认孩子档案；不存在时按主题自动创建
- **关键逻辑**：
  - 查询 `_openid + isDefault: true`
  - 不存在则创建默认昵称（王子主题：小特种兵；公主主题：小公主）
  - 若该用户无任何档案，新档案自动设为默认

### 2. createChildProfile

- **用途**：家长后台新增孩子档案
- **关键逻辑**：
  - 校验 `name` 和 `theme`
  - 首个档案自动设为默认

### 3. listChildProfiles

- **用途**：列出当前用户下所有孩子档案
- **关键逻辑**：按 `createdAt` 升序返回

### 4. switchDefaultChildProfile

- **用途**：切换默认档案
- **关键逻辑**：
  - 验证目标档案属于当前用户
  - 将该用户下所有档案的 `isDefault` 更新为目标为 `true`、其余为 `false`

### 5. createPlan

- **用途**：创建作战计划
- **关键算法**：
  - 校验假期范围、任务数组、日期类型、周模板
  - 生成 15 级军衔阈值：
    ```
    D = endDate - startDate + 1
    N = tasks.length
    每日全勤军功 = N * 5 + 10
    假期总军功上限 = D * (N * 5 + 10)
    周奖励上限 = floor(D / 7) * 50
    元帅阈值 = round((假期总军功上限 + 周奖励上限) * 0.8 * difficulty)
    其他等级 = round(原 PRD 基准阈值 / 1330 * 元帅阈值)
    ```
  - 初始化 `dailyTasks: {}`
  - 调用 `recalculateProgress` 初始化进度文档

### 6. getCurrentPlan

- **用途**：获取当前档案最新计划及进度
- **关键逻辑**：按 `startDate` 降序取第一条计划，再查对应 `progress`

### 7. updatePlan

- **用途**：修改计划（任务模板、日期类型、单日任务、假期范围、难度系数等）
- **关键逻辑**：
  - 仅允许更新白名单字段
  - 若修改了 `tasks`、`startDate`、`endDate` 或 `difficulty`，重新生成 `rankThresholds`
  - 更新完成后调用 `recalculateProgress` 重算进度

### 8. getDaySchedule

- **用途**：获取某一天日程（首页日期切换）
- **关键逻辑**：
  - 校验日期在计划范围内
  - 根据 `dailyTasks[date]` 覆盖 `weekTemplates[weekday]` 得到当日任务
  - 学习日若不存在记录则自动创建空记录
  - 将任务记录状态拼接到任务对象上返回

### 9. toggleTask

- **用途**：切换任务完成状态
- **关键逻辑**：
  - 校验计划、日期、任务 ID
  - 已汇报日期禁止修改
  - 更新 `taskRecords`，并重新计算 `allCompleted` 和 `totalPoints`
  - 返回 `canReport` 标识：全部完成且未汇报时为 `true`

### 10. reportDay

- **用途**：汇报当日作战成果，发放军功、计算连续天数、解锁勋章、升级军衔
- **关键逻辑**：
  - 仅允许学习日汇报
  - 校验当日全部任务已完成且未汇报
  - 设置 `isReported=true`、`reportedAt`
  - 调用 `recalculateProgress` 重算：
    - 累计军功
    - 当前连续天数 / 历史最大连续天数
    - 军衔等级
    - 勋章解锁
  - 返回本次新解锁勋章和是否升级

### 11. getProgress

- **用途**：获取进度、军衔信息、勋章墙
- **关键逻辑**：
  - 返回 `progress` 文档
  - 计算 `rankInfo`：当前等级、当前阈值、下一级阈值、升级百分比
  - 返回所有勋章定义及解锁状态

### 12. getRankInfo

- **用途**：获取军衔阈值和下一级所需军功
- **关键逻辑**：根据当前用户的 `progress` 计算 `currentRank` 和 `nextRankPoints`

### 13. getRecords

- **用途**：按月查询打卡记录（作战记录页）
- **关键逻辑**：使用正则 `^YYYY-MM` 匹配日期字段并升序返回

### 14. backupData

- **用途**：导出当前档案的完整数据
- **关键逻辑**：
  - 查询 `childProfile`、`plans`、`records`、`progress`
  - 打包为 JSON 字符串返回

### 15. restoreData

- **用途**：从备份 JSON 恢复数据
- **关键逻辑**：
  - 解析并校验备份数据
  - `overwrite` 模式：删除当前档案下所有计划、记录、进度后导入
  - `merge` 模式：保留现有记录，仅导入不冲突的备份记录
  - 重建 `_openid` 和 `childId` 归属关系
  - 重新映射 `planId`
  - 导入后对首个计划调用 `recalculateProgress` 确保一致性

### 16. init-db

- **用途**：一次性初始化数据库集合与索引
- **关键逻辑**：
  - 创建集合：`childProfiles`、`plans`、`records`、`progress`
  - 创建契约约定的索引：
    - `childProfiles`: `{ _openid: 1, isDefault: 1 }`, `{ _openid: 1, createdAt: 1 }`
    - `plans`: `{ _openid: 1, childId: 1 }`, `{ childId: 1, startDate: -1 }`
    - `records`: `{ _openid: 1, childId: 1, planId: 1, date: 1 }`（唯一）
    - `progress`: `{ _openid: 1, childId: 1, planId: 1 }`（唯一）
  - 已存在则跳过

## 核心算法说明

### 军功计算

```
单日军功 = 已完成任务数 * 5 + (全部完成 ? 10 : 0)
```

周奖励在 `recalculateProgress` 中按历史最大连续天数计算：

```
周奖励 = floor(maxConsecutiveDays / 7) * 50
```

### 连续打卡算法

- 从计划范围内最新完成的学习日往前数
- 非学习日（敞耍/出游）跳过，不计入也不中断
- 遇到未完成的学习日中断
- 今天未完成/无记录不影响：因为计数起点是最新完成记录

### 历史最大连续

遍历计划范围内所有学习日，统计最长连续 `allCompleted=true` 的天数。

### 军衔等级

```
currentRank = max(i + 1) 满足 totalPoints >= rankThresholds[i]
```

### 勋章检测

| 勋章 ID | 名称 | 条件 |
|---|---|---|
| `first` | 初出茅庐 | 存在任意 `allCompleted=true` 的记录 |
| `streak7` | 铁人勋章 | 历史最大连续 ≥ 7 天 |
| `streak14` | 坚持不懈 | 历史最大连续 ≥ 14 天 |
| `streak21` | 钢铁意志 | 历史最大连续 ≥ 21 天 |
| `streak30` | 战神勋章 | 历史最大连续 ≥ 30 天 |
| `all6` | 全能战士 | 单日完成全部已配置任务；若计划任务总数 < 3，则任意全部完成日解锁 |
| `fast` | 速战速决 | 存在汇报用时 ≤ 30 分钟的记录 |
| `perfect` | 零失误 | `isOral=true` 的任务连续 10 天完成 |

## 风险与待确认点

1. **阈值缩放基准**：当前使用 PRD 原始阈值 `[0, 30, 70, ..., 1330]` 作为缩放基准，并以元帅阈值（索引 14）为标尺。若产品要求使用其他缩放方式，需要调整 `generateRankThresholds`。
2. **周奖励计算**：当前按历史最大连续天数一次性累计奖励。若业务要求按“每段 7 天连续打卡”分段发放或仅发放一次，需要调整逻辑。
3. **updatePlan 的 dailyTasks 清理**：当假期范围缩短时，缩短区间外的 `dailyTasks` 不会自动清理，可能残留无效 key。建议前端在修改假期范围时同步清理或后续增强该逻辑。
4. **事务一致性**：当前未使用数据库事务。并发修改同一记录（如同一天多任务同时点击）可能出现竞态。建议前端串行调用，或在高并发场景下考虑加事务。
5. **勋章定义冲突**：PRD 中“钢铁意志”为连续 14 天，任务要求为连续 21 天。实现采用 21 天作为 `streak21`，并额外保留 14 天勋章 `streak14`，文案为“坚持不懈”。如需与 PRD 完全一致，可调整。
6. **restoreData 大数量限制**：备份记录较多时，云函数单次执行可能超时或超出数据库写入限制。建议前端分块备份/恢复或限制备份大小。
7. **零失误勋章**：要求当天所有 `isOral=true` 的任务都完成才计入连续。若某天没有口算任务，则该天不计入口算连续统计。
