const cloud = require('wx-server-sdk');

const BASE_RANK_THRESHOLDS = [0, 30, 70, 120, 180, 250, 330, 420, 520, 630, 750, 880, 1020, 1170, 1330];

function initCloud() {
  cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
  return cloud.database();
}

function getOpenId() {
  const { OPENID } = cloud.getWXContext();
  return OPENID;
}

function success(data) {
  return { success: true, data };
}

function fail(code, message) {
  return { success: false, error: { code, message } };
}

function isValidDate(dateStr) {
  return typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
}

function parseDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(dateStr, days) {
  const date = parseDate(dateStr);
  date.setDate(date.getDate() + days);
  return formatDate(date);
}

function diffDaysInclusive(startDate, endDate) {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((end - start) / msPerDay) + 1;
}

function getWeekday(dateStr) {
  return parseDate(dateStr).getDay();
}

function generateRankThresholds(startDate, endDate, tasks, difficulty = 0.8) {
  const D = diffDaysInclusive(startDate, endDate);
  const N = Array.isArray(tasks) ? tasks.length : 0;
  const dailyFull = N * 5 + 10;
  const totalMax = D * dailyFull;
  const weeklyMax = Math.floor(D / 7) * 50;
  const coef = Math.max(0.6, Math.min(1.2, difficulty));
  const marshalThreshold = Math.round((totalMax + weeklyMax) * 0.8 * coef);
  if (marshalThreshold <= 0) {
    return BASE_RANK_THRESHOLDS.map(() => 0);
  }
  const scale = marshalThreshold / BASE_RANK_THRESHOLDS[BASE_RANK_THRESHOLDS.length - 1];
  return BASE_RANK_THRESHOLDS.map(t => Math.round(t * scale));
}

function getDayTaskIds(plan, date) {
  if (plan.dailyTasks && plan.dailyTasks[date] && Array.isArray(plan.dailyTasks[date])) {
    return plan.dailyTasks[date];
  }
  const weekday = getWeekday(date);
  if (plan.weekTemplates && plan.weekTemplates[weekday] && Array.isArray(plan.weekTemplates[weekday])) {
    return plan.weekTemplates[weekday];
  }
  return [];
}

function getDayTasks(plan, date) {
  const taskIds = getDayTaskIds(plan, date);
  const taskMap = new Map((plan.tasks || []).map(t => [t.id, t]));
  return taskIds.map(id => taskMap.get(id)).filter(Boolean);
}

function getDayType(plan, date) {
  if (plan.dayTypes && plan.dayTypes[date]) {
    return plan.dayTypes[date];
  }
  return 'learn';
}

function calculateDayPoints(taskRecords, allCompleted) {
  const completedCount = (taskRecords || []).filter(r => r.completed).length;
  const bonus = allCompleted ? 10 : 0;
  return completedCount * 5 + bonus;
}

function getRankFromPoints(points, thresholds) {
  let rank = 1;
  for (let i = 0; i < thresholds.length; i++) {
    if (points >= thresholds[i]) {
      rank = i + 1;
    } else {
      break;
    }
  }
  return Math.min(rank, 15);
}

function getDatesInRange(startDate, endDate) {
  const dates = [];
  let current = startDate;
  const end = parseDate(endDate);
  while (parseDate(current) <= end) {
    dates.push(current);
    current = addDays(current, 1);
  }
  return dates;
}

function computeConsecutiveDays(records, plan) {
  const dates = getDatesInRange(plan.startDate, plan.endDate).sort().reverse();
  let currentStreak = 0;
  let started = false;
  for (const date of dates) {
    const dayType = getDayType(plan, date);
    if (dayType !== 'learn') {
      continue;
    }
    const record = records.find(r => r.date === date);
    const isCompleted = record && record.allCompleted;
    if (isCompleted) {
      currentStreak += 1;
      started = true;
    } else if (started) {
      // 已从最新完成记录开始计数，遇到非完成学习日则中断
      break;
    }
    // 在找到最新完成记录之前，跳过 today 未完成/无记录的情况
  }
  return currentStreak;
}

function computeMaxConsecutiveDays(records, plan) {
  const dates = getDatesInRange(plan.startDate, plan.endDate).sort();
  let maxStreak = 0;
  let current = 0;
  for (const date of dates) {
    const dayType = getDayType(plan, date);
    if (dayType !== 'learn') {
      continue;
    }
    const record = records.find(r => r.date === date);
    if (record && record.allCompleted) {
      current += 1;
      maxStreak = Math.max(maxStreak, current);
    } else {
      current = 0;
    }
  }
  return maxStreak;
}

function detectMedals(progress, records, plan) {
  const medals = new Set(progress.medals || []);
  const completedRecords = records.filter(r => r.allCompleted);
  const learnDates = getDatesInRange(plan.startDate, plan.endDate).filter(d => getDayType(plan, d) === 'learn');

  if (completedRecords.length > 0) {
    medals.add('first');
  }

  const maxStreak = computeMaxConsecutiveDays(records, plan);
  if (maxStreak >= 7) medals.add('streak7');
  if (maxStreak >= 14) medals.add('streak14');
  if (maxStreak >= 21) medals.add('streak21');
  if (maxStreak >= 30) medals.add('streak30');

  const allCompletedLearnDays = completedRecords.filter(r => getDayType(plan, r.date) === 'learn');
  // 弹性备忘任务不计入"全部已配置任务"（它不在每日打卡中）
  const activeTaskCount = (plan.tasks || []).filter(t => !t.schedule || t.schedule.kind !== 'flex').length;
  const allTaskDays = allCompletedLearnDays.filter(r => {
    if (activeTaskCount < 3) return true; // 任务总数不足 3 项时，任意全部完成日解锁
    const dayTasks = getDayTasks(plan, r.date);
    return dayTasks.length >= 3;
  });
  if (allTaskDays.length > 0) {
    medals.add('all6');
  }

  const fastDay = completedRecords.find(r => {
    if (!r.startTime || !r.reportedAt) return false;
    const start = new Date(r.startTime).getTime();
    const end = new Date(r.reportedAt).getTime();
    const minutes = (end - start) / (60 * 1000);
    return minutes > 0 && minutes <= 30;
  });
  if (fastDay) medals.add('fast');

  // 零失误：isOral=true 的任务连续 10 天完成
  const oralTaskIds = new Set((plan.tasks || []).filter(t => t.isOral).map(t => t.id));
  if (oralTaskIds.size > 0) {
    let oralStreak = 0;
    let maxOralStreak = 0;
    for (const date of learnDates) {
      const record = records.find(r => r.date === date);
      const dayTaskIds = getDayTaskIds(plan, date);
      const hasOral = dayTaskIds.some(id => oralTaskIds.has(id));
      if (!hasOral) continue;
      const oralCompleted = dayTaskIds
        .filter(id => oralTaskIds.has(id))
        .every(id => {
          const tr = (record && record.taskRecords || []).find(t => t.taskId === id);
          return tr && tr.completed;
        });
      if (oralCompleted) {
        oralStreak += 1;
        maxOralStreak = Math.max(maxOralStreak, oralStreak);
      } else {
        oralStreak = 0;
      }
    }
    if (maxOralStreak >= 10) medals.add('perfect');
  }

  // === 扩展勋章（2026-09） ===
  const reportedRecords = records.filter(r => r.isReported);

  // 早起标兵：累计 5 天在中午 12 点前汇报
  const earlyCount = reportedRecords.filter(r => {
    if (!r.reportedAt) return false;
    return new Date(r.reportedAt).getHours() < 12;
  }).length;
  if (earlyCount >= 5) medals.add('earlybird');

  // 坚持不懈 / 月度尖兵：累计完成学习日
  const completedDayCount = completedRecords.length;
  if (completedDayCount >= 7) medals.add('days7');
  if (completedDayCount >= 30) medals.add('days30');

  // 半程冲锋：完成计划一半以上学习日
  if (learnDates.length > 0 && completedDayCount >= Math.max(1, Math.floor(learnDates.length / 2))) {
    medals.add('halfway');
  }

  // 完美收官：完成计划最后一个学习日
  const lastLearnDate = learnDates[learnDates.length - 1];
  if (lastLearnDate && completedRecords.some(r => r.date === lastLearnDate)) {
    medals.add('finisher');
  }

  // 卷土重来：中断后重新连续坚持 3 天
  const streaks = [];
  let currentStreakRun = 0;
  for (const date of learnDates) {
    const record = records.find(r => r.date === date);
    if (record && record.allCompleted) {
      currentStreakRun += 1;
    } else {
      if (currentStreakRun > 0) streaks.push(currentStreakRun);
      currentStreakRun = 0;
    }
  }
  if (currentStreakRun > 0) streaks.push(currentStreakRun);
  if (streaks.length >= 2 && streaks[streaks.length - 1] >= 3) {
    medals.add('comeback');
  }

  // 口算之星：口算类任务累计完成 50 次
  let oralCompleted = 0;
  for (const record of records) {
    for (const tr of (record.taskRecords || [])) {
      if (tr.completed && oralTaskIds.has(tr.taskId)) oralCompleted += 1;
    }
  }
  if (oralCompleted >= 50) medals.add('oral50');

  // 军功显赫：总军功达到 500
  if ((progress.totalPoints || 0) >= 500) medals.add('rich500');

  return Array.from(medals);
}

async function recalculateProgress(db, openid, childId, plan) {
  const recordsRes = await db.collection('records')
    .where({ _openid: openid, childId, planId: plan._id })
    .get();
  const records = recordsRes.data || [];

  let totalPoints = 0;
  let firstCheckIn = null;
  let lastCheckIn = null;

  for (const record of records) {
    if (record.isReported) {
      totalPoints += record.totalPoints || 0;
      if (record.allCompleted) {
        if (!firstCheckIn || record.date < firstCheckIn) firstCheckIn = record.date;
        if (!lastCheckIn || record.date > lastCheckIn) lastCheckIn = record.date;
      }
    }
  }

  // 周奖励：每满 7 天连续打卡 +50
  const maxStreak = computeMaxConsecutiveDays(records, plan);
  const weeklyBonus = Math.floor(maxStreak / 7) * 50;
  totalPoints += weeklyBonus;

  const currentRank = getRankFromPoints(totalPoints, plan.rankThresholds || BASE_RANK_THRESHOLDS);
  const currentStreak = computeConsecutiveDays(records, plan);

  const existingRes = await db.collection('progress')
    .where({ _openid: openid, childId, planId: plan._id })
    .get();

  const progressPayload = {
    totalPoints,
    currentRank,
    maxConsecutiveDays: maxStreak,
    currentConsecutiveDays: currentStreak,
    firstCheckIn,
    lastCheckIn,
    updatedAt: new Date().toISOString()
  };

  let progress;
  if (existingRes.data.length > 0) {
    const existing = existingRes.data[0];
    const oldRank = existing.currentRank || 1;
    const newMedals = detectMedals({ ...existing, ...progressPayload }, records, plan);
    await db.collection('progress').doc(existing._id).update({
      data: {
        ...progressPayload,
        medals: newMedals
      }
    });
    progress = { ...existing, ...progressPayload, medals: newMedals };
  } else {
    const newMedals = detectMedals(progressPayload, records, plan);
    const createdAt = new Date().toISOString();
    const addRes = await db.collection('progress').add({
      data: {
        _openid: openid,
        childId,
        planId: plan._id,
        medals: newMedals,
        createdAt,
        ...progressPayload
      }
    });
    progress = {
      _id: addRes._id,
      _openid: openid,
      childId,
      planId: plan._id,
      medals: newMedals,
      createdAt,
      ...progressPayload
    };
  }

  return { progress, records, maxStreak, weeklyBonus };
}

function sanitizeRecordForOutput(record) {
  if (!record) return null;
  const { _openid, ...rest } = record;
  return rest;
}

module.exports = {
  cloud,
  initCloud,
  getOpenId,
  success,
  fail,
  isValidDate,
  parseDate,
  formatDate,
  addDays,
  diffDaysInclusive,
  getWeekday,
  generateRankThresholds,
  getDayTaskIds,
  getDayTasks,
  getDayType,
  getDatesInRange,
  calculateDayPoints,
  getRankFromPoints,
  computeConsecutiveDays,
  computeMaxConsecutiveDays,
  detectMedals,
  recalculateProgress,
  sanitizeRecordForOutput,
  BASE_RANK_THRESHOLDS
};
