export type ThemeType = 'prince' | 'princess';

export type DayType = 'learn' | 'rest' | 'trip';

export type TaskPace = 'daily' | 'interval' | 'cycle' | 'quota' | 'flex';

export interface TaskSchedule {
  kind: TaskPace;
  /** quota 型任务总量 */
  totalAmount: number | null;
  /** 计量单位（页/篇/课/本/道/次） */
  unit: string;
  /** interval 型：每 N 个学习日一次 */
  intervalN: number;
  /** cycle 型：连续做 N 个学习日 */
  cycleOn: number;
  /** cycle 型：休 M 个学习日 */
  cycleOff: number;
}

export interface TaskTemplate {
  id: string;
  name: string;
  detail: string;
  icon: string;
  color: string;
  isOral: boolean;
  /** 排程配置（总量摊派引擎用），旧数据可为空（按 daily 处理） */
  schedule?: TaskSchedule;
  /** 家长可见的特殊要求备注 */
  note?: string;
}

export interface ChildProfile {
  _id: string;
  _openid: string;
  name: string;
  avatarUrl: string;
  theme: ThemeType;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Plan {
  _id: string;
  _openid: string;
  childId: string;
  name: string;
  startDate: string;
  endDate: string;
  tasks: TaskTemplate[];
  dayTypes: Record<string, DayType>;
  weekTemplates: Record<number, string[]>;
  dailyTasks: Record<string, string[]>;
  /** 每个任务在计划内的应出勤天数（供家长页总量进度条），弹性任务不在此列 */
  taskPlanCounts?: Record<string, number>;
  rankThresholds: number[];
  createdAt: string;
  updatedAt: string;
}

export interface TaskRecord {
  taskId: string;
  completed: boolean;
  startTime?: string;
  endTime?: string;
  correctRate?: number;
}

export interface DayRecord {
  _id: string;
  _openid: string;
  childId: string;
  planId: string;
  date: string;
  taskRecords: TaskRecord[];
  isReported: boolean;
  reportedAt?: string;
  totalPoints: number;
  createdAt: string;
  updatedAt: string;
}

export interface UserProgress {
  _id: string;
  _openid: string;
  childId: string;
  planId: string;
  totalPoints: number;
  currentRank: number;
  maxConsecutiveDays: number;
  currentConsecutiveDays: number;
  medals: string[];
  /** 弹性任务手动累计完成次数（taskId -> 次数） */
  flexDone?: Record<string, number>;
  firstCheckIn?: string;
  lastCheckIn?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DaySchedule {
  date: string;
  dayType: DayType;
  tasks: (TaskTemplate & { record?: TaskRecord })[];
  record: DayRecord | null;
  progress: UserProgress;
}

export interface MedalDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  /** 勋章插画（本地资源），优先于 icon 展示 */
  image?: string;
  /** 是否为不透明瓦片图（aspectFill 填充）；false 为透明底 PNG 风格（aspectFit 居中） */
  tile?: boolean;
}

export interface RankInfo {
  thresholds: number[];
  currentRank: number;
  nextRankPoints: number;
}
