# 特种兵暑假作战 - 微信小程序 API 契约

## 1. 数据模型

### 1.1 childProfiles 集合（孩子档案）

```typescript
interface ChildProfile {
  _id: string;
  _openid: string;      // 微信云开发自动注入
  name: string;         // 孩子昵称
  avatarUrl: string;    // 头像 URL
  theme: "prince" | "princess";  // 当前主题
  isDefault: boolean;   // 是否默认档案
  createdAt: string;    // ISO 8601
  updatedAt: string;
}
```

### 1.2 plans 集合（作战计划）

```typescript
interface TaskTemplate {
  id: string;           // 唯一 ID，如 "task_001"
  name: string;         // 任务名称
  detail: string;       // 默认详情
  icon: string;         // 图标标识
  color: string;        // 颜色标识
  isOral: boolean;      // 是否口算/听写类连续达标任务
}

interface Plan {
  _id: string;
  _openid: string;
  childId: string;      // 关联档案
  name: string;         // 计划名称，如 "2026 暑假作战"
  startDate: string;    // YYYY-MM-DD
  endDate: string;      // YYYY-MM-DD
  tasks: TaskTemplate[];
  dayTypes: Record<string, "learn" | "rest" | "trip">;  // 日期 -> 类型
  weekTemplates: Record<0 | 1 | 2 | 3 | 4 | 5 | 6, string[]>;  // 周日=0
  dailyTasks: Record<string, string[]>;  // 日期 -> 任务 ID 数组，覆盖 weekTemplates
  rankThresholds: number[];  // 15 级阈值，索引 0 = 列兵/花苞
  createdAt: string;
  updatedAt: string;
}
```

### 1.3 records 集合（每日打卡记录）

```typescript
interface TaskRecord {
  taskId: string;
  completed: boolean;
  startTime?: string;   // ISO 8601，可选
  endTime?: string;     // ISO 8601，可选
  correctRate?: number; // 0-100，可选
}

interface DayRecord {
  _id: string;
  _openid: string;
  childId: string;
  planId: string;
  date: string;         // YYYY-MM-DD
  taskRecords: TaskRecord[];
  isReported: boolean;  // 是否已汇报
  reportedAt?: string;
  totalPoints: number;  // 当日获得积分
  createdAt: string;
  updatedAt: string;
}
```

### 1.4 progress 集合（用户进度）

```typescript
interface UserProgress {
  _id: string;
  _openid: string;
  childId: string;
  planId: string;
  totalPoints: number;           // 总积分
  currentRank: number;           // 当前等级 1-15
  maxConsecutiveDays: number;    // 历史最大连续天数
  currentConsecutiveDays: number;// 当前连续天数
  medals: string[];              // 已解锁勋章 ID 列表
  firstCheckIn?: string;         // 首次打卡日期
  lastCheckIn?: string;          // 最近打卡日期
  createdAt: string;
  updatedAt: string;
}
```

## 2. 云函数列表

### 2.1 档案管理

#### `getOrCreateDefaultChildProfile`
- **输入**: `{ theme?: "prince" | "princess" }`
- **输出**: `{ profile: ChildProfile }`
- **说明**: 查询当前 openid 下的默认档案，不存在则创建默认档案。

#### `createChildProfile`
- **输入**: `{ name: string; theme: "prince" | "princess"; avatarUrl?: string }`
- **输出**: `{ profile: ChildProfile }`
- **说明**: 创建新孩子档案。若当前无默认档案，新档案设为默认。

#### `listChildProfiles`
- **输入**: `{}`
- **输出**: `{ profiles: ChildProfile[] }`

#### `switchDefaultChildProfile`
- **输入**: `{ childId: string }`
- **输出**: `{ profile: ChildProfile }`

#### `updateChildProfile`
- **输入**: `{ childId: string; name?: string; avatarUrl?: string; theme?: "prince" | "princess" }`
- **输出**: `{ profile: ChildProfile }`
- **说明**: 更新孩子档案信息，支持修改昵称、头像、主题。

### 2.2 计划管理

#### `createPlan`
- **输入**:
  ```typescript
  {
    childId: string;
    name: string;
    startDate: string;
    endDate: string;
    tasks: TaskTemplate[];
    dayTypes: Record<string, "learn" | "rest" | "trip">;
    weekTemplates: Record<number, string[]>;
    difficulty?: number;  // 0.6 - 1.2，默认 0.8
  }
  ```
- **输出**: `{ plan: Plan; progress: UserProgress }`
- **说明**: 创建计划时自动生成每日任务表、15 级阈值，并初始化 progress。

#### `getCurrentPlan`
- **输入**: `{ childId: string }`
- **输出**: `{ plan: Plan | null; progress: UserProgress | null }`

#### `updatePlan`
- **输入**: `{ planId: string; ...Partial<Plan> }`
- **输出**: `{ plan: Plan }`
- **说明**: 用于修改计划、调整任务模板、日期类型、单日任务等。修改后触发 progress 重算。

#### `deletePlan`
- **输入**: `{ planId: string }`
- **输出**: `{ success: boolean }`

### 2.3 日程与打卡

#### `startBattle`
- **输入**: `{ childId: string; planId: string; date: string }`
- **输出**: `{ record: DayRecord }`
- **说明**: 记录当天开始作战时间，用于速战速决勋章判断。若当天无记录则创建空白记录并记录 startTime。

#### `getDaySchedule`
- **输入**: `{ childId: string; planId: string; date: string }`
- **输出**:
  ```typescript
  {
    date: string;
    dayType: "learn" | "rest" | "trip";
    tasks: (TaskTemplate & { record?: TaskRecord })[];
    record: DayRecord | null;
    progress: UserProgress;
  }
  ```

#### `toggleTask`
- **输入**:
  ```typescript
  {
    childId: string;
    planId: string;
    date: string;
    taskId: string;
    completed: boolean;
    startTime?: string;
    endTime?: string;
    correctRate?: number;
  }
  ```
- **输出**: `{ record: DayRecord; progress: UserProgress }`
- **说明**: 切换任务完成状态。若全部完成且未汇报，返回允许汇报标识。

#### `reportDay`
- **输入**: `{ childId: string; planId: string; date: string }`
- **输出**: `{ record: DayRecord; progress: UserProgress; unlockedMedals: string[]; rankUp?: boolean }`
- **说明**: 汇报当天作战成果，计算积分、连续天数、勋章、等级升级。

### 2.4 进度与成就

#### `getProgress`
- **输入**: `{ childId: string; planId: string }`
- **输出**: `{ progress: UserProgress; rankInfo: RankInfo; medals: Medal[] }`

#### `getRankInfo`
- **输入**: `{ planId: string }`
- **输出**:
  ```typescript
  {
    thresholds: number[];
    currentRank: number;
    nextRankPoints: number;
  }
  ```

### 2.5 记录查询

#### `getRecords`
- **输入**: `{ childId: string; planId: string; year: number; month: number }`
- **输出**: `{ records: DayRecord[] }`

### 2.6 数据备份与恢复

#### `backupData`
- **输入**: `{ childId: string }`
- **输出**: `{ json: string }`
- **说明**: 导出该档案下的 plan、records、progress 为 JSON 字符串。

#### `restoreData`
- **输入**: `{ childId: string; json: string; mode: "merge" | "overwrite" }`
- **输出**: `{ success: boolean; plan: Plan; progress: UserProgress }`
- **说明**: 导入备份数据。merge 时保留现有记录，overwrite 时完全覆盖。

## 3. 错误格式

所有云函数统一返回：

```typescript
{
  success: boolean;
  data?: any;
  error?: {
    code: string;
    message: string;
  };
}
```

常见错误码：
- `NOT_FOUND`: 记录不存在
- `INVALID_PARAMS`: 参数错误
- `UNAUTHORIZED`: 非当前用户数据
- `ALREADY_REPORTED`: 当日已汇报
- `PLAN_EXPIRED`: 日期不在计划范围内

## 4. 前端请求封装

```typescript
async function callCloud(name: string, data: any): Promise<any> {
  const res = await wx.cloud.callFunction({ name, data });
  const result = res.result as { success: boolean; data?: any; error?: { code: string; message: string } };
  if (!result.success) throw new Error(result.error?.message || "未知错误");
  return result.data;
}
```

## 5. 数据库索引

- `childProfiles`: `{ _openid: 1, isDefault: 1 }`, `{ _openid: 1, createdAt: 1 }`
- `plans`: `{ _openid: 1, childId: 1 }`, `{ childId: 1, startDate: -1 }`
- `records`: `{ _openid: 1, childId: 1, planId: 1, date: 1 }` (唯一索引)
- `progress`: `{ _openid: 1, childId: 1, planId: 1 }` (唯一索引)
