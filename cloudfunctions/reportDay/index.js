const cloud = require('wx-server-sdk');
const {
  success, fail, getOpenId, isValidDate, getDayType, getDayTasks, calculateDayPoints, recalculateProgress
} = require('./utils');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  try {
    const openid = getOpenId();
    if (!openid) return fail('UNAUTHORIZED', '无法获取用户 openid');

    const { childId, planId, date } = event;
    if (!childId || !planId || !date) {
      return fail('INVALID_PARAMS', 'childId、planId、date 不能为空');
    }
    if (!isValidDate(date)) return fail('INVALID_PARAMS', 'date 格式必须为 YYYY-MM-DD');

    const planRes = await db.collection('plans')
      .where({ _openid: openid, _id: planId, childId })
      .limit(1)
      .get();

    if (planRes.data.length === 0) return fail('NOT_FOUND', '找不到指定的计划');

    const plan = planRes.data[0];
    if (date < plan.startDate || date > plan.endDate) {
      return fail('PLAN_EXPIRED', '日期不在计划范围内');
    }

    const dayType = getDayType(plan, date);
    if (dayType !== 'learn') {
      return fail('INVALID_PARAMS', '非学习日不能汇报');
    }

    const tasks = getDayTasks(plan, date);
    if (tasks.length === 0) {
      return fail('INVALID_PARAMS', '当日没有配置任务');
    }

    const recordRes = await db.collection('records')
      .where({ _openid: openid, childId, planId, date })
      .limit(1)
      .get();

    if (recordRes.data.length === 0) {
      return fail('INVALID_PARAMS', '当日没有任务记录，请先完成任务');
    }

    let record = recordRes.data[0];
    if (record.isReported) {
      return fail('ALREADY_REPORTED', '当日已汇报');
    }

    const taskIds = tasks.map(t => t.id);
    const allCompleted = taskIds.every(id => {
      const tr = (record.taskRecords || []).find(r => r.taskId === id);
      return tr && tr.completed;
    });

    if (!allCompleted) {
      return fail('INVALID_PARAMS', '当日任务尚未全部完成，无法汇报');
    }

    const now = new Date().toISOString();
    const totalPoints = calculateDayPoints(record.taskRecords, true);

    await db.collection('records').doc(record._id).update({
      data: {
        isReported: true,
        reportedAt: now,
        allCompleted: true,
        totalPoints,
        updatedAt: now
      }
    });

    record.isReported = true;
    record.reportedAt = now;
    record.allCompleted = true;
    record.totalPoints = totalPoints;
    record.updatedAt = now;

    const beforeProgressRes = await db.collection('progress')
      .where({ _openid: openid, childId, planId })
      .limit(1)
      .get();
    const beforeProgress = beforeProgressRes.data[0];
    const oldRank = beforeProgress ? beforeProgress.currentRank : 1;
    const oldMedals = beforeProgress ? (beforeProgress.medals || []) : [];

    const { progress } = await recalculateProgress(db, openid, childId, plan);

    const newMedals = (progress.medals || []).filter(m => !oldMedals.includes(m));
    const rankUp = progress.currentRank > oldRank;

    return success({
      record,
      progress,
      unlockedMedals: newMedals,
      rankUp
    });
  } catch (err) {
    return fail('INTERNAL_ERROR', err.message);
  }
};
