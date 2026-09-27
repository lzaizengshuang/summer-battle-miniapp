const cloud = require('wx-server-sdk');
const { success, fail, getOpenId, isValidDate, generateRankThresholds, recalculateProgress } = require('../utils');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event, context) => {
  try {
    const openid = getOpenId();
    if (!openid) return fail('UNAUTHORIZED', '无法获取用户 openid');

    const { planId, ...updates } = event;
    if (!planId) return fail('INVALID_PARAMS', 'planId 不能为空');

    const planRes = await db.collection('plans')
      .where({ _openid: openid, _id: planId })
      .limit(1)
      .get();

    if (planRes.data.length === 0) {
      return fail('NOT_FOUND', '找不到指定的计划');
    }

    const existing = planRes.data[0];
    const allowedFields = ['name', 'startDate', 'endDate', 'tasks', 'dayTypes', 'weekTemplates', 'dailyTasks', 'difficulty'];
    const updateData = { updatedAt: new Date().toISOString() };

    for (const key of allowedFields) {
      if (updates[key] !== undefined) {
        updateData[key] = updates[key];
      }
    }

    if (updateData.startDate && updateData.endDate && updateData.startDate > updateData.endDate) {
      return fail('INVALID_PARAMS', 'startDate 不能晚于 endDate');
    }

    if (updateData.tasks !== undefined || updateData.startDate !== undefined || updateData.endDate !== undefined || updates.difficulty !== undefined) {
      const start = updateData.startDate || existing.startDate;
      const end = updateData.endDate || existing.endDate;
      const tasks = updateData.tasks || existing.tasks;
      const difficulty = updates.difficulty !== undefined ? updates.difficulty : (existing.difficulty || 0.8);
      updateData.rankThresholds = generateRankThresholds(start, end, tasks, difficulty);
    }

    await db.collection('plans').doc(planId).update({ data: updateData });

    const updatedPlanRes = await db.collection('plans').doc(planId).get();
    const plan = updatedPlanRes.data;

    const { progress } = await recalculateProgress(db, openid, existing.childId, plan);

    return success({ plan, progress });
  } catch (err) {
    return fail('INTERNAL_ERROR', err.message);
  }
};
