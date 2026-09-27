export type ThemeType = 'prince' | 'princess';

export type DayType = 'learn' | 'rest' | 'trip';

export interface TaskTemplate {
  id: string;
  name: string;
  detail: string;
  icon: string;
  color: string;
  isOral: boolean;
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
