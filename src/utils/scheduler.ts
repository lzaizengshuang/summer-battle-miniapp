import type { DayType, TaskTemplate } from '@/types';
import { eachISODay } from '@/utils/date';

export interface ScheduleInput {
  startDate: string;
  endDate: string;
  /** 希望假期结束前 N 天完成所有任务（留机动） */
  finishBufferDays: number;
  /** 敞耍日集合（家长确认后的） */
  restDates: string[];
  /** 出游日集合（当天全部暂停） */
  tripDates: string[];
  tasks: TaskTemplate[];
}

export interface ScheduleResult {
  dayTypes: Record<string, DayType>;
  /** 每天的任务 id 列表（弹性任务不出现） */
  dailyTasks: Record<string, string[]>;
  /** 每个任务的计划出勤天数 */
  taskPlanCounts: Record<string, number>;
  /** 有效学习日（剔除摊派截止日后的学习日） */
  learnDates: string[];
  /** 学习日总数（不含 buffer 截断） */
  totalLearnDays: number;
}

/**
 * 假期任务排程引擎。
 * 规则：
 * - 出游日 > 敞耍日 > 学习日
 * - 摊派截止日 = endDate - finishBufferDays，截止日之后的学习日不排任务
 * - daily/quota：每个有效学习日
 * - interval：每 N 个学习日一次
 * - cycle：做 N 休 M，按学习日循环
 * - flex：不进每日打卡（弹性目标单独累计）
 */
export function buildSchedule(input: ScheduleInput): ScheduleResult {
  const { startDate, endDate, tasks } = input;
  const restSet = new Set(input.restDates);
  const tripSet = new Set(input.tripDates);

  const allDates = eachISODay(startDate, endDate);
  const dayTypes: Record<string, DayType> = {};
  for (const d of allDates) {
    dayTypes[d] = tripSet.has(d) ? 'trip' : restSet.has(d) ? 'rest' : 'learn';
  }

  const learnDatesAll = allDates.filter((d) => dayTypes[d] === 'learn');
  // 摊派截止日：往前推 finishBufferDays 个自然日
  const end = new Date(`${endDate}T00:00:00`);
  end.setDate(end.getDate() - Math.max(0, input.finishBufferDays));
  const cutoff = end.toISOString().slice(0, 10);
  const learnDates = learnDatesAll.filter((d) => d <= cutoff);

  const dailyTasks: Record<string, string[]> = {};
  for (const d of allDates) dailyTasks[d] = [];
  const taskPlanCounts: Record<string, number> = {};

  for (const task of tasks) {
    const kind = task.schedule?.kind || 'daily';
    if (kind === 'flex') continue;

    let indices: number[] = [];
    if (kind === 'daily' || kind === 'quota') {
      indices = learnDates.map((_, i) => i);
    } else if (kind === 'interval') {
      const n = Math.max(1, task.schedule?.intervalN || 2);
      for (let i = 0; i < learnDates.length; i += n) indices.push(i);
    } else if (kind === 'cycle') {
      const on = Math.max(1, task.schedule?.cycleOn || 2);
      const off = Math.max(0, task.schedule?.cycleOff || 1);
      const period = on + off;
      for (let i = 0; i < learnDates.length; i++) {
        if (i % period < on) indices.push(i);
      }
    }

    taskPlanCounts[task.id] = indices.length;
    for (const i of indices) {
      dailyTasks[learnDates[i]].push(task.id);
    }
  }

  return {
    dayTypes,
    dailyTasks,
    taskPlanCounts,
    learnDates,
    totalLearnDays: learnDatesAll.length,
  };
}

/** 把敞耍日均匀散布到假期里（跳过出游日），返回建议的敞耍日集合 */
export function suggestRestDates(
  startDate: string,
  endDate: string,
  tripDates: string[],
  restCount: number,
): string[] {
  const tripSet = new Set(tripDates);
  const learnCandidates = eachISODay(startDate, endDate).filter((d) => !tripSet.has(d));
  if (restCount <= 0 || learnCandidates.length === 0) return [];
  const total = learnCandidates.length;
  const picked: string[] = [];
  // 均匀取点：第 (i+0.5)*total/restCount 个候选
  for (let i = 0; i < restCount && i < total; i++) {
    const idx = Math.min(total - 1, Math.floor(((i + 0.5) * total) / restCount));
    picked.push(learnCandidates[idx]);
  }
  return [...new Set(picked)];
}
